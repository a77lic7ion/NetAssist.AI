# IMPLEMENTATION.md
## Network Staging Intelligence Platform — Step-by-Step Build Guide

---

## Prerequisites

### Developer Environment
- Node.js 20 LTS
- Python 3.11+
- Git
- Windows 10/11 (primary target) or macOS/Linux for development
- Ollama (optional, for AI features): https://ollama.ai

### Install Global Tools
```bash
npm install -g electron-builder vite
pip install poetry
```

---

## Phase 1 — Project Scaffolding & Backend Core
**Estimated time: 2–3 days**

### 1.1 Repository Setup

```bash
mkdir netval && cd netval
git init

# Frontend scaffold
mkdir frontend && cd frontend
npm create vite@latest . -- --template react-ts
npm install

# Additional frontend packages
npm install \
  @xyflow/react \
  zustand \
  @tanstack/react-query \
  @monaco-editor/react \
  tailwindcss \
  axios \
  uuid \
  lucide-react

# Electron packages
npm install --save-dev \
  electron \
  electron-builder \
  @electron-forge/cli \
  concurrently \
  wait-on

cd ../

# Backend scaffold
mkdir backend && cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install \
  fastapi==0.110.0 \
  uvicorn[standard]==0.29.0 \
  sqlalchemy[asyncio]==2.0.29 \
  aiosqlite==0.20.0 \
  pydantic==2.7.0 \
  networkx==3.3 \
  ciscoconfparse2==1.9.47 \
  textfsm==1.1.3 \
  ntc-templates==5.3.0 \
  paramiko==3.4.0 \
  keyring==25.2.0 \
  httpx==0.27.0 \
  python-multipart==0.0.9 \
  jinja2==3.1.3

pip freeze > requirements.txt
```

### 1.2 Backend Foundation

**`backend/config.py`**
```python
from pydantic_settings import BaseSettings
from pathlib import Path
import os

class Settings(BaseSettings):
    app_name: str = "NetVal Backend"
    port: int = 8742
    db_path: str = str(Path.home() / ".netval" / "netval.db")
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    max_ssh_connections: int = 5
    log_level: str = "INFO"

    class Config:
        env_file = ".env"

settings = Settings()
```

**`backend/database.py`**
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from pathlib import Path
from config import settings

# Ensure directory exists
Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{settings.db_path}"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={
        "check_same_thread": False,
        "timeout": 30,
    }
)

async_session = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Set WAL mode
    async with async_session() as session:
        await session.execute("PRAGMA journal_mode=WAL")
        await session.execute("PRAGMA foreign_keys=ON")
        await session.execute("PRAGMA synchronous=NORMAL")
```

**`backend/main.py`**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from api import projects, devices, links, simulation, generation, remediation, ssh, ai as ai_router
from websocket.manager import ws_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="NetVal API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "app://netval"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/v1")
app.include_router(devices.router, prefix="/api/v1")
app.include_router(links.router, prefix="/api/v1")
app.include_router(simulation.router, prefix="/api/v1")
app.include_router(generation.router, prefix="/api/v1")
app.include_router(remediation.router, prefix="/api/v1")
app.include_router(ssh.router, prefix="/api/v1")
app.include_router(ai_router.router, prefix="/api/v1")

@app.get("/health")
async def health():
    from ai.bridge import check_ollama
    return {
        "status": "ok",
        "ollama_available": await check_ollama()
    }
```

### 1.3 ORM Models

