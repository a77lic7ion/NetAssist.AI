from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from database import get_session
from models import orm, schemas

router = APIRouter(prefix="/devices", tags=["devices"])

@router.get("/{project_id}", response_model=List[schemas.Device])
async def list_devices(project_id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(
        select(orm.Device)
        .where(orm.Device.project_id == project_id)
        .options(selectinload(orm.Device.interfaces), selectinload(orm.Device.vlans))
    )
    return result.scalars().all()

@router.post("/", response_model=schemas.Device)
async def create_device(device: schemas.DeviceCreate, project_id: str, db: AsyncSession = Depends(get_session)):
    # Verify project exists
    result = await db.execute(select(orm.Project).where(orm.Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    db_device = orm.Device(**device.model_dump(), project_id=project_id)
    db.add(db_device)
    await db.commit()

    # Reload with relationships to avoid lazy-loading issues
    result = await db.execute(
        select(orm.Device)
        .where(orm.Device.id == db_device.id)
        .options(selectinload(orm.Device.interfaces), selectinload(orm.Device.vlans))
    )
    return result.scalar_one()

@router.get("/detail/{device_id}", response_model=schemas.Device)
async def get_device(device_id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(
        select(orm.Device)
        .where(orm.Device.id == device_id)
        .options(selectinload(orm.Device.interfaces), selectinload(orm.Device.vlans))
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.delete("/{device_id}")
async def delete_device(device_id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(orm.Device).where(orm.Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    await db.delete(device)
    await db.commit()
    return {"status": "success"}
