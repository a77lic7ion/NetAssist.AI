# Network Staging Intelligence Platform
## Production Blueprint v1.0

---

## Design Review & Corrected Architecture

### Errors & Gaps Found in Original Design

The following issues were identified and corrected in this blueprint:

**Critical Architecture Gaps**

1. **Missing IPC Contract** — The original spec never defined how Electron talks to the Python backend. Assumed "localhost service" is insufficient. This blueprint mandates a FastAPI REST + WebSocket hybrid layer with a defined OpenAPI contract.

2. **Credential Storage Misdesign** — Storing encrypted credentials in SQLite is fragile and non-standard. This blueprint uses the OS native keychain (`keyring` Python library) with only credential *references* (UUIDs) stored in SQLite.

3. **No Config Parser Library Specified** — The original spec says "parser extracts interfaces, VLANs…" but names no parser. This blueprint mandates `ntc-templates` + `textfsm` for structured CLI output parsing, with `ciscoconfparse2` for running-config analysis.

4. **No Graph Engine Specified for Routing Simulation** — Routing reachability cannot be validated with naive code. This blueprint uses `NetworkX` as the graph engine powering all path computation.

5. **Zustand Alone is Insufficient** — Backend simulation state is async and server-authoritative. This blueprint adds `TanStack Query (React Query)` for server state alongside Zustand for local UI state.

6. **Rollback Not Technically Defined** — "Rollback must be supported" is not an implementation. This blueprint specifies a pre-flight snapshot via `show running-config` before any push, with SHA-256 content hash versioning stored in SQLite.

7. **Simulation Engine Has No Concurrency Model** — Multiple validation requests without queuing causes race conditions. This blueprint uses `asyncio` task queues with a Celery-compatible job model backed by SQLite.

8. **No Packaging Strategy** — Electron + Python is non-trivial to distribute. This blueprint mandates `PyInstaller` for the Python service and `Electron Builder` for the shell, with a sidecar process model.

9. **No Testing Strategy Defined** — No tests = no production. This blueprint defines unit, integration, and simulation test layers.

10. **AI Layer Has No Fallback** — If Ollama is not installed, the app crashes. This blueprint defines graceful degradation: AI features are disabled with informational messaging when the runtime is unavailable.

---

## Corrected Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON SHELL                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              REACT APPLICATION                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │ React Flow   │  │ Config Editor│  │ AI Chat    │  │  │
│  │  │ Canvas       │  │ Monaco-based │  │ Panel      │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │  │
│  │         │                 │                 │         │  │
│  │  ┌──────▼─────────────────▼─────────────────▼──────┐  │  │
│  │  │     Zustand (UI State) + React Query (Server)   │  │  │
│  │  └──────────────────────┬──────────────────────────┘  │  │
│  └─────────────────────────┼──────────────────────────────┘  │
│                            │ REST + WebSocket                │
│                            │ localhost:8742                  │
└────────────────────────────┼────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│              FASTAPI BACKEND (Python 3.11+)                 │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Topology     │  │ Simulation   │  │ Config Generator │  │
│  │ Manager      │  │ Engine       │  │ & Parser         │  │
│  │              │  │ (NetworkX)   │  │ (textfsm/        │  │
│  │              │  │              │  │  ciscoconfparse2)│  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│  ┌──────▼─────────────────▼────────────────────▼──────────┐ │
│  │           SQLite (WAL Mode) — Project Store            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ SSH Manager  │  │ Remediation  │  │ AI Bridge        │  │
│  │ (Paramiko)   │  │ Engine       │  │ (Ollama REST)    │  │
│  │ Keyring creds│  │              │  │ Graceful fallback│  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
| Layer | Technology | Version | Reason |
|---|---|---|---|
| Desktop Shell | Electron | 31.x | Cross-platform, V8 engine |
| UI Framework | React | 18.x | Component ecosystem |
| Graph Canvas | React Flow | 11.x | Purpose-built topology rendering |
| Local UI State | Zustand | 4.x | Lightweight, no boilerplate |
| Server State | TanStack Query | 5.x | Async backend state management |
| Config Editor | Monaco Editor | 0.46.x | VSCode engine, syntax highlight |
| Styling | Tailwind CSS | 3.x | Utility-first, fast iteration |
| Build Tool | Vite | 5.x | Fast HMR |
| Packager | Electron Builder | 24.x | NSIS/DMG/AppImage |

