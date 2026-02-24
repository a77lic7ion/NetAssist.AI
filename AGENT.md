# AGENT.md
## Network Staging Intelligence Platform — AI Agent Build Instructions

This document tells an AI agent exactly how to build this application: what to build first, what decisions to make, what to never do, and how to verify it's working at each step.

---

## Agent Identity & Role

You are a senior full-stack software engineer specializing in network automation tooling. You are building a local Windows desktop application called **NetVal** — a network design and pre-deployment validation platform.

You have complete technical authority. Do not ask for permission to make reasonable implementation decisions. Do ask for clarification when requirements are genuinely ambiguous.

---

## Critical Rules (Never Violate These)

1. **Never store passwords in plaintext anywhere.** Use `keyring` for all credential storage. Only UUIDs go in SQLite.

2. **Never push configuration to a device without `confirm=True` explicitly in the API request body.** All config push routes must check this.

3. **Never block the asyncio event loop.** All SSH calls (Paramiko), file I/O, and CPU-intensive operations go in `asyncio.run_in_executor`.

4. **Never use `nodeIntegration: true` in Electron.** Always use the `contextBridge` + `preload.js` pattern.

5. **Never make the AI layer a hard dependency.** If Ollama is unreachable, all other features must continue working. The health endpoint reports AI status.

6. **The backend is the source of truth.** The frontend never computes network state. It only renders what the backend returns.

7. **All topology mutations persist to SQLite immediately** — do not rely on in-memory state. If the backend restarts, the project must be recoverable.

8. **Same topology → same CLI script.** The generator must be deterministic. Sort all collections (VLANs, interfaces, routes) before rendering.

9. **Every config push must snapshot the device first.** Store pre-push running-config in `config_snapshots` before applying anything.

10. **Tests must pass before advancing phases.** Run the test suite after each phase. Do not proceed if tests are red.

---

## Build Sequence

Follow this exact order. Each phase has a verification gate. Do not skip verification.

---

### PHASE 1 — Repository & Scaffolding

**Goal:** Running skeleton with health endpoint and empty React shell.

**Steps:**
1. Create project structure as defined in BLUEPRINT.md `Folder Structure` section
2. Scaffold React + Vite frontend with TypeScript
3. Install all npm packages listed in IMPLEMENTATION.md Phase 1.1
4. Install all Python packages listed in IMPLEMENTATION.md Phase 1.1
5. Implement `config.py`, `database.py`, and `main.py` exactly as shown
6. Implement ORM models from `models/orm.py`
7. Create all SQLite tables via `init_db()`
8. Implement the `/health` endpoint

**Verification Gate:**
```bash
# Backend
cd backend && uvicorn main:app --port 8742
curl http://localhost:8742/health
# Expected: {"status": "ok", "ollama_available": false}

# Frontend
cd frontend && npm run dev
# Expected: React app loads on http://localhost:5173 with no console errors
```

**Do not proceed until both pass.**

---

### PHASE 2 — Database CRUD API

**Goal:** Full project/device/link CRUD working via API.

**Steps:**
1. Implement all Pydantic schemas in `models/schemas.py`
2. Implement `api/projects.py` with CRUD routes
3. Implement `api/devices.py` with CRUD routes
4. Implement `api/links.py` with CRUD routes
5. Test each endpoint with curl or httpx

**Implementation Notes:**
- All IDs are UUIDs generated server-side
- `updated_at` must be refreshed on every PUT
- Device deletion must cascade to interfaces, vlans, and links
- Link creation must validate that source and target devices exist in the same project

**Verification Gate:**
```bash
# Create project
curl -X POST http://localhost:8742/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project"}'
# Expected: {"id": "...", "name": "Test Project", ...}

# Add device
curl -X POST http://localhost:8742/api/v1/projects/{id}/devices \
  -H "Content-Type: application/json" \
  -d '{"hostname": "SW1", "role": "switch"}'

# Add second device and link them
# Then delete project and verify cascade
```

---

### PHASE 3 — Simulation Engine

**Goal:** Running VLAN continuity and wireless join chain checks on a test topology.

**Steps:**
1. Implement `engine/graph.py` (NetworkGraph class)
2. Implement `engine/checks/base.py` (BaseCheck, CheckResult)
3. Implement `engine/checks/vlan.py` (VlanContinuityCheck, OrphanSVICheck)
4. Implement `engine/checks/wireless.py` (WirelessJoinCheck)
5. Implement `engine/simulator.py` (run_simulation function)
6. Implement `engine/registry.py` (check registration list)
7. Implement `api/simulation.py` (POST validate endpoint, GET job endpoint)
8. Implement WebSocket endpoint at `/ws/simulation/{job_id}`

