from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any, Union
from datetime import datetime
import json
import uuid

# --- Common ---
class HealthCheck(BaseModel):
    status: str
    ollama_available: bool

# --- AI ---
class AISettings(BaseModel):
    provider: str
    model: str
    base_url: Optional[str] = None
    api_key: Optional[str] = None

class AIModelList(BaseModel):
    models: List[str]

class AITestRequest(BaseModel):
    provider: str
    base_url: Optional[str] = None
    api_key: Optional[str] = None

class AITestResponse(BaseModel):
    success: bool
    message: str

# --- Projects ---
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Devices ---
class DeviceBase(BaseModel):
    hostname: str
    role: str
    vendor: str = "cisco"
    platform: str = "ios-xe"
    management_ip: Optional[str] = None
    canvas_x: float = 0
    canvas_y: float = 0

class DeviceCreate(DeviceBase):
    pass

class Device(DeviceBase):
    id: str
    project_id: str
    credential_ref: Optional[str] = None
    config_hash: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Links ---
class LinkBase(BaseModel):
    source_device_id: str
    source_interface: str
    target_device_id: str
    target_interface: str
    medium: str = "ethernet"
    vlan_allow_list: Optional[Union[List[int], str]] = []

    @field_validator('vlan_allow_list', mode='before')
    def parse_vlan_list(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except:
                return []
        return v

class LinkCreate(LinkBase):
    pass

class Link(LinkBase):
    id: str
    project_id: str
    state: str
    
    class Config:
        from_attributes = True
