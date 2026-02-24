---
name: Skills
description: This document enumerates every technical skill an AI agent or developer needs to build this application, with code-level examples for non-obvious patterns.
---

# SKILLS.md
## Network Staging Intelligence Platform — Required Skills Reference

This document enumerates every technical skill an AI agent or developer needs to build this application, with code-level examples for non-obvious patterns.

---

## SKILL 1 — FastAPI Async Backend Architecture

### What You Must Know
FastAPI is async-native. Every database call, SSH call, and file operation must be `await`-ed inside `async def` endpoints. Never use blocking calls in endpoint handlers.

### Pattern: Async endpoint with DB dependency
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session

router = APIRouter()

@router.get("/projects/{project_id}")
async def get_project(project_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.get(Project, project_id)
    if not result:
        raise HTTPException(status_code=404, detail="Project not found")
    return result
```

### Pattern: Background job via asyncio Task
```python
import asyncio

@router.post("/projects/{project_id}/validate")
async def trigger_validation(project_id: str, session: AsyncSession = Depends(get_session)):
    job_id = str(uuid.uuid4())
    # Fire and forget — do not await the simulation
    asyncio.create_task(run_simulation(project_id, session))
    return {"job_id": job_id, "status": "queued"}
```

### Pattern: WebSocket broadcaster
```python
from fastapi import WebSocket
from typing import dict

class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, job_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(job_id, []).append(ws)

    async def broadcast(self, job_id: str, data: dict):
        for ws in self.active.get(job_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass

    def disconnect(self, job_id: str, ws: WebSocket):
        if job_id in self.active:
            self.active[job_id].discard(ws)
```

---

## SKILL 2 — SQLAlchemy 2.0 Async ORM

### What You Must Know
SQLAlchemy 2.0 has a fundamentally different async API. Always use `async with engine.begin()` for DDL and `async with async_session()` for queries.

### Pattern: Query with relationship loading
```python
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def get_project_with_devices(project_id: str, session: AsyncSession):
    stmt = (
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.devices).selectinload(Device.interfaces),
            selectinload(Project.links)
        )
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()
```

### Pattern: Bulk insert
```python
async def bulk_insert_interfaces(interfaces: list[dict], session: AsyncSession):
    objects = [Interface(**iface) for iface in interfaces]
    session.add_all(objects)
    await session.commit()
```

---

## SKILL 3 — NetworkX for Network Graph Analysis

### What You Must Know
NetworkX is the Python standard for graph algorithms. The topology IS a graph. All routing simulation runs on it.

### Pattern: Build graph and find paths
```python
import networkx as nx

G = nx.Graph()
G.add_node("SW1", vlans={10, 20, 30}, role="switch")
G.add_node("SW2", vlans={10, 20}, role="switch")
G.add_node("WLC", vlans={10}, role="wlc")

G.add_edge("SW1", "SW2", vlan_allow_list=[10, 20, 30])
G.add_edge("SW2", "WLC", vlan_allow_list=[10])

# Shortest path
path = nx.shortest_path(G, "SW1", "WLC")
# → ["SW1", "SW2", "WLC"]

# All paths (for redundancy analysis)
all_paths = list(nx.all_simple_paths(G, "SW1", "WLC"))

# Check connectivity
is_connected = nx.has_path(G, "SW1", "WLC")

# Find nodes with specific role
wlcs = [n for n, d in G.nodes(data=True) if d.get("role") == "wlc"]
```

### Pattern: VLAN path validation across hops
```python
def vlan_reachable(G: nx.Graph, source: str, target: str, vlan: int) -> tuple[bool, str]:
    path = nx.shortest_path(G, source, target)
    for i in range(len(path) - 1):
        edge = G.edges[path[i], path[i+1]]
        allowed = edge.get("vlan_allow_list", [])
        if allowed and vlan not in allowed:
            return False, f"VLAN {vlan} blocked at hop {path[i]} → {path[i+1]}"
    return True, "reachable"
```

---

## SKILL 4 — ciscoconfparse2 for IOS Config Parsing

### What You Must Know
`ciscoconfparse2` models IOS config as a parent-child tree. `find_objects` returns parent stanzas; `.children` returns nested config lines.

### Pattern: Extract interface details
```python
from ciscoconfparse2 import CiscoConfParse

config_text = """
interface GigabitEthernet1/0/1
 description Uplink
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30
!
"""

parse = CiscoConfParse(config_text.splitlines(), syntax="ios")

for obj in parse.find_objects(r"^interface"):
    print(f"Interface: {obj.text}")
    for child in obj.children:
        print(f"  → {child.text.strip()}")
```

### Pattern: Find interfaces with specific properties
```python
# Find all trunk interfaces
trunk_ifaces = parse.find_objects_w_child_matching_re(
    r"^interface",
    r"switchport mode trunk"
)

# Find SVIs (Layer 3 interfaces)
svis = [obj for obj in parse.find_objects(r"^interface Vlan")]

# Check if IP routing is enabled
ip_routing = bool(parse.find_objects(r"^ip routing"))
```

---

## SKILL 5 — Paramiko SSH Automation

### What You Must Know
Paramiko is synchronous. Always run in a ThreadPoolExecutor to avoid blocking the asyncio event loop. Never hardcode timeouts below 15s for real devices.

### Pattern: Safe async SSH execution
```python
import paramiko
import asyncio
from concurrent.futures import ThreadPoolExecutor

_pool = ThreadPoolExecutor(max_workers=5)

def _run_commands(host: str, username: str, password: str, commands: list) -> dict:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    results = {}
    try:
        client.connect(host, username=username, password=password, timeout=15)
        for cmd in commands:
            _, stdout, _ = client.exec_command(cmd, timeout=30)
            results[cmd] = stdout.read().decode("utf-8", errors="replace")
    finally:
        client.close()
    return results

async def ssh_run_async(host, username, password, commands):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _pool, _run_commands, host, username, password, commands
    )