**`backend/models/orm.py`**
```python
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
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    devices = relationship("Device", back_populates="project", cascade="all, delete-orphan")
    links = relationship("Link", back_populates="project", cascade="all, delete-orphan")

class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    hostname = Column(String, nullable=False)
    role = Column(String, nullable=False)
    vendor = Column(String, default="cisco")
    platform = Column(String, default="ios-xe")
    management_ip = Column(String)
    canvas_x = Column(Float, default=0)
    canvas_y = Column(Float, default=0)
    credential_ref = Column(String)   # OS keychain reference only
    config_hash = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    project = relationship("Project", back_populates="devices")
    interfaces = relationship("Interface", back_populates="device", cascade="all, delete-orphan")
    vlans = relationship("DeviceVlan", back_populates="device", cascade="all, delete-orphan")

class Interface(Base):
    __tablename__ = "interfaces"
    id = Column(String, primary_key=True, default=gen_uuid)
    device_id = Column(String, ForeignKey("devices.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    mode = Column(String, default="access")
    vlan_access = Column(Integer)
    vlan_trunk_allowed = Column(Text)  # JSON
    ip_address = Column(String)
    ip_mask = Column(String)
    state = Column(String, default="unknown")
    device = relationship("Device", back_populates="interfaces")

class DeviceVlan(Base):
    __tablename__ = "device_vlans"
    device_id = Column(String, ForeignKey("devices.id"), primary_key=True)
    vlan_id = Column(Integer, primary_key=True)
    name = Column(String)
    device = relationship("Device", back_populates="vlans")

class Link(Base):
    __tablename__ = "links"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    source_device_id = Column(String, ForeignKey("devices.id"))
    source_interface = Column(String)
    target_device_id = Column(String, ForeignKey("devices.id"))
    target_interface = Column(String)
    medium = Column(String, default="ethernet")
    vlan_allow_list = Column(Text)  # JSON
    state = Column(String, default="pending")
    project = relationship("Project", back_populates="links")

class ConfigSnapshot(Base):
    __tablename__ = "config_snapshots"
    id = Column(String, primary_key=True, default=gen_uuid)
    device_id = Column(String, ForeignKey("devices.id"), nullable=False)
    raw_config = Column(Text, nullable=False)
    config_hash = Column(String, nullable=False)
    source = Column(String, default="manual")
    taken_at = Column(DateTime, server_default=func.now())

class SimulationJob(Base):
    __tablename__ = "simulation_jobs"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"))
    status = Column(String, default="queued")
    result_json = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String)
    device_id = Column(String)
    action = Column(String, nullable=False)
    actor = Column(String, default="user")
    detail = Column(Text)
    timestamp = Column(DateTime, server_default=func.now())

class RemediationPlan(Base):
    __tablename__ = "remediation_plans"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"))
    plan_json = Column(Text, nullable=False)
    status = Column(String, default="pending")
    applied_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
```

---

## Phase 2 — Simulation Engine
**Estimated time: 3–5 days**

### 2.1 NetworkX Graph Builder

**`backend/engine/graph.py`**
```python
import networkx as nx
import json
from models.orm import Device, Link

class NetworkGraph:
    def __init__(self):
        self.G = nx.Graph()
        self.devices: dict[str, Device] = {}
        self.links: list[Link] = []

    def build(self, devices: list[Device], links: list[Link]) -> "NetworkGraph":
        self.devices = {d.id: d for d in devices}
        self.links = links

        for device in devices:
            self.G.add_node(
                device.id,
                hostname=device.hostname,
                role=device.role,
                interfaces={i.name: i for i in device.interfaces},
                vlans={v.vlan_id for v in device.vlans},
                management_ip=device.management_ip
            )

        for link in links:
            self.G.add_edge(
                link.source_device_id,
                link.target_device_id,
                link_id=link.id,
                source_iface=link.source_interface,
                target_iface=link.target_interface,
                medium=link.medium,
                vlan_allow_list=json.loads(link.vlan_allow_list or "[]")
            )

        return self

    def find_path(self, source_id: str, target_id: str) -> list[str]:
        try:
            return nx.shortest_path(self.G, source_id, target_id)
        except nx.NetworkXNoPath:
            return []

    def get_edges_in_path(self, path: list[str]) -> list[dict]:
        edges = []
        for i in range(len(path) - 1):
            edges.append(self.G.edges[path[i], path[i+1]])
        return edges

    def get_all_paths(self, source_id: str, target_id: str) -> list[list[str]]:
        try:
            return list(nx.all_simple_paths(self.G, source_id, target_id))
        except nx.NetworkXNoPath:
            return []
```

### 2.2 Check Base Class

**`backend/engine/checks/base.py`**
```python
from dataclasses import dataclass, field
from typing import Optional
from engine.graph import NetworkGraph

@dataclass
class CheckResult:
    check_id: str
    severity: str  # "error" | "warning" | "info"
    passed: bool
    device_id: Optional[str] = None
    interface: Optional[str] = None
    detail: str = ""
    suggested_fix: Optional[str] = None

class BaseCheck:
    check_id: str = "BASE"
    name: str = "Base Check"
    severity: str = "error"

    def run(self, graph: NetworkGraph) -> list[CheckResult]:
        raise NotImplementedError
```

### 2.3 VLAN Continuity Check

