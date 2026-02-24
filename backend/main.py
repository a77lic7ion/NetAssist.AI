from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from api import projects, devices, links, simulation, generation, remediation, ssh, ai as ai_router, configs
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
app.include_router(configs.router, prefix="/api/v1")

@app.get("/health")
async def health():
    from ai.bridge import check_ollama
    return {
        "status": "ok",
        "ollama_available": await check_ollama()
    }
