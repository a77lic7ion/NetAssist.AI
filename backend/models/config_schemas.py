from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ConfigUpload(BaseModel):
    content: str

class DeviceConfig(BaseModel):
    id: str
    device_id: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