**`backend/engine/checks/vlan.py`**
```python
import json
from .base import BaseCheck, CheckResult
from engine.graph import NetworkGraph

class VlanContinuityCheck(BaseCheck):
    check_id = "VLAN_CONTINUITY"
    name = "VLAN Trunk Continuity"
    severity = "error"

    def run(self, graph: NetworkGraph) -> list[CheckResult]:
        results = []
        
        for u, v, edge_data in graph.G.edges(data=True):
            allowed = edge_data.get("vlan_allow_list", [])
            source_vlans = graph.G.nodes[u].get("vlans", set())
            target_vlans = graph.G.nodes[v].get("vlans", set())
            
            # Check VLANs referenced in allow list exist on both sides
            for vlan in allowed:
                source_device = graph.devices.get(u)
                target_device = graph.devices.get(v)
                
                if vlan not in source_vlans:
                    results.append(CheckResult(
                        check_id=self.check_id,
                        severity=self.severity,
                        passed=False,
                        device_id=u,
                        interface=edge_data.get("source_iface"),
                        detail=f"VLAN {vlan} in trunk allow-list but missing from device VLAN database",
                        suggested_fix=f"vlan {vlan}\n name VLAN{vlan}"
                    ))
                
                if vlan not in target_vlans:
                    results.append(CheckResult(
                        check_id=self.check_id,
                        severity=self.severity,
                        passed=False,
                        device_id=v,
                        interface=edge_data.get("target_iface"),
                        detail=f"VLAN {vlan} in trunk allow-list but missing from device VLAN database",
                        suggested_fix=f"vlan {vlan}\n name VLAN{vlan}"
                    ))

        return results if results else [CheckResult(
            check_id=self.check_id, severity="info", passed=True,
            detail="All trunk VLANs present on both link endpoints"
        )]


class OrphanSVICheck(BaseCheck):
    check_id = "VLAN_ORPHAN_SVI"
    name = "Orphan SVI Detection"
    severity = "warning"

    def run(self, graph: NetworkGraph) -> list[CheckResult]:
        results = []
        for node_id, data in graph.G.nodes(data=True):
            device = graph.devices.get(node_id)
            if not device:
                continue
            for iface in device.interfaces:
                # SVI = interface Vlan{N}
                if iface.name.lower().startswith("vlan") and iface.ip_address:
                    try:
                        vlan_id = int(iface.name.lower().replace("vlan", "").strip())
                    except ValueError:
                        continue
                    # Check this VLAN is reachable via L2 from this device
                    device_vlans = data.get("vlans", set())
                    if vlan_id not in device_vlans:
                        results.append(CheckResult(
                            check_id=self.check_id,
                            severity=self.severity,
                            passed=False,
                            device_id=node_id,
                            interface=iface.name,
                            detail=f"SVI {iface.name} exists but VLAN {vlan_id} not in device VLAN database",
                            suggested_fix=f"vlan {vlan_id}\n name VLAN{vlan_id}"
                        ))
        return results
```

### 2.4 Wireless Join Chain Check

**`backend/engine/checks/wireless.py`**
```python
from .base import BaseCheck, CheckResult
from engine.graph import NetworkGraph

class WirelessJoinCheck(BaseCheck):
    check_id = "WLC_JOIN_CHAIN"
    name = "AP to WLC Join Chain Validation"
    severity = "error"

    CAPWAP_PORTS = [5246, 5247]

    def run(self, graph: NetworkGraph) -> list[CheckResult]:
        results = []
        
        ap_nodes = [nid for nid, d in graph.G.nodes(data=True) if d.get("role") == "ap"]
        wlc_nodes = [nid for nid, d in graph.G.nodes(data=True) if d.get("role") == "wlc"]
        
        if not ap_nodes or not wlc_nodes:
            return []

        for ap_id in ap_nodes:
            ap_data = graph.G.nodes[ap_id]
            ap_hostname = ap_data.get("hostname", ap_id)
            
            for wlc_id in wlc_nodes:
                path = graph.find_path(ap_id, wlc_id)
                
                if not path:
                    results.append(CheckResult(
                        check_id=self.check_id,
                        severity=self.severity,
                        passed=False,
                        device_id=ap_id,
                        detail=f"No L2/L3 path from AP {ap_hostname} to WLC",
                        suggested_fix="Check physical uplink and trunk configuration"
                    ))
                    continue

                # Walk path and check VLAN continuity for AP VLAN
                edges = graph.get_edges_in_path(path)
                ap_vlan = self._get_ap_vlan(ap_id, graph)
                
                if ap_vlan is None:
                    results.append(CheckResult(
                        check_id=self.check_id,
                        severity=self.severity,
                        passed=False,
                        device_id=ap_id,
                        detail=f"AP {ap_hostname} uplink port has no access VLAN configured",
                        suggested_fix="Configure access VLAN on AP uplink port"
                    ))
                    continue

                for i, edge in enumerate(edges):
                    allowed = edge.get("vlan_allow_list", [])
                    if ap_vlan not in allowed and len(allowed) > 0:
                        hop_device_id = path[i + 1]
                        results.append(CheckResult(
                            check_id=self.check_id,
                            severity=self.severity,
                            passed=False,
                            device_id=hop_device_id,
                            detail=f"AP VLAN {ap_vlan} missing from trunk at hop {i+1} in join path",
                            suggested_fix=f"switchport trunk allowed vlan add {ap_vlan}"
                        ))

                if not results:
                    results.append(CheckResult(
                        check_id=self.check_id,
                        severity="info",
                        passed=True,
                        device_id=ap_id,
                        detail=f"Join chain valid: AP {ap_hostname} → WLC path verified"
                    ))

        return results

    def _get_ap_vlan(self, ap_id: str, graph: NetworkGraph) -> int | None:
        device = graph.devices.get(ap_id)
        if not device:
            return None
        for iface in device.interfaces:
            if iface.mode == "access" and iface.vlan_access:
                return iface.vlan_access
        return None
```