### Backend
| Layer | Technology | Version | Reason |
|---|---|---|---|
| API Framework | FastAPI | 0.110.x | Async, OpenAPI built-in |
| ASGI Server | Uvicorn | 0.29.x | Production ASGI |
| Graph Engine | NetworkX | 3.x | Routing reachability computation |
| Config Parser | ciscoconfparse2 | 1.9.x | Hierarchical IOS config parsing |
| CLI Output Parser | textfsm + ntc-templates | latest | Structured show command parsing |
| SSH Client | Paramiko | 3.x | SSH automation |
| Credential Store | keyring | 25.x | OS native keychain integration |
| Database ORM | SQLAlchemy | 2.x | Async SQLite via aiosqlite |
| Data Validation | Pydantic v2 | 2.x | Schema validation |
| Task Queue | asyncio + queue.Queue | stdlib | Job serialization |
| AI Bridge | httpx | 0.27.x | Async Ollama API calls |
| Packager | PyInstaller | 6.x | Freeze Python service |

### AI (Optional, Local)
| Component | Technology | Notes |
|---|---|---|
| Runtime | Ollama | Must be pre-installed by user |
| Recommended Model | llama3.2:3b or mistral:7b | Balance of speed and quality |
| Fallback | Graceful disable | App works without AI features |

---

## API Contract (Backend ↔ Frontend)

### Base URL
`http://localhost:8742/api/v1`

### REST Endpoints

```
POST   /projects                     Create new project
GET    /projects                     List all projects
GET    /projects/{id}                Get project detail
DELETE /projects/{id}                Delete project

PUT    /projects/{id}/topology       Update topology (full replace)
GET    /projects/{id}/topology       Get topology graph

POST   /projects/{id}/devices        Add device node
PUT    /projects/{id}/devices/{did}  Update device
DELETE /projects/{id}/devices/{did}  Remove device

POST   /projects/{id}/links          Add link
PUT    /projects/{id}/links/{lid}    Update link
DELETE /projects/{id}/links/{lid}    Remove link

POST   /projects/{id}/validate       Trigger simulation (async, returns job_id)
GET    /jobs/{job_id}                Poll job status + results

POST   /projects/{id}/generate-cli   Generate CLI script block
GET    /projects/{id}/generate-cli   Download latest CLI script

POST   /devices/{did}/ssh-connect    Test SSH connectivity
POST   /devices/{did}/ingest         Pull config via SSH (async)
POST   /devices/{did}/upload-config  Upload config file

GET    /projects/{id}/audit          Get full audit report
GET    /projects/{id}/gaps           Get detected gap list
POST   /projects/{id}/remediate      Submit remediation plan (returns preview)
POST   /projects/{id}/apply          Apply approved remediation (requires confirm=true)

POST   /ai/explain                   Explain validation failure in plain English
POST   /ai/suggest                   Request AI config suggestion

GET    /health                       Backend health + Ollama availability
```

### WebSocket Endpoints

```
WS /ws/simulation/{job_id}   Stream real-time simulation progress
WS /ws/remediation/{job_id}  Stream SSH push progress
WS /ws/ingestion/{job_id}    Stream live device ingestion status
```

### Canonical Data Models

