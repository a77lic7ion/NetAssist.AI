from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List
import httpx
from config import settings
from models.schemas import AISettings, AIModelList, AITestRequest, AITestResponse
from ai import bridge

router = APIRouter(prefix="/ai", tags=["ai"])

@router.get("/settings", response_model=AISettings)
async def get_ai_settings():
    return AISettings(
        provider=settings.llm_provider,
        model=settings.llm_model,
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key
    )

@router.post("/settings", response_model=AISettings)
async def update_ai_settings(config: AISettings):
    # In a real app, we'd save this to a persistent config file or DB
    # For now, we update the in-memory settings
    settings.llm_provider = config.provider
    settings.llm_model = config.model
    settings.llm_base_url = config.base_url
    settings.llm_api_key = config.api_key
    return config

@router.get("/models/{provider}", response_model=AIModelList)
async def list_models(provider: str):
    models = await bridge.get_available_models(provider)
    return AIModelList(models=models)

@router.post("/test", response_model=AITestResponse)
async def test_connection(request: AITestRequest):
    success, message, models = await bridge.test_provider_connection(
        provider=request.provider,
        base_url=request.base_url,
        api_key=request.api_key
    )
    return AITestResponse(success=success, message=message, models=models)