### 2.5 Simulation Orchestrator

**`backend/engine/simulator.py`**
```python
import asyncio
import json
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from engine.graph import NetworkGraph
from engine.checks.vlan import VlanContinuityCheck, OrphanSVICheck
from engine.checks.wireless import WirelessJoinCheck
from engine.checks.base import CheckResult
from models.orm import SimulationJob, Device, Link
from sqlalchemy import select

REGISTERED_CHECKS = [
    VlanContinuityCheck(),
    OrphanSVICheck(),
    WirelessJoinCheck(),
    # Add more checks here
]

async def run_simulation(project_id: str, session: AsyncSession, broadcast_fn=None) -> str:
    job_id = str(uuid.uuid4())
    
    # Create job record
    job = SimulationJob(id=job_id, project_id=project_id, status="running",
                        started_at=datetime.utcnow())
    session.add(job)
    await session.commit()

    try:
        # Load topology
        devices = (await session.execute(
            select(Device).where(Device.project_id == project_id)
        )).scalars().all()
        
        links = (await session.execute(
            select(Link).where(Link.project_id == project_id)
        )).scalars().all()

        # Build graph
        graph = NetworkGraph().build(list(devices), list(links))

        all_results: list[dict] = []
        
        for check in REGISTERED_CHECKS:
            if broadcast_fn:
                await broadcast_fn(job_id, {"event": "check_start", "check": check.check_id})
            
            results: list[CheckResult] = check.run(graph)
            all_results.extend([r.__dict__ for r in results])
            
            if broadcast_fn:
                await broadcast_fn(job_id, {"event": "check_complete", 
                                             "check": check.check_id, 
                                             "results": len(results)})

        # Compute reachability matrix
        reachability = {}
        device_list = list(devices)
        for src in device_list:
            reachability[src.hostname] = {}
            for dst in device_list:
                if src.id != dst.id:
                    path = graph.find_path(src.id, dst.id)
                    reachability[src.hostname][dst.hostname] = len(path) > 0

        result = {
            "job_id": job_id,
            "status": "complete",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": all_results,
            "reachability_matrix": reachability
        }

        job.status = "complete"
        job.result_json = json.dumps(result)
        job.completed_at = datetime.utcnow()
        await session.commit()

        if broadcast_fn:
            await broadcast_fn(job_id, {"event": "complete", "result": result})

    except Exception as e:
        job.status = "failed"
        job.result_json = json.dumps({"error": str(e)})
        job.completed_at = datetime.utcnow()
        await session.commit()
        raise

    return job_id
```

---

## Phase 3 — Configuration Parser & Generator
**Estimated time: 2–3 days**

### 3.1 Cisco Config Parser

