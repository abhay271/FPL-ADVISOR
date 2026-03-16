import os

from dotenv import load_dotenv

load_dotenv()  # load .env before anything reads env vars

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.fpl_service import FPLService

app = FastAPI(title="FPL Advisor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fpl = FPLService()


def _err(e: Exception):
    """Translate service-layer exceptions into appropriate HTTP responses."""
    if isinstance(e, httpx.HTTPStatusError):
        sc = e.response.status_code
        raise HTTPException(status_code=sc, detail=f"FPL API returned {sc}: {e.response.text[:200]}")
    raise HTTPException(status_code=500, detail=str(e))


# ── status ─────────────────────────────────────────────────────────────────────
@app.get("/api/status")
async def status():
    """Return current gameweek info and a health-check confirmation."""
    try:
        return await fpl.get_bootstrap_status()
    except Exception as e:
        _err(e)


# ── players ────────────────────────────────────────────────────────────────────
@app.get("/api/players")
async def get_players():
    try:
        return await fpl.get_players()
    except Exception as e:
        _err(e)


# ── teams ──────────────────────────────────────────────────────────────────────
@app.get("/api/teams")
async def get_teams():
    try:
        return await fpl.get_teams()
    except Exception as e:
        _err(e)


# ── fixtures ───────────────────────────────────────────────────────────────────
@app.get("/api/fixtures")
async def get_fixtures():
    try:
        return await fpl.get_fixtures()
    except Exception as e:
        _err(e)


# ── my team ────────────────────────────────────────────────────────────────────
@app.get("/api/my-team/{team_id}")
async def get_my_team(team_id: int):
    """Fetch a manager's current squad, live GW points, and captain picks."""
    try:
        return await fpl.get_my_team(team_id)
    except Exception as e:
        _err(e)


# ── recommendations ────────────────────────────────────────────────────────────
@app.get("/api/recommendations/{team_id}")
async def get_recommendations(team_id: int):
    """Score every non-squad player using the weighted transfer algorithm and return ranked buy/sell lists."""
    try:
        return await fpl.get_recommendations(team_id)
    except Exception as e:
        _err(e)


# ── player detail ──────────────────────────────────────────────────────────────
@app.get("/api/player/{player_id}/detail")
async def get_player_detail(player_id: int):
    try:
        result = await fpl.get_player_detail(player_id)
        if not result:
            raise HTTPException(status_code=404, detail=f"Player {player_id} not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        _err(e)


# ── player analysis ────────────────────────────────────────────────────────────
@app.get("/api/player/{player_id}/analysis")
async def get_player_analysis(player_id: int):
    try:
        result = await fpl.get_player_analysis(player_id)
        if not result:
            raise HTTPException(status_code=404, detail=f"Player {player_id} not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        _err(e)


# ── gameweek summary ───────────────────────────────────────────────────────────
@app.get("/api/gameweek-summary")
async def get_gameweek_summary():
    try:
        return await fpl.get_gameweek_summary()
    except Exception as e:
        _err(e)


# ── AI chat ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    team_id: str | None = None


@app.post("/api/ai-chat")
async def ai_chat(req: ChatRequest):
    """Send a message to the Claude AI advisor with optional team context and return its response."""
    try:
        text = await fpl.ai_chat(req.message, req.team_id)
        return {"response": text}
    except Exception as e:
        _err(e)