```python
# Device Node
{
  "id": "uuid",
  "hostname": "SW-CORE-01",
  "role": "switch | router | wlc | ap | firewall",
  "vendor": "cisco",
  "platform": "ios-xe | ios | nxos",
  "management_ip": "10.0.0.1",
  "canvas_x": 400,
  "canvas_y": 200,
  "interfaces": [
    {
      "name": "GigabitEthernet1/0/1",
      "description": "uplink to core",
      "mode": "trunk | access | routed",
      "vlan_access": 10,
      "vlan_trunk_allowed": [10, 20, 30],
      "ip_address": null,
      "ip_mask": null,
      "state": "up | down | unknown"
    }
  ],
  "vlan_database": [10, 20, 30],
  "config_snapshot": "raw IOS config text",
  "config_hash": "sha256hex",
  "has_credentials": true
}

# Link
{
  "id": "uuid",
  "source_device_id": "uuid",
  "source_interface": "GigabitEthernet1/0/1",
  "target_device_id": "uuid",
  "target_interface": "GigabitEthernet0/1",
  "medium": "ethernet | fibre",
  "vlan_allow_list": [10, 20, 30],
  "state": "connected | misconfigured | pending"
}

# Validation Result
{
  "job_id": "uuid",
  "status": "running | complete | failed",
  "timestamp": "ISO8601",
  "checks": [
    {
      "check_id": "VLAN_CONTINUITY",
      "severity": "error | warning | info",
      "passed": false,
      "device_id": "uuid",
      "interface": "Gig1/0/1",
      "detail": "VLAN 30 missing from trunk allow-list",
      "suggested_fix": "switchport trunk allowed vlan add 30"
    }
  ],
  "reachability_matrix": {
    "SW-CORE-01": { "SW-ACCESS-01": true, "WLC-01": false }
  }
}

# Remediation Plan
{
  "plan_id": "uuid",
  "items": [
    {
      "device_id": "uuid",
      "hostname": "SW-CORE-01",
      "interface": "Gig1/0/1",
      "gap_check": "VLAN_CONTINUITY",
      "cli_patch": "interface GigabitEthernet1/0/1\n switchport trunk allowed vlan add 30",
      "rollback_cli": "interface GigabitEthernet1/0/1\n switchport trunk allowed vlan remove 30",
      "approved": false
    }
  ]
}
```

---

## Database Schema

```sql
-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Devices
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  role TEXT NOT NULL,
  vendor TEXT DEFAULT 'cisco',
  platform TEXT DEFAULT 'ios-xe',
  management_ip TEXT,
  canvas_x REAL,
  canvas_y REAL,
  credential_ref TEXT,  -- UUID key into OS keychain, NOT the password
  config_hash TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interfaces (normalized)
CREATE TABLE interfaces (
  id TEXT PRIMARY KEY,
  device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  mode TEXT DEFAULT 'access',
  vlan_access INTEGER,
  vlan_trunk_allowed TEXT,  -- JSON array
  ip_address TEXT,
  ip_mask TEXT,
  state TEXT DEFAULT 'unknown'
);

-- VLAN Database per device
CREATE TABLE device_vlans (
  device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  vlan_id INTEGER NOT NULL,
  name TEXT,
  PRIMARY KEY (device_id, vlan_id)
);

-- Links
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  source_device_id TEXT REFERENCES devices(id),
  source_interface TEXT,
  target_device_id TEXT REFERENCES devices(id),
  target_interface TEXT,
  medium TEXT DEFAULT 'ethernet',
  vlan_allow_list TEXT,  -- JSON array
  state TEXT DEFAULT 'pending'
);

-- Configuration Snapshots (versioned)
CREATE TABLE config_snapshots (
  id TEXT PRIMARY KEY,
  device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  raw_config TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  source TEXT DEFAULT 'manual',  -- 'manual' | 'ssh' | 'upload'
  taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Simulation Jobs
CREATE TABLE simulation_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  status TEXT DEFAULT 'queued',
  result_json TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Audit Log
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT,
  device_id TEXT,
  action TEXT NOT NULL,
  actor TEXT DEFAULT 'user',
  detail TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Remediation Plans
CREATE TABLE remediation_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  plan_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending | approved | applied | rolled_back
  applied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generated CLI Scripts
CREATE TABLE cli_scripts (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  device_id TEXT REFERENCES devices(id),
  script_content TEXT NOT NULL,
  generator_version TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PRAGMA settings (set at connection time)
-- PRAGMA journal_mode=WAL;
-- PRAGMA foreign_keys=ON;
-- PRAGMA synchronous=NORMAL;
```

