from sqlalchemy import Column, String, Float, Integer, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid

def gen_uuid():
    return str(uuid.uuid4())

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    description = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    devices = relationship("Device", back_populates="project", cascade="all, delete-orphan")
    links = relationship("Link", back_populates="project", cascade="all, delete-orphan")

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    hostname = Column(String, nullable=False)
    role = Column(String, nullable=False)
    vendor = Column(String, default="cisco")
    platform = Column(String, default="ios-xe")
    management_ip = Column(String)
    canvas_x = Column(Float)
    canvas_y = Column(Float)
    credential_ref = Column(String)
    config_hash = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    project = relationship("Project", back_populates="devices")
    interfaces = relationship("Interface", back_populates="device", cascade="all, delete-orphan")
    vlans = relationship("DeviceVlan", back_populates="device", cascade="all, delete-orphan")
    configurations = relationship("DeviceConfig", back_populates="device", cascade="all, delete-orphan")

class DeviceConfig(Base):
    __tablename__ = "device_configs"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    device_id = Column(String, ForeignKey("devices.id", ondelete="CASCADE"))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    device = relationship("Device", back_populates="configurations")

class Interface(Base):
    __tablename__ = "interfaces"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    device_id = Column(String, ForeignKey("devices.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)
    description = Column(String)
    mode = Column(String, default="access")
    vlan_access = Column(Integer)
    vlan_trunk_allowed = Column(Text) # JSON array
    ip_address = Column(String)
    ip_mask = Column(String)
    state = Column(String, default="unknown")
    
    device = relationship("Device", back_populates="interfaces")

class DeviceVlan(Base):
    __tablename__ = "device_vlans"
    
    device_id = Column(String, ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    vlan_id = Column(Integer, primary_key=True)
    name = Column(String)
    
    device = relationship("Device", back_populates="vlans")

class Link(Base):
    __tablename__ = "links"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    source_device_id = Column(String, ForeignKey("devices.id"))
    source_interface = Column(String)
    target_device_id = Column(String, ForeignKey("devices.id"))
    target_interface = Column(String)
    medium = Column(String, default="ethernet")
    vlan_allow_list = Column(Text) # JSON array
    state = Column(String, default="pending")
    
    project = relationship("Project", back_populates="links")