**Test Topology to Validate Against:**
```
AP1 (role: ap) 
  └─ GigE0/1 (access VLAN 20) 
     └─ SW-ACCESS (switch)
          └─ GigE0/2 (trunk, allowed 10,20,30)
             └─ SW-CORE (switch, VLANs 10,20,30)
                  └─ GigE0/1 (trunk, allowed 10,20)  ← BUG: missing 20 on WLC side
                     └─ WLC-01 (wlc, VLANs 10)
```

**Expected failures in this topology:**
- `VLAN_CONTINUITY`: VLAN 20 missing on WLC-01
- `WLC_JOIN_CHAIN`: AP join fails — VLAN 20 blocked before WLC

**Unit Tests Required:**
```bash
cd backend && pytest tests/unit/test_vlan_check.py -v
cd backend && pytest tests/unit/test_wireless_check.py -v
```

**Verification Gate:**
```bash
# Trigger simulation on test project
curl -X POST http://localhost:8742/api/v1/projects/{id}/validate
# Returns job_id

# Poll result
curl http://localhost:8742/api/v1/jobs/{job_id}
# Expected: status=complete, checks contain VLAN_CONTINUITY failure
```

---

### PHASE 4 — Config Parser

**Goal:** Parse a real Cisco IOS-XE running-config into the canonical device model.

**Steps:**
1. Implement `parser/cisco_parser.py` (parse_running_config function)
2. Implement `parser/normalizer.py` (map parsed dict to ORM Device/Interface/Vlan objects)
3. Add file upload route in `api/ssh.py` (POST `/devices/{id}/upload-config`)
4. On upload: parse config → update device interfaces/vlans → store snapshot

**Sample Config for Testing (`tests/fixtures/sw_core.txt`):**
```
hostname SW-CORE-01
!
ip routing
!
vlan 10
 name Management
vlan 20
 name Data
vlan 30
 name Voice
!
interface Vlan10
 ip address 10.0.10.1 255.255.255.0
 no shutdown
!
interface GigabitEthernet1/0/1
 description Uplink to Distribution
 switchport mode trunk
 switchport trunk encapsulation dot1q
 switchport trunk allowed vlan 10,20,30
 no shutdown
!
interface GigabitEthernet1/0/2
 description AP Port
 switchport mode access
 switchport access vlan 20
 no shutdown
!
```

**Unit Tests Required:**
```bash
cd backend && pytest tests/unit/test_parser.py -v
# Must pass: hostname, vlan list, interface modes, trunk allow list
```

**Verification Gate:**
```bash
# Upload config file
curl -X POST http://localhost:8742/api/v1/devices/{id}/upload-config \
  -F "file=@tests/fixtures/sw_core.txt"
# Expected: device updated with parsed interfaces and VLANs
```

---

### PHASE 5 — CLI Generator

**Goal:** Generate deterministic IOS-XE CLI from device model.

**Steps:**
1. Implement Jinja2 templates in `generator/templates/`
2. Implement `generator/cisco_xe.py` (generate_device_config function)
3. Implement `api/generation.py` (POST/GET generate-cli endpoints)

**Determinism Test:**
Call generate-cli twice on the same topology. The output must be byte-for-byte identical. If it is not, find the non-deterministic collection and sort it.

**Verification Gate:**
```bash
curl -X POST http://localhost:8742/api/v1/projects/{id}/generate-cli
# Returns script content

# Run twice, diff the results
curl ... > output1.txt
curl ... > output2.txt
diff output1.txt output2.txt
# Expected: no diff
```

---

### PHASE 6 — SSH Manager & Ingestion

**Goal:** Connect to a real or simulated device and pull running-config via SSH.

**Steps:**
1. Implement `ssh/credentials.py` (store_credential, get_credential, delete_credential)
2. Implement `ssh/commands.py` (SHOW_COMMANDS dictionary)
3. Implement `ssh/manager.py` (ingest_device, push_config functions)
4. Implement SSH-related routes in `api/ssh.py`
5. Test SSH connectivity route
6. Test config ingestion

**`ssh/commands.py`:**
```python
SHOW_COMMANDS = {
    "show running-config": "running_config",
    "show vlan": "vlan_brief",
    "show ip interface brief": "ip_int_brief",
    "show cdp neighbors detail": "cdp_neighbors",
    "show version": "version",
}
```