---

## Simulation Engine Design

### Check Registry

All checks are registered, not hardcoded. Each check is a class implementing:

```python
class BaseCheck:
    check_id: str
    name: str
    severity: str  # "error" | "warning" | "info"

    def run(self, graph: NetworkGraph, context: SimContext) -> list[CheckResult]:
        raise NotImplementedError
```

### Implemented Checks (Phase 1)

| Check ID | Description | Severity |
|---|---|---|
| VLAN_CONTINUITY | VLAN present on all trunk links in path | Error |
| VLAN_ORPHAN_SVI | SVI exists but no L2 path to that VLAN | Warning |
| ROUTING_BLACKHOLE | Route exists with no next-hop resolution | Error |
| ACL_BLOCK_SIMULATED | ACL rule would drop simulated traffic | Warning |
| MGMT_SSH_PATH | SSH path from mgmt station to device valid | Error |
| WLC_JOIN_CHAIN | Full AP → WLC CAPWAP join path valid | Error |
| DHCP_REACHABILITY | DHCP server reachable from VLAN SVI | Warning |
| TRUNK_NATIVE_MISMATCH | Native VLAN mismatch on trunk | Error |
| DUPLEX_MISMATCH | Duplex mismatch on link endpoints | Warning |

### Wireless Join Chain Algorithm

```
1. Locate AP node in graph
2. Find AP's uplink interface → identify access port VLAN (AP VLAN)
3. Verify AP VLAN exists in switch VLAN database
4. Walk uplink trunk chain: verify AP VLAN in allow-list at every hop
5. Locate WLC node in graph
6. Find WLC management interface VLAN
7. Verify routed path exists from AP VLAN SVI to WLC VLAN SVI
8. Check ACLs on path: permit UDP 5246-5247 (CAPWAP)
9. Check DHCP server reachable from AP VLAN (required for AP to get IP)
10. Return: PASS | FAIL with specific failure step
```

---

## Security Model

### Credential Handling

```
User enters SSH credentials
         │
         ▼
Backend stores via keyring.set_password(
    service="netval-app",
    username=f"{project_id}:{device_id}",
    password=encrypted_credential
)
         │
         ▼
SQLite stores only credential_ref UUID
(no password, no hash of password, nothing recoverable)
         │
         ▼
At SSH time: keyring.get_password(...) → Paramiko SSH
```

### SSH Execution Rules

- Never log SSH credentials to any file
- All SSH operations run in isolated async context
- All config push operations require explicit `confirm=true` in API body
- Pre-flight snapshot taken before any config push
- Rollback available for 24 hours post-apply

---

## Packaging Model

```
dist/
├── NetValidator-Setup.exe       (Electron Builder NSIS installer)
│   ├── electron app (renderer + main process)
│   └── resources/
│       └── backend/
│           └── netval-backend.exe  (PyInstaller sidecar)
```

### Sidecar Process Management (Electron Main Process)

```javascript
// main.js
const { app } = require('electron')
const { spawn } = require('child_process')
const path = require('path')

let backendProcess = null

function startBackend() {
  const backendPath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'netval-backend.exe')
    : 'python'
  
  const args = app.isPackaged ? [] : ['-m', 'uvicorn', 'main:app', '--port', '8742']
  
  backendProcess = spawn(backendPath, args, {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  backendProcess.stdout.on('data', (d) => console.log(`[backend] ${d}`))
  backendProcess.stderr.on('data', (d) => console.error(`[backend] ${d}`))
}

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill()
})
```

---

## Error Handling Philosophy

- **Simulation failures** are results, not exceptions. Engine always returns a result object.
- **SSH failures** surface as job errors with specific Paramiko exception type exposed to user.
- **Parser failures** degrade gracefully: partially parsed config is stored, unparsed sections flagged.
- **AI unavailability** is a capability flag, not an error state.
- **Database errors** are logged with full context and surfaced to user as "project save failed."