**`backend/parser/cisco_parser.py`**
```python
from ciscoconfparse2 import CiscoConfParse
import hashlib
import json

def parse_running_config(raw_config: str) -> dict:
    """Parse IOS-XE running config into canonical device model."""
    parse = CiscoConfParse(raw_config.splitlines(), syntax="ios")
    
    return {
        "config_hash": hashlib.sha256(raw_config.encode()).hexdigest(),
        "hostname": _get_hostname(parse),
        "interfaces": _get_interfaces(parse),
        "vlans": _get_vlans(parse),
        "routing": _get_routing(parse),
        "acls": _get_acls(parse),
    }

def _get_hostname(parse: CiscoConfParse) -> str:
    for obj in parse.find_objects(r"^hostname"):
        return obj.text.split()[-1]
    return "unknown"

def _get_interfaces(parse: CiscoConfParse) -> list[dict]:
    interfaces = []
    for obj in parse.find_objects(r"^interface"):
        iface_name = obj.text.split("interface ")[-1].strip()
        iface = {
            "name": iface_name,
            "description": None,
            "mode": "access",
            "vlan_access": None,
            "vlan_trunk_allowed": [],
            "ip_address": None,
            "ip_mask": None,
            "state": "unknown",
            "shutdown": False,
        }
        
        for child in obj.children:
            text = child.text.strip()
            if text.startswith("description"):
                iface["description"] = text.split("description ")[-1]
            elif text.startswith("switchport mode trunk"):
                iface["mode"] = "trunk"
            elif text.startswith("switchport mode access"):
                iface["mode"] = "access"
            elif text.startswith("switchport access vlan"):
                try:
                    iface["vlan_access"] = int(text.split()[-1])
                except ValueError:
                    pass
            elif text.startswith("switchport trunk allowed vlan"):
                iface["vlan_trunk_allowed"] = _parse_vlan_range(text)
            elif text.startswith("ip address") and "dhcp" not in text:
                parts = text.split()
                if len(parts) >= 4:
                    iface["ip_address"] = parts[2]
                    iface["ip_mask"] = parts[3]
                    iface["mode"] = "routed"
            elif text == "shutdown":
                iface["shutdown"] = True

        if not iface["shutdown"]:
            iface["state"] = "up"
            
        interfaces.append(iface)
    return interfaces

def _get_vlans(parse: CiscoConfParse) -> list[dict]:
    vlans = []
    for obj in parse.find_objects(r"^vlan \d"):
        try:
            vlan_id = int(obj.text.split()[-1])
            name = None
            for child in obj.children:
                if "name" in child.text:
                    name = child.text.strip().split("name ")[-1]
            vlans.append({"vlan_id": vlan_id, "name": name})
        except ValueError:
            continue
    return vlans

def _get_routing(parse: CiscoConfParse) -> dict:
    protocols = []
    if parse.find_objects(r"^router ospf"):
        protocols.append("ospf")
    if parse.find_objects(r"^router bgp"):
        protocols.append("bgp")
    if parse.find_objects(r"^router eigrp"):
        protocols.append("eigrp")
    
    static_routes = []
    for obj in parse.find_objects(r"^ip route"):
        static_routes.append(obj.text.strip())
    
    return {"protocols": protocols, "static_routes": static_routes}

def _get_acls(parse: CiscoConfParse) -> list[dict]:
    acls = []
    for obj in parse.find_objects(r"^ip access-list"):
        acl = {"name": obj.text, "entries": []}
        for child in obj.children:
            acl["entries"].append(child.text.strip())
        acls.append(acl)
    return acls

def _parse_vlan_range(text: str) -> list[int]:
    """Parse 'switchport trunk allowed vlan 10,20-30,40' into flat list."""
    vlans = []
    try:
        vlan_str = text.split("vlan ")[-1].strip()
        if vlan_str in ("add", "remove", "none", "all"):
            return vlans
        # Handle 'add' keyword
        vlan_str = vlan_str.replace("add ", "")
        for part in vlan_str.split(","):
            if "-" in part:
                start, end = part.split("-")
                vlans.extend(range(int(start), int(end) + 1))
            else:
                vlans.append(int(part.strip()))
    except (ValueError, IndexError):
        pass
    return vlans
```

### 3.2 CLI Generator with Jinja2

**`backend/generator/cisco_xe.py`**
```python
from jinja2 import Environment, PackageLoader
import json

INTERFACE_TEMPLATE = """
interface {{ interface.name }}
 description {{ interface.description or 'No description' }}
{%- if interface.mode == 'trunk' %}
 switchport mode trunk
 switchport trunk encapsulation dot1q
 switchport trunk allowed vlan {{ interface.vlan_trunk_allowed | join(',') }}
{%- elif interface.mode == 'access' %}
 switchport mode access
 switchport access vlan {{ interface.vlan_access or 1 }}
{%- elif interface.mode == 'routed' %}
 no switchport
 ip address {{ interface.ip_address }} {{ interface.ip_mask }}
{%- endif %}
 no shutdown
!
"""

VLAN_TEMPLATE = """
{%- for vlan in vlans %}
vlan {{ vlan.vlan_id }}
 name {{ vlan.name or 'VLAN' + vlan.vlan_id|string }}
!
{%- endfor %}
"""

def generate_device_config(device: dict) -> str:
    """Generate IOS-XE CLI block for a device."""
    from jinja2 import Template
    
    sections = []
    
    # Hostname
    sections.append(f"hostname {device['hostname']}\n!")
    
    # VLANs
    if device.get("vlans"):
        t = Template(VLAN_TEMPLATE)
        sections.append(t.render(vlans=device["vlans"]))
    
    # Interfaces
    t = Template(INTERFACE_TEMPLATE)
    for iface in device.get("interfaces", []):
        sections.append(t.render(interface=iface))
    
    # Footer
    sections.append("!\nend")
    
    return "\n".join(sections)
```