```

### Pattern: Config push with config terminal
```python
def push_config_sync(host, cred, config_lines: list[str]) -> str:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=cred["username"], password=cred.get("password"), timeout=15)
    
    shell = client.invoke_shell()
    shell.settimeout(30)
    
    def send_wait(cmd: str, delay=0.5):
        shell.send(cmd + "\n")
        import time; time.sleep(delay)
        output = b""
        while shell.recv_ready():
            output += shell.recv(4096)
        return output.decode("utf-8", errors="replace")
    
    output = []
    output.append(send_wait("configure terminal"))
    for line in config_lines:
        output.append(send_wait(line))
    output.append(send_wait("end"))
    output.append(send_wait("write memory", delay=2))
    
    client.close()
    return "\n".join(output)
```

---

## SKILL 6 — keyring for Credential Management

### What You Must Know
`keyring` wraps the OS native secret storage (Windows Credential Manager, macOS Keychain, Linux Secret Service). NEVER store passwords in files or environment variables.

```python
import keyring
import json

# Store
keyring.set_password("myapp", "device:abc123", json.dumps({
    "username": "admin",
    "password": "s3cr3t"
}))

# Retrieve
raw = keyring.get_password("myapp", "device:abc123")
cred = json.loads(raw) if raw else None

# Delete
keyring.delete_password("myapp", "device:abc123")
```

### Common Gotcha
On headless Windows Server without a GUI keyring backend, fall back to `keyrings.alt.file.PlaintextKeyring` with encryption applied manually (but prefer avoiding headless deployment).

---

## SKILL 7 — React Flow (Topology Canvas)

### What You Must Know
React Flow v11 uses `@xyflow/react`. Nodes and edges are controlled by React state. Custom nodes are registered via `nodeTypes`. Custom edges via `edgeTypes`.

### Pattern: Controlled canvas with Zustand
```tsx
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTopologyStore } from '../store/topology'
import { SwitchNode } from './nodes/SwitchNode'
import { AnimatedNetworkEdge } from './edges/AnimatedEdge'

const nodeTypes = {
  switch: SwitchNode,
  router: RouterNode,
  wlc: WLCNode,
  ap: APNode,
}

const edgeTypes = {
  network: AnimatedNetworkEdge,
}

export function TopologyCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useTopologyStore()

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
    >
      <Background variant="dots" gap={20} color="#334155" />
      <Controls />
      <MiniMap nodeColor="#3b82f6" maskColor="#0f172a99" />
    </ReactFlow>
  )
}
```

### Pattern: Zustand topology store
```tsx
import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, addEdge, Node, Edge } from '@xyflow/react'

interface TopologyState {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  onConnect: (connection: any) => void
  addDevice: (device: Partial<Node>) => void
  syncFromServer: (topology: { nodes: Node[], edges: Edge[] }) => void
}

export const useTopologyStore = create<TopologyState>((set, get) => ({
  nodes: [],
  edges: [],
  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (connection) =>
    set({ edges: addEdge({ ...connection, type: 'network' }, get().edges) }),
  addDevice: (device) =>
    set({ nodes: [...get().nodes, { id: uuid(), type: device.type || 'switch', ...device } as Node] }),
  syncFromServer: (topology) =>
    set({ nodes: topology.nodes, edges: topology.edges }),
}))
```

---

## SKILL 8 — TanStack Query for Backend State

### What You Must Know
Server state (validation results, projects, device configs) lives in the backend, not React state. TanStack Query (React Query) manages caching, refetching, and optimistic updates.

### Pattern: Query + mutation pattern
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

// Fetch project list
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })
}

// Trigger validation
export function useValidate(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/validate`).then(r => r.data),
    onSuccess: (data) => {
      // Invalidate job cache so polling begins
      client.invalidateQueries({ queryKey: ['job', data.job_id] })
    }
  })
}

