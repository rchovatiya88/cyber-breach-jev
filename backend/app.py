import os
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from backend.jev_client import jev_service
from backend.enemy_ai import decide_enemy_tactics
from backend.game_director import decide_director_event
from backend.bot_pilot import decide_bot_actions

app = FastAPI(
    title="Cyber-Breach: The Jev Protocol",
    description="FastAPI backend utilizing TypeSafe AI's Jev model for tactical gaming AI",
    version="1.0.0",
)

# Enable CORS for local testing and iframe embedding
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)



class StatePayload(BaseModel):
    state: Dict[str, Any]


class ConfigPayload(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = None


@app.get("/api/health")
async def health_check():
    status = jev_service.get_status()
    return {
        "status": "online",
        "jev": status,
    }


@app.get("/api/config")
async def get_config():
    return jev_service.get_status()


@app.post("/api/config")
async def update_config(payload: ConfigPayload):
    if payload.api_key is not None:
        jev_service.set_api_key(payload.api_key)
    if payload.model:
        jev_service.model = payload.model
    return {
        "message": "Configuration updated successfully",
        "jev": jev_service.get_status(),
    }


@app.post("/api/ai/enemy")
async def api_enemy_ai(payload: StatePayload):
    try:
        decision = decide_enemy_tactics(payload.state)
        return decision
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/director")
async def api_director_ai(payload: StatePayload):
    try:
        decision = decide_director_event(payload.state)
        return decision
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/bot")
async def api_bot_ai(payload: StatePayload):
    try:
        decision = decide_bot_actions(payload.state)
        return decision
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Mount static assets from frontend
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"message": "Frontend not found"}


if __name__ == "__main__":
    import uvicorn

    print("=================================================================")
    print("🚀 CYBER-BREACH: THE JEV PROTOCOL SERVER STARTING")
    print("⚡ Powered by TypeSafe AI Jev (System One Model)")
    print("🌐 Game URL: http://localhost:8000")
    print("=================================================================")
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)