---

## Phase 4 — SSH Manager & Credentials
**Estimated time: 1–2 days**

**`backend/ssh/credentials.py`**
```python
import keyring
import uuid
import json
from typing import Optional

SERVICE_NAME = "netval-app"

def store_credential(project_id: str, device_id: str, 
                     username: str, password: str = None,
                     key_path: str = None) -> str:
    """Store SSH credential in OS keychain. Returns reference UUID."""
    ref = str(uuid.uuid4())
    credential = {"username": username}
    if password:
        credential["password"] = password
    if key_path:
        credential["key_path"] = key_path
    
    keyring.set_password(
        SERVICE_NAME,
        f"{project_id}:{device_id}:{ref}",
        json.dumps(credential)
    )
    return ref

def get_credential(project_id: str, device_id: str, ref: str) -> Optional[dict]:
    """Retrieve SSH credential from OS keychain."""
    raw = keyring.get_password(SERVICE_NAME, f"{project_id}:{device_id}:{ref}")
    if raw:
        return json.loads(raw)
    return None

def delete_credential(project_id: str, device_id: str, ref: str):
    keyring.delete_password(SERVICE_NAME, f"{project_id}:{device_id}:{ref}")
```

**`backend/ssh/manager.py`**
```python
import paramiko
import asyncio
from concurrent.futures import ThreadPoolExecutor
from ssh.credentials import get_credential
from ssh.commands import SHOW_COMMANDS

executor = ThreadPoolExecutor(max_workers=5)

def _ssh_execute_sync(hostname: str, cred: dict, commands: list[str]) -> dict[str, str]:
    """Synchronous SSH execution (runs in thread pool)."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    connect_kwargs = {
        "hostname": hostname,
        "username": cred["username"],
        "timeout": 30,
    }
    
    if "key_path" in cred:
        connect_kwargs["key_filename"] = cred["key_path"]
    elif "password" in cred:
        connect_kwargs["password"] = cred["password"]
    
    results = {}
    try:
        client.connect(**connect_kwargs)
        for cmd in commands:
            stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
            results[cmd] = stdout.read().decode("utf-8", errors="replace")
    finally:
        client.close()
    
    return results

async def ingest_device(project_id: str, device_id: str, management_ip: str, 
                         credential_ref: str) -> dict:
    """Async SSH ingestion of device configuration."""
    cred = get_credential(project_id, device_id, credential_ref)
    if not cred:
        raise ValueError("No credentials found for device")
    
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(
        executor,
        _ssh_execute_sync,
        management_ip,
        cred,
        list(SHOW_COMMANDS.keys())
    )
    
    return results

async def push_config(management_ip: str, cred: dict, config_block: str) -> bool:
    """Push configuration block via SSH."""
    def _push():
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        connect_kwargs = {"hostname": management_ip, "username": cred["username"], "timeout": 30}
        if "key_path" in cred:
            connect_kwargs["key_filename"] = cred["key_path"]
        elif "password" in cred:
            connect_kwargs["password"] = cred["password"]
        
        try:
            client.connect(**connect_kwargs)
            channel = client.invoke_shell()
            channel.send("configure terminal\n")
            for line in config_block.splitlines():
                channel.send(line + "\n")
                asyncio.sleep(0.1)
            channel.send("end\n")
            channel.send("write memory\n")
            return True
        finally:
            client.close()
    
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, _push)
```

---

## Phase 5 — Frontend Canvas & UI
**Estimated time: 3–4 days**

### 5.1 Electron Main Process

