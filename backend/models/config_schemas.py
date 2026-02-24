from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ConfigUpload(BaseModel):
    content: str

class DeviceConfig(BaseModel):
    id: str
    device_id: str
    raw_config: str
    config_hash: str
    source: str
    taken_at: datetime

    class Config:
        from_attributes = True
