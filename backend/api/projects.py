from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from database import get_session
from models import orm, schemas

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("/", response_model=List[schemas.Project])
async def list_projects(db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(orm.Project))
    return result.scalars().all()

@router.post("/", response_model=schemas.Project)
async def create_project(project: schemas.ProjectCreate, db: AsyncSession = Depends(get_session)):
    db_project = orm.Project(**project.model_dump())
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)
    return db_project

@router.get("/{project_id}", response_model=schemas.Project)
async def get_project(project_id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(orm.Project).where(orm.Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(orm.Project).where(orm.Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.delete(project)
    await db.commit()
    return {"status": "success"}