**`frontend/electron/main.js`**
```javascript
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow = null
let backendProcess = null

function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'netval-backend.exe')
  }
  return null // Use dev server
}

async function startBackend() {
  const backendExe = getBackendPath()
  
  if (backendExe) {
    backendProcess = spawn(backendExe, [], { stdio: 'pipe' })
  } else {
    // Dev mode: Python must be started manually or via dev.sh
    console.log('[main] Dev mode: assuming backend running on :8742')
    return
  }

  backendProcess.stdout.on('data', d => console.log(`[backend] ${d}`))
  backendProcess.stderr.on('data', d => console.error(`[backend] ${d}`))
  
  // Wait for backend ready
  await new Promise(resolve => setTimeout(resolve, 2000))
}

async function createWindow() {
  await startBackend()
  
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a'
  })

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  } else {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  }
}

app.whenReady().then(createWindow)

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

### 5.2 React Flow Node Components

**`frontend/src/canvas/nodes/SwitchNode.tsx`**
```tsx
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Network, AlertCircle, CheckCircle, Clock } from 'lucide-react'

type NodeState = 'connected' | 'misconfigured' | 'pending'

const stateColors: Record<NodeState, string> = {
  connected: 'border-green-500 shadow-green-500/20',
  misconfigured: 'border-red-500 shadow-red-500/20',
  pending: 'border-yellow-500 shadow-yellow-500/20',
}

const StateIcon = ({ state }: { state: NodeState }) => {
  if (state === 'connected') return <CheckCircle className="w-3 h-3 text-green-400" />
  if (state === 'misconfigured') return <AlertCircle className="w-3 h-3 text-red-400" />
  return <Clock className="w-3 h-3 text-yellow-400" />
}

export function SwitchNode({ data, selected }: NodeProps) {
  const state = (data.state as NodeState) || 'pending'
  
  return (
    <div className={`
      relative w-32 bg-slate-800 border-2 rounded-xl p-3 
      shadow-lg cursor-pointer transition-all duration-200
      ${stateColors[state]}
      ${selected ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900' : ''}
    `}>
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
      <Handle type="target" position={Position.Left} className="!bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
      
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <Network className="w-5 h-5 text-blue-400" />
          <StateIcon state={state} />
        </div>
        <span className="text-xs text-white font-mono font-medium truncate w-full text-center">
          {data.hostname || 'Switch'}
        </span>
        <span className="text-xs text-slate-400">{data.role}</span>
      </div>
    </div>
  )
}
```

### 5.3 Animated Edge Component

**`frontend/src/canvas/edges/AnimatedEdge.tsx`**
```tsx
import { BaseEdge, EdgeProps, getSmoothStepPath } from '@xyflow/react'

const mediumColors = {
  ethernet: { stroke: '#22c55e', glow: '#22c55e33' },
  fibre: { stroke: '#f97316', glow: '#f9731633' },
}

const stateColors = {
  connected: 'mediumColors',
  misconfigured: { stroke: '#ef4444', glow: '#ef444433' },
  pending: { stroke: '#eab308', glow: '#eab30833' },
}

export function AnimatedNetworkEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const medium = (data?.medium as string) || 'ethernet'
  const state = (data?.state as string) || 'pending'
  
  const color = state === 'misconfigured' 
    ? '#ef4444' 
    : state === 'pending'
    ? '#eab308'
    : mediumColors[medium as keyof typeof mediumColors]?.stroke || '#22c55e'

  return (
    <>
      {/* Glow layer */}
      <BaseEdge
        id={`${id}-glow`}
        path={edgePath}
        style={{ stroke: color, strokeWidth: 6, opacity: 0.3, filter: 'blur(3px)' }}
      />
      {/* Main edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: color, strokeWidth: 2 }}
        markerEnd="url(#arrowhead)"
      />
      {/* Animated flow */}
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray="8 16"
        strokeOpacity={0.8}
        style={{
          animation: 'flow 1.5s linear infinite',
        }}
      />
    </>
  )
}
```

---

## Phase 6 — AI Bridge, Remediation & Polish
**Estimated time: 2–3 days**

### 6.1 Ollama Bridge

**`backend/ai/bridge.py`**
```python
import httpx
from config import settings
from ai.prompts import EXPLAIN_FAILURE_PROMPT, SUGGEST_FIX_PROMPT

async def check_ollama() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{settings.ollama_url}/api/tags")
            return r.status_code == 200
    except Exception:
        return False

async def explain_failure(check_result: dict) -> str:
    if not await check_ollama():
        return "AI explanation unavailable. Install Ollama to enable this feature."
    
    prompt = EXPLAIN_FAILURE_PROMPT.format(
        check_id=check_result.get("check_id"),
        detail=check_result.get("detail"),
        suggested_fix=check_result.get("suggested_fix", "None")
    )
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{settings.ollama_url}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 300}
            }
        )
        data = response.json()
        return data.get("response", "Unable to generate explanation.")
