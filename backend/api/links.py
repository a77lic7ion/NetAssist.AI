from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from database import get_session
from models import orm, schemas
import json
import ipaddress

router = APIRouter(prefix="/links", tags=["links"])

async def validate_link(link_id: str, db: AsyncSession):
    # Fetch link
    result = await db.execute(select(orm.Link).where(orm.Link.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        return

    # Fetch source interface
    result = await db.execute(
        select(orm.Interface)
        .where(orm.Interface.device_id == link.source_device_id)
        .where(orm.Interface.name == link.source_interface)
    )
    src_intf = result.scalar_one_or_none()

    # Fetch target interface
    result = await db.execute(
        select(orm.Interface)
        .where(orm.Interface.device_id == link.target_device_id)
        .where(orm.Interface.name == link.target_interface)
    )
    tgt_intf = result.scalar_one_or_none()

    if not src_intf or not tgt_intf:
        link.state = "down"
        await db.commit()
        return

    l2_up = False
    l3_up = False

    # L2 check: VLANs
    if src_intf.mode == "access" and tgt_intf.mode == "access":
        # Both access ports - must be on same VLAN
        if src_intf.vlan_access == tgt_intf.vlan_access:
            l2_up = True
    elif src_intf.mode == "trunk" and tgt_intf.mode == "trunk":
        # Both trunks - must have at least one common allowed VLAN
        src_vlans = set(json.loads(src_intf.vlan_trunk_allowed or "[]"))
        tgt_vlans = set(json.loads(tgt_intf.vlan_trunk_allowed or "[]"))
        if src_vlans & tgt_vlans:
            l2_up = True
    elif (src_intf.mode == "trunk" and tgt_intf.mode == "access") or (src_intf.mode == "access" and tgt_intf.mode == "trunk"):
        # Trunk to Access - check if access vlan is in trunk allow list
        # (Technically possible if native vlan matches, but usually a misconfig if not)
        pass

    # L3 check: IP Subnets
    if src_intf.ip_address and tgt_intf.ip_address and src_intf.ip_mask and tgt_intf.ip_mask:
        try:
            # Normalize mask
            def get_iface(ip, mask):
                if '/' in mask: return ipaddress.IPv4Interface(f"{ip}{mask}")
                return ipaddress.IPv4Interface(f"{ip}/{mask}")

            src_iface = get_iface(src_intf.ip_address, src_intf.ip_mask)
            tgt_iface = get_iface(tgt_intf.ip_address, tgt_intf.ip_mask)

            if src_iface.network == tgt_iface.network:
                l3_up = True
        except Exception as e:
            print(f"Error validating L3: {e}")

    # For now, if either L2 or L3 is up, we consider the link "up"
    if l2_up or l3_up:
        link.state = "up"
    else:
        link.state = "down"

    await db.commit()

@router.get("/{project_id}", response_model=List[schemas.Link])
async def list_links(project_id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(orm.Link).where(orm.Link.project_id == project_id))
    links = result.scalars().all()
    return links

@router.post("/", response_model=schemas.Link)
async def create_link(link: schemas.LinkCreate, project_id: str, db: AsyncSession = Depends(get_session)):
    # Verify project exists
    result = await db.execute(select(orm.Project).where(orm.Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Serialize list to json string for storage
    link_data = link.model_dump()
    if 'vlan_allow_list' in link_data and link_data['vlan_allow_list']:
        link_data['vlan_allow_list'] = json.dumps(link_data['vlan_allow_list'])
    else:
        link_data['vlan_allow_list'] = "[]"

    db_link = orm.Link(**link_data, project_id=project_id)
    db.add(db_link)
    await db.commit()
    await db.refresh(db_link)

    # Validate link
    await validate_link(db_link.id, db)
    await db.refresh(db_link)

    return db_link

@router.delete("/{link_id}")
async def delete_link(link_id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(orm.Link).where(orm.Link.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    
    await db.delete(link)
    await db.commit()
    return {"status": "success"}
