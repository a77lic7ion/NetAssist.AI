from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete
from database import get_session
from models import orm
from models.config_schemas import ConfigUpload, DeviceConfig
from ciscoconfparse2 import CiscoConfParse
import hashlib
import json

router = APIRouter(prefix="/configs", tags=["configs"])

async def parse_and_update_device(device_id: str, config_content: str, db: AsyncSession):
    parse = CiscoConfParse(config_content.splitlines())

    # Get device
    result = await db.execute(select(orm.Device).where(orm.Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        return

    # 1. Hostname
    hostname_objs = parse.find_objects(r'^hostname\s+')
    if hostname_objs:
        device.hostname = hostname_objs[0].text.split()[1]

    # Try to extract Model and Vendor from comments or other info
    for line in config_content.splitlines()[:100]:
        line = line.strip()
        # Custom markers in comments
        if line.startswith('!') and ':' in line:
            parts = line[1:].split(':', 1)
            key = parts[0].strip().lower()
            val = parts[1].strip()
            if key == 'vendor':
                device.vendor = val
            elif key == 'model':
                device.platform = val

        # Heuristics for Cisco
        if 'Cisco IOS Software' in line or 'Cisco Catalyst' in line:
            device.vendor = 'Cisco'

        if 'Software (C9300' in line:
            device.platform = 'Catalyst 9300'
        elif 'Software (C9200' in line:
            device.platform = 'Catalyst 9200'
        elif 'Software (C9500' in line:
            device.platform = 'Catalyst 9500'
        elif 'Software (ISR' in line:
            device.platform = 'ISR'
        elif 'Software (ASR' in line:
            device.platform = 'ASR'

    # 2. Interfaces
    await db.execute(delete(orm.Interface).where(orm.Interface.device_id == device_id))

    intf_objs = parse.find_objects(r'^interface\s+')
    first_ip = None

    for intf_obj in intf_objs:
        name = intf_obj.text.split()[1]
        description = ""
        ip_address = None
        ip_mask = None
        mode = "access"
        vlan_access = None
        vlan_trunk_allowed = "[]"
        state = "up"

        # Check description
        desc_objs = intf_obj.find_child_objects(r'^\s+description\s+')
        if desc_objs:
            description = desc_objs[0].text.strip().replace('description ', '')

        # Check IP
        ip_objs = intf_obj.find_child_objects(r'^\s+ip\s+address\s+')
        if ip_objs:
            parts = ip_objs[0].text.strip().split()
            if len(parts) >= 4:
                ip_address = parts[2]
                ip_mask = parts[3]
                if not first_ip or "Loopback" in name:
                    first_ip = ip_address

        # Check shutdown
        if intf_obj.find_child_objects(r'^\s+shutdown'):
            state = "down"

        # Check switchport mode
        mode_objs = intf_obj.find_child_objects(r'^\s+switchport\s+mode\s+')
        if mode_objs:
            mode = mode_objs[0].text.strip().split()[-1]

        # Check access vlan
        access_vlan_objs = intf_obj.find_child_objects(r'^\s+switchport\s+access\s+vlan\s+')
        if access_vlan_objs:
            try:
                vlan_access = int(access_vlan_objs[0].text.strip().split()[-1])
            except:
                pass

        # Check trunk vlans
        trunk_vlan_objs = intf_obj.find_child_objects(r'^\s+switchport\s+trunk\s+allowed\s+vlan\s+')
        if trunk_vlan_objs:
            vlan_str = trunk_vlan_objs[0].text.strip().split()[-1]
            vlans = []
            for part in vlan_str.split(','):
                if '-' in part:
                    try:
                        start, end = part.split('-')
                        vlans.extend(range(int(start), int(end) + 1))
                    except:
                        pass
                else:
                    try:
                        vlans.append(int(part))
                    except:
                        pass
            vlan_trunk_allowed = json.dumps(vlans)

        db_intf = orm.Interface(
            device_id=device_id,
            name=name,
            description=description,
            mode=mode,
            vlan_access=vlan_access,
            vlan_trunk_allowed=vlan_trunk_allowed,
            ip_address=ip_address,
            ip_mask=ip_mask,
            state=state
        )
        db.add(db_intf)

    if first_ip:
        device.management_ip = first_ip

    # 3. VLANs
    await db.execute(delete(orm.DeviceVlan).where(orm.DeviceVlan.device_id == device_id))
    vlan_objs = parse.find_objects(r'^vlan\s+\d+')
    for vlan_obj in vlan_objs:
        vlan_id_str = vlan_obj.text.split()[1]
        try:
            vlan_id = int(vlan_id_str)
        except:
            continue

        vlan_name = ""
        name_objs = vlan_obj.find_child_objects(r'^\s+name\s+')
        if name_objs:
            vlan_name = name_objs[0].text.strip().replace('name ', '')

        db_vlan = orm.DeviceVlan(
            device_id=device_id,
            vlan_id=vlan_id,
            name=vlan_name
        )
        db.add(db_vlan)

    await db.commit()

    # Re-validate all links connected to this device
    from api.links import validate_link
    result = await db.execute(
        select(orm.Link).where(
            (orm.Link.source_device_id == device_id) |
            (orm.Link.target_device_id == device_id)
        )
    )
    links = result.scalars().all()
    for link in links:
        await validate_link(link.id, db)

@router.post("/{device_id}", response_model=DeviceConfig)
async def upload_config(device_id: str, config: ConfigUpload, db: AsyncSession = Depends(get_session)):
    # Verify device exists
    result = await db.execute(select(orm.Device).where(orm.Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Calculate hash
    config_hash = hashlib.sha256(config.content.encode('utf-8')).hexdigest()
    
    # Save snapshot
    db_snapshot = orm.ConfigSnapshot(
        device_id=device_id,
        raw_config=config.content,
        config_hash=config_hash,
        source="upload"
    )
    db.add(db_snapshot)
    
    # Update device hash
    device.config_hash = config_hash
    
    await db.commit()
    await db.refresh(db_snapshot)
    
    # Trigger parsing logic
    await parse_and_update_device(device_id, config.content, db)
    
    # Re-map snapshot to DeviceConfig for response
    return {
        "id": db_snapshot.id,
        "device_id": db_snapshot.device_id,
        "raw_config": db_snapshot.raw_config,
        "config_hash": db_snapshot.config_hash,
        "source": db_snapshot.source,
        "taken_at": db_snapshot.taken_at
    }

@router.get("/{device_id}/latest", response_model=DeviceConfig)
async def get_latest_config(device_id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(
        select(orm.ConfigSnapshot)
        .where(orm.ConfigSnapshot.device_id == device_id)
        .order_by(desc(orm.ConfigSnapshot.taken_at))
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=404, detail="No configuration found for this device")
    return {
        "id": snapshot.id,
        "device_id": snapshot.device_id,
        "raw_config": snapshot.raw_config,
        "config_hash": snapshot.config_hash,
        "source": snapshot.source,
        "taken_at": snapshot.taken_at
    }
