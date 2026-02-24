from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from database import get_session
from models import orm, schemas
import json

router = APIRouter(prefix="/links", tags=["links"])

@router.get("/{project_id}", response_model=List[schemas.Link])
async def list_links(project_id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(orm.Link).where(orm.Link.project_id == project_id))
    links = result.scalars().all()
    # Parse JSON fields if necessary, though Pydantic might handle if we structured it right.
    # Here we rely on Pydantic's from_attributes to map ORM objects to schemas.
    # Note: vlan_allow_list is stored as Text (JSON) in DB, but List[int] in Schema.
    # We might need a validator or manual conversion if SQLAlchemy/Pydantic bridge doesn't handle JSON string -> List auto-magic.
    # For now, let's assume we might need to handle it, but let's see if simple mapping works.
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