**For testing without a real device:**
Use GNS3, CML, or EVE-NG with a free Cisco IOSvL2 image. Alternatively, use a Python SSH echo server for integration tests.

**Verification Gate:**
```bash
# Store credentials
curl -X POST http://localhost:8742/api/v1/devices/{id}/credentials \
  -d '{"username": "admin", "password": "cisco"}'

# Test SSH connectivity
curl -X POST http://localhost:8742/api/v1/devices/{id}/ssh-connect
# Expected: {"reachable": true, "latency_ms": 23}

# Ingest config
curl -X POST http://localhost:8742/api/v1/devices/{id}/ingest
# Expected: job_id returned, device updated after completion
```

---

### PHASE 7 — Frontend Canvas

**Goal:** Interactive topology canvas with drag-and-drop, animated edges, and node panels.

**Steps:**

**7.1 — Setup**
1. Configure Tailwind CSS
2. Add global CSS with keyframe `@keyframes flow` for edge animation
3. Set up React Router (if needed) or single-page layout
4. Create `api/client.ts` with Axios base URL = `http://localhost:8742`

**7.2 — Topology Store**
1. Implement `store/topology.ts` (Zustand store as shown in SKILLS.md)
2. Implement `store/ui.ts` (sidebar open/close, selected node, active project)

**7.3 — Canvas**
1. Implement `canvas/nodes/SwitchNode.tsx`
2. Implement `canvas/nodes/RouterNode.tsx`
3. Implement `canvas/nodes/WLCNode.tsx`
4. Implement `canvas/nodes/APNode.tsx`
5. Implement `canvas/edges/AnimatedEdge.tsx` with glow + flow animation
6. Implement `TopologyCanvas.tsx` with React Flow wrapper

**7.4 — Panels**
1. Implement device sidebar panel (click node to open)
2. Implement device form (edit hostname, role, management IP, VLANs)
3. Implement link form (click edge to open: edit medium, VLAN allow list)
4. Implement audit results panel (show check results with severity badges)

**7.5 — Toolbar**
1. "Add Device" dropdown → places node at canvas center
2. "Validate" button → calls POST validate, opens WebSocket, shows progress
3. "Generate CLI" button → calls generate-cli, shows result in Monaco Editor modal
4. "Save" button → calls PUT topology endpoint

**Edge Animation CSS:**
```css
@keyframes flow {
  from { stroke-dashoffset: 24; }
  to   { stroke-dashoffset: 0; }
}
```

**Verification Gate:**
- Drag nodes around canvas without errors
- Draw connection between two nodes → link appears with animation
- Click "Validate" → progress updates visible in real-time via WebSocket
- Failed checks highlight affected nodes red
- Click failed node → panel shows check details and suggested fix

---

### PHASE 8 — Remediation Engine

**Goal:** Full gap → plan → approve → apply → revalidate loop working.

**Steps:**
1. Implement `remediation/planner.py` (convert check failures → remediation plan)
2. Implement `remediation/applicator.py` (apply approved plan items via SSH)
3. Implement `api/remediation.py` routes
4. Implement remediation approval modal in React

**Planner Logic:**
```
For each CheckResult where passed=False:
  1. Look up the fix template for check_id
  2. Generate CLI patch using Jinja2
  3. Generate rollback CLI (inverse of patch)
  4. Package into RemediationItem
  5. Save RemediationPlan to DB with status=pending
```

**Remediation Modal Requirements:**
- Show each fix item with device hostname, interface, and CLI preview
- Per-item approve/reject toggle
- "Apply Approved" button → sends plan with approved=true items
- Progress indicator via WebSocket during application
- "Re-validate" button appears after successful apply

**Rollback:**
- Rollback CLI stored per-item at plan creation time
- Rollback available until plan status changes to `applied`
- Rollback re-applies pre-push snapshot config

**Verification Gate:**
1. Create a topology with known VLAN gap
2. Run validation → gap detected
3. Click "Generate Fix Plan"
4. Review plan in modal
5. Approve and apply (against test device or dry-run)
6. Re-run validation → gap resolved

---

### PHASE 9 — AI Bridge

**Goal:** AI explanation of failures working when Ollama is available, gracefully disabled when not.

**Steps:**
1. Implement `ai/bridge.py` (check_ollama, explain_failure, suggest_fix)
2. Implement `ai/prompts.py` (prompt templates)
3. Implement `ai/fallback.py` (graceful disable handler)
4. Implement `api/ai.py` routes
5. Add "Explain" button to each audit result row in the UI