---

## Folder Structure

```
netval/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/           # React Flow nodes, edges, minimap
│   │   │   ├── panels/           # Config editor, audit panel, AI chat
│   │   │   ├── modals/           # Device config modal, remediation approval
│   │   │   └── shared/           # Buttons, badges, status indicators
│   │   ├── store/
│   │   │   ├── topology.ts       # Zustand: canvas state
│   │   │   └── ui.ts             # Zustand: sidebar, modals
│   │   ├── api/
│   │   │   ├── client.ts         # Axios/fetch base
│   │   │   ├── projects.ts       # Project API hooks (React Query)
│   │   │   ├── simulation.ts     # Validation hooks
│   │   │   └── websocket.ts      # WS connection manager
│   │   ├── canvas/
│   │   │   ├── nodes/            # Device node components
│   │   │   ├── edges/            # Animated link components
│   │   │   └── layout.ts         # Auto-layout algorithm
│   │   └── App.tsx
│   ├── electron/
│   │   ├── main.js               # Electron main process + sidecar
│   │   └── preload.js            # Context bridge
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── main.py                   # FastAPI app factory
│   ├── config.py                 # Settings (port, paths, DB path)
│   ├── database.py               # SQLAlchemy async engine setup
│   ├── models/
│   │   ├── orm.py                # SQLAlchemy ORM models
│   │   └── schemas.py            # Pydantic request/response schemas
│   ├── api/
│   │   ├── projects.py           # Project CRUD routes
│   │   ├── devices.py            # Device routes
│   │   ├── links.py              # Link routes
│   │   ├── simulation.py         # Validation job routes
│   │   ├── generation.py         # CLI generation routes
│   │   ├── remediation.py        # Remediation routes
│   │   ├── ssh.py                # SSH ingestion routes
│   │   └── ai.py                 # AI bridge routes
│   ├── engine/
│   │   ├── graph.py              # NetworkX graph builder
│   │   ├── simulator.py          # Simulation orchestrator
│   │   ├── checks/
│   │   │   ├── base.py           # BaseCheck class
│   │   │   ├── vlan.py           # VLAN checks
│   │   │   ├── routing.py        # Routing checks
│   │   │   ├── acl.py            # ACL simulation
│   │   │   ├── wireless.py       # Wireless join chain
│   │   │   └── management.py     # SSH/mgmt path checks
│   │   └── registry.py           # Check registration
│   ├── parser/
│   │   ├── cisco_parser.py       # ciscoconfparse2 wrapper
│   │   ├── textfsm_parser.py     # ntc-templates wrapper
│   │   └── normalizer.py         # Normalize to canonical device model
│   ├── generator/
│   │   ├── base.py               # Generator base class
│   │   ├── cisco_xe.py           # IOS-XE CLI generator
│   │   └── templates/            # Jinja2 CLI templates
│   ├── ssh/
│   │   ├── manager.py            # Paramiko SSH session manager
│   │   ├── commands.py           # Cisco show command library
│   │   └── credentials.py        # keyring integration
│   ├── remediation/
│   │   ├── planner.py            # Gap → Fix plan generator
│   │   └── applicator.py         # SSH config pusher
│   ├── ai/
│   │   ├── bridge.py             # Ollama API client
│   │   ├── prompts.py            # System prompt templates
│   │   └── fallback.py           # Graceful disable handler
│   ├── websocket/
│   │   └── manager.py            # WS connection manager + broadcaster
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── fixtures/             # Sample Cisco configs for testing
│
├── docs/
│   ├── BLUEPRINT.md              # This file
│   ├── IMPLEMENTATION.md
│   ├── SKILLS.md
│   └── AGENT.md
│
├── scripts/
│   ├── build.sh                  # Full build script
│   └── dev.sh                    # Dev mode launcher
│
└── requirements.txt
```
