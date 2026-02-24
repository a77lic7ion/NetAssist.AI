from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from database import get_session
from models import orm
from models.config_schemas import ConfigUpload, DeviceConfig
from ciscoconfparse2 import CiscoConfParse
import hashlib

router = APIRouter(prefix="/configs", tags=["configs"])

@router.post("/{device_id}", response_model=DeviceConfig)
async def upload_config(device_id: str, config: ConfigUpload, db: AsyncSession = Depends(get_session)):
    # Verify device exists
    result = await db.execute(select(orm.Device).where(orm.Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Calculate hash to check for changes (simple version)
    config_hash = hashlib.md5(config.content.encode('utf-8')).hexdigest()
    
    # Save config
    db_config = orm.DeviceConfig(
        device_id=device_id,
        content=config.content
    )
    db.add(db_config)
    
    # Update device hash
    device.config_hash = config_hash
    
    await db.commit()
    await db.refresh(db_config)
    
    # TODO: Trigger parsing logic here (async task)
    
    return db_config

@router.get("/{device_id}/latest", response_model=DeviceConfig)
async def get_latest_config(device_id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(
        select(orm.DeviceConfig)
        .where(orm.DeviceConfig.device_id == device_id)
        .order_by(desc(orm.DeviceConfig.created_at))
        .limit(1)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="No configuration found for this device")
    return config