**AI Panel Behavior:**
- If Ollama unavailable: show "AI features require Ollama. [Install Guide]" banner
- If available: show AI chat panel in sidebar
- "Explain" button on check result → calls POST /ai/explain → streams response
- Response appears character-by-character (streaming from Ollama)

**Verification Gate:**
- With Ollama running: click Explain on a failed check → gets response
- With Ollama stopped: Explain button shows disabled tooltip, app still works fully

---

### PHASE 10 — Electron Packaging & Polish

**Goal:** Distributable .exe installer that bundles backend and frontend.

**Steps:**
1. Implement `electron/main.js` sidecar process manager
2. Implement `electron/preload.js` context bridge
3. Write `netval.spec` PyInstaller spec file
4. Run PyInstaller: `pyinstaller netval.spec`
5. Place `netval-backend.exe` in `frontend/resources/backend/`
6. Configure `electron-builder` in `package.json`
7. Run `npm run electron:build`

**Polish Checklist:**
- [ ] Window opens to last saved project
- [ ] Backend startup failure shows error dialog (not silent crash)
- [ ] Canvas saves topology on every significant change (debounced 2s)
- [ ] All modals have keyboard dismiss (Escape key)
- [ ] All loading states have indicators (spinner or skeleton)
- [ ] All error states have user-readable messages (not stack traces)
- [ ] App gracefully handles device connectivity loss during SSH operation

**Verification Gate:**
```bash
# Install on clean Windows machine (no Python, no Node)
# Launch NetVal-Setup.exe
# After install, open NetVal
# Expected: app launches, backend starts, health check passes
```

---

## Debugging Guide

### Backend won't start
```bash
# Check port conflict
netstat -ano | findstr :8742

# Check for import errors
python -c "import main"

# Check SQLite path permissions
python -c "from config import settings; print(settings.db_path)"
```

### Simulation always returns no results
- Ensure `REGISTERED_CHECKS` list in `registry.py` is not empty
- Add `print(f"Running check: {check.check_id}")` inside simulator
- Check that devices actually have interfaces and VLANs loaded (log counts)

### React Flow canvas is blank
- Check browser console for `@xyflow/react` CSS import
- Ensure parent container has explicit `height` (React Flow requires non-zero height)
- Check that `nodeTypes` and `edgeTypes` are defined outside component render

### SSH connection fails silently
- Always log the full Paramiko exception class, not just message
- Check that device management IP is reachable from host (`ping`)
- Verify no firewall blocking port 22 on the target
- Test with `paramiko.SSHClient()` directly in a standalone script first

### PyInstaller binary fails to start
- Run with `console=True` in spec file to see error output
- Check hidden imports: run `python -c "import <module>"` for each
- Verify ntc-templates directory is included in `datas`
- Test: `./netval-backend.exe` from command line before packaging in Electron

### Ollama integration not working
- `curl http://localhost:11434/api/tags` — should return model list
- Ensure model is pulled: `ollama pull llama3.2:3b`
- Check `check_ollama()` returns `True` before calling generate
- Ollama timeout is 30s — increase for slow hardware

---

## Verification Milestones

| Milestone | Test Command | Expected |
|---|---|---|
| Backend alive | `curl localhost:8742/health` | `{"status":"ok"}` |
| DB CRUD | Create/read/delete project | 201 → 200 → 404 |
| Simulation | POST validate → GET job | `status: complete` with check results |
| Parser | Upload sample config | Device interfaces populated |
| Generator | POST generate-cli (twice) | Identical output both times |
| SSH | POST ssh-connect | `{"reachable": true}` |
| Canvas | Drag node, draw edge | No JS errors, state persists |
| Remediation | Gap → Plan → Apply | Re-validate shows gap resolved |
| AI | POST /ai/explain | Plain-English response |
| Package | Install on clean OS | App launches, backend starts |

---

## What Done Looks Like

A network engineer should be able to:

1. Launch the app on a Windows machine with no other tools installed
2. Create a new project and drag 5 devices onto the canvas
3. Connect them with trunk and access links, configure VLANs
4. Upload a running-config file for one of the switches
5. Click Validate and see real-time check progress
6. See VLAN gaps highlighted red on the canvas
7. Click "Generate Fix Plan" and review the CLI remediation items
8. Approve specific items and click Apply
9. Watch the SSH push progress, then re-validate
10. See the topology turn green

That workflow working end-to-end is the definition of v1.0 complete.