// Poll job status
export function useJob(jobId: string | null) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then(r => r.data),
    enabled: !!jobId,
    refetchInterval: (data) => data?.status === 'complete' ? false : 1000,
  })
}
```

---

## SKILL 9 — Electron IPC & Sidecar Process Management

### What You Must Know
Electron has two processes: `main` (Node.js, can spawn child processes) and `renderer` (Chromium, runs React). They communicate via IPC or via preload bridge. Never expose `require` to renderer directly.

### Pattern: Preload bridge (secure)
```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
})
```

```javascript
// main.js
const { ipcMain, shell } = require('electron')

ipcMain.handle('get-version', () => app.getVersion())
ipcMain.handle('open-external', (_, url) => shell.openExternal(url))
```

```tsx
// React component
declare global {
  interface Window {
    electronAPI: { getAppVersion: () => Promise<string> }
  }
}

const version = await window.electronAPI.getAppVersion()
```

---

## SKILL 10 — Jinja2 for CLI Template Generation

### What You Must Know
Jinja2 templates must produce deterministic output. Use `trim_blocks=True` and `lstrip_blocks=True` to control whitespace. Never allow user input to reach template rendering unsanitized.

### Pattern: Deterministic VLAN template
```python
from jinja2 import Environment

env = Environment(trim_blocks=True, lstrip_blocks=True)

TEMPLATE = """
{% for vlan in vlans | sort(attribute='vlan_id') %}
vlan {{ vlan.vlan_id }}
 name {{ vlan.name }}
!
{% endfor %}
""".strip()

def render_vlan_block(vlans: list[dict]) -> str:
    t = env.from_string(TEMPLATE)
    return t.render(vlans=vlans)
```

---

## SKILL 11 — PyInstaller Packaging

### What You Must Know
PyInstaller freezes Python into a standalone executable. Hidden imports must be declared explicitly for dynamic imports (e.g., textfsm templates, keyring backends).

### `netval.spec` (PyInstaller spec file)
```python
block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=['.'],
    hiddenimports=[
        'keyring.backends.Windows',
        'keyring.backends.fail',
        'ntc_templates',
        'textfsm',
        'ciscoconfparse2',
        'aiosqlite',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
    ],
    datas=[
        ('ntc_templates/templates', 'ntc_templates/templates'),
    ],
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(pyz, a.scripts, a.binaries, a.zipfiles, a.datas,
          name='netval-backend', console=False)
```

---

## SKILL 12 — WebSocket Streaming in React

### What You Must Know
Use a persistent WebSocket connection for live simulation progress. Reconnect on drop. Never use polling when WebSocket is available.

### Pattern: React WebSocket hook
```tsx
import { useEffect, useRef, useCallback } from 'react'

export function useSimulationWS(jobId: string | null, onEvent: (event: any) => void) {
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!jobId) return

    const ws = new WebSocket(`ws://localhost:8742/ws/simulation/${jobId}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data))
      } catch {}
    }

    ws.onerror = () => console.error('WS error')
    ws.onclose = () => { wsRef.current = null }

    return () => ws.close()
  }, [jobId])
}
```

---

## SKILL 13 — Monaco Editor Integration

### What You Must Know
Monaco Editor (VSCode's editor) requires special Webpack/Vite configuration to handle Web Workers. Use the `@monaco-editor/react` wrapper to avoid that complexity.

```tsx
import Editor from '@monaco-editor/react'

export function ConfigEditor({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  return (
    <Editor
      height="400px"
      language="text"
      theme="vs-dark"
      value={value}
      onChange={(v) => onChange(v || '')}
      options={{
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        readOnly: false,
      }}
    />
  )
}
```

---

## SKILL 14 — Testing with pytest-asyncio

### What You Must Know
All backend tests touching async code need `pytest-asyncio` and an async test fixture for the DB session.

### Pattern: Async test with in-memory SQLite
```python
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from database import Base

@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        yield s
    
    await engine.dispose()

@pytest.mark.asyncio
async def test_create_project(session: AsyncSession):
    project = Project(name="Test Project")
    session.add(project)
    await session.commit()
    
    result = await session.get(Project, project.id)
    assert result.name == "Test Project"
```

---

## Common Pitfalls & How to Avoid Them

| Pitfall | Symptom | Fix |
|---|---|---|
| Blocking call in async endpoint | Event loop freezes under load | Wrap in `run_in_executor` |
| SQLite WAL mode not set | Concurrent reads block writes | Set `PRAGMA journal_mode=WAL` at startup |
| Electron `nodeIntegration: true` | Security vulnerability | Always use `contextBridge` preload pattern |
| React Flow node handles overlap | Cannot create links | Use explicit `id` on each Handle |
| PyInstaller missing ntc-templates | `FileNotFoundError` at runtime | Add template dir to `datas` in spec file |
| keyring not finding backend | Silent credential fail | Test with `keyring.get_keyring()` at startup |
| Ollama timeout brings down endpoint | AI requests fail the whole response | Always wrap Ollama calls with `timeout=30` and `try/except` |
| ciscoconfparse2 line endings | Empty parse results | Normalize `\r\n` → `\n` before parsing |