```

**`backend/ai/prompts.py`**
```python
EXPLAIN_FAILURE_PROMPT = """You are a Cisco network engineer assistant.
A network validation check has failed. Explain this to a junior engineer in plain English.
Be concise (3-4 sentences max). Focus on WHY it matters and HOW to fix it.

Check ID: {check_id}
Issue Detected: {detail}
Suggested CLI Fix: {suggested_fix}

Explanation:"""

SUGGEST_FIX_PROMPT = """You are a Cisco IOS-XE expert.
Generate only the CLI configuration block to fix the following issue.
Output ONLY valid IOS-XE commands, no explanation.

Issue: {detail}
Device Role: {role}
Platform: {platform}

CLI fix:"""
```

---

## Phase 7 — Testing
**Estimated time: 2 days**

### Unit Tests (pytest)

```python
# backend/tests/unit/test_vlan_check.py
import pytest
from engine.graph import NetworkGraph
from engine.checks.vlan import VlanContinuityCheck

def make_graph_with_vlan_gap():
    """Create a graph where VLAN 30 exists on trunk but missing from device DB."""
    # Use mock Device/Link objects
    ...

def test_vlan_continuity_detects_missing_vlan():
    graph = make_graph_with_vlan_gap()
    check = VlanContinuityCheck()
    results = check.run(graph)
    failures = [r for r in results if not r.passed]
    assert len(failures) > 0
    assert any("VLAN 30" in r.detail for r in failures)

def test_vlan_continuity_passes_clean_topology():
    graph = make_clean_graph()
    check = VlanContinuityCheck()
    results = check.run(graph)
    assert all(r.passed for r in results)
```

### Parser Tests

```python
# backend/tests/unit/test_parser.py
SAMPLE_CONFIG = """
hostname SW-CORE-01
!
vlan 10
 name Management
vlan 20
 name Data
!
interface GigabitEthernet1/0/1
 description Uplink to Core
 switchport mode trunk
 switchport trunk allowed vlan 10,20
!
"""

def test_parse_hostname():
    result = parse_running_config(SAMPLE_CONFIG)
    assert result["hostname"] == "SW-CORE-01"

def test_parse_vlans():
    result = parse_running_config(SAMPLE_CONFIG)
    vlan_ids = [v["vlan_id"] for v in result["vlans"]]
    assert 10 in vlan_ids and 20 in vlan_ids

def test_parse_trunk_interface():
    result = parse_running_config(SAMPLE_CONFIG)
    ifaces = {i["name"]: i for i in result["interfaces"]}
    gig = ifaces.get("GigabitEthernet1/0/1")
    assert gig is not None
    assert gig["mode"] == "trunk"
    assert 10 in gig["vlan_trunk_allowed"]
```

---

## Build & Distribution

### Dev Mode

```bash
# Terminal 1: Backend
cd backend && uvicorn main:app --port 8742 --reload

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Electron (connects to Vite dev server)
cd frontend && npm run electron:dev
```

### Production Build

```bash
# Build frontend
cd frontend && npm run build

# Freeze Python backend
cd backend && pyinstaller --onefile --name netval-backend main.py

# Move backend binary to Electron resources
mkdir -p frontend/resources/backend
cp backend/dist/netval-backend.exe frontend/resources/backend/

# Build Electron installer
cd frontend && npm run electron:build
```

### `package.json` Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "electron:dev": "wait-on http://localhost:5173 && electron .",
    "electron:build": "npm run build && electron-builder",
    "start": "concurrently \"npm run dev\" \"npm run electron:dev\""
  },
  "build": {
    "appId": "com.netval.app",
    "productName": "NetVal",
    "directories": { "output": "dist-electron" },
    "extraResources": [
      { "from": "resources/backend", "to": "backend", "filter": ["**/*"] }
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

---

## Implementation Sequence Summary

| Phase | Duration | Deliverable |
|---|---|---|
| 1. Scaffolding + DB | 2–3 days | Running FastAPI + React skeleton |
| 2. Simulation Engine | 3–5 days | Working check system on test topology |
| 3. Parser + Generator | 2–3 days | Cisco config round-trip working |
| 4. SSH Manager | 1–2 days | SSH ingest + push working locally |
| 5. Frontend Canvas | 3–4 days | Interactive topology editor |
| 6. AI + Remediation | 2–3 days | Full loop: detect → suggest → apply |
| 7. Testing + Polish | 2 days | Test coverage + UX polish |
| **Total** | **~3 weeks** | **Shippable v1.0** |
