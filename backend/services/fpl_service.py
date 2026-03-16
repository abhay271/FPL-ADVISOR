import asyncio
import json
import os

import anthropic
import httpx

BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
FIXTURES_URL  = "https://fantasy.premierleague.com/api/fixtures/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def _current_gw(events: list[dict]) -> int:
    """Return the current gameweek ID from the events list."""
    for e in events:
        if e.get("is_current"):
            return e["id"]
    # fallback: most recent finished
    for e in reversed(events):
        if e.get("finished"):
            return e["id"]
    # fallback: first upcoming
    for e in events:
        if not e.get("finished"):
            return e["id"]
    return 1


def _sf(val: object, default: float = 0.0) -> float:
    """Safe float conversion with a default."""
    try:
        return float(val) if val is not None else default
    except (ValueError, TypeError):
        return default


class FPLService:
    def _client(self) -> httpx.AsyncClient:  # noqa: D401
        return httpx.AsyncClient(timeout=30.0, headers=HEADERS)

    # ── bootstrap ─────────────────────────────────────────────────────────────
    async def _fetch_bootstrap(self) -> dict:
        async with self._client() as c:
            r = await c.get(BOOTSTRAP_URL)
            r.raise_for_status()
            return r.json()

    async def get_bootstrap_status(self) -> dict:
        data = await self._fetch_bootstrap()
        gw   = _current_gw(data["events"])
        evt  = next((e for e in data["events"] if e["id"] == gw), {})
        return {
            "status": "ok",
            "current_gameweek": gw,
            "gameweek_name": evt.get("name"),
            "gameweek_deadline": evt.get("deadline_time"),
            "gameweek_finished": evt.get("finished"),
            "is_current": evt.get("is_current"),
            "total_players": len(data["elements"]),
            "total_teams": len(data["teams"]),
        }

    # ── players ───────────────────────────────────────────────────────────────
    async def get_players(self) -> list[dict]:
        data     = await self._fetch_bootstrap()
        team_map = {t["id"]: t["name"] for t in data["teams"]}
        pos_map  = {et["id"]: et["singular_name_short"] for et in data["element_types"]}
        return [
            {
                "id": el["id"],
                "name": f"{el['first_name']} {el['second_name']}",
                "web_name": el["web_name"],
                "team": team_map.get(el["team"], "Unknown"),
                "team_id": el["team"],
                "position": pos_map.get(el["element_type"], "Unknown"),
                "total_points": el["total_points"],
                "now_cost": el["now_cost"] / 10,
                "form": _sf(el.get("form")),
                "goals_scored": el.get("goals_scored", 0),
                "assists": el.get("assists", 0),
                "minutes": el.get("minutes", 0),
                "ict_index": _sf(el.get("ict_index")),
                "expected_goals": _sf(el.get("expected_goals")),
                "expected_assists": _sf(el.get("expected_assists")),
                "selected_by_percent": _sf(el.get("selected_by_percent")),
                "status": el.get("status"),
                "chance_of_playing_next_round": el.get("chance_of_playing_next_round"),
            }
            for el in data["elements"]
        ]

    # ── teams ─────────────────────────────────────────────────────────────────
    async def get_teams(self) -> list[dict]:
        data = await self._fetch_bootstrap()
        return [
            {
                "id": t["id"], "name": t["name"], "short_name": t["short_name"],
                "strength": t["strength"],
                "strength_overall_home": t["strength_overall_home"],
                "strength_overall_away": t["strength_overall_away"],
                "strength_attack_home": t["strength_attack_home"],
                "strength_attack_away": t["strength_attack_away"],
                "strength_defence_home": t["strength_defence_home"],
                "strength_defence_away": t["strength_defence_away"],
            }
            for t in data["teams"]
        ]

    # ── fixtures ──────────────────────────────────────────────────────────────
    async def get_fixtures(self) -> list[dict]:
        async with self._client() as c:
            r = await c.get(FIXTURES_URL)
            r.raise_for_status()
            raw = r.json()
        return [
            {
                "id": f["id"], "event": f["event"], "finished": f["finished"],
                "kickoff_time": f["kickoff_time"],
                "team_h": f["team_h"], "team_a": f["team_a"],
                "team_h_score": f["team_h_score"], "team_a_score": f["team_a_score"],
                "team_h_difficulty": f["team_h_difficulty"],
                "team_a_difficulty": f["team_a_difficulty"],
            }
            for f in raw
        ]

    # ── my team ───────────────────────────────────────────────────────────────
    async def get_my_team(self, team_id: int) -> dict:
        async with self._client() as c:
            entry_r, boot_r = await asyncio.gather(
                c.get(f"https://fantasy.premierleague.com/api/entry/{team_id}/"),
                c.get(BOOTSTRAP_URL),
            )
            entry_r.raise_for_status()
            boot_r.raise_for_status()

        entry     = entry_r.json()
        bootstrap = boot_r.json()
        gw        = _current_gw(bootstrap["events"])

        async with self._client() as c:
            picks_r, live_r = await asyncio.gather(
                c.get(f"https://fantasy.premierleague.com/api/entry/{team_id}/event/{gw}/picks/"),
                c.get(f"https://fantasy.premierleague.com/api/event/{gw}/live/"),
            )
            picks_r.raise_for_status()
            live_r.raise_for_status()

        picks    = picks_r.json()
        live     = live_r.json()
        team_map = {t["id"]: t for t in bootstrap["teams"]}
        pos_map  = {et["id"]: et["singular_name_short"] for et in bootstrap["element_types"]}
        el_map   = {el["id"]: el for el in bootstrap["elements"]}
        live_map = {el["id"]: el["stats"] for el in live["elements"]}

        squad = []
        for pick in picks["picks"]:
            el   = el_map.get(pick["element"], {})
            ls   = live_map.get(pick["element"], {})
            team = team_map.get(el.get("team"), {})
            squad.append({
                "id": el.get("id"),
                "web_name": el.get("web_name"),
                "name": f"{el.get('first_name','')} {el.get('second_name','')}".strip(),
                "team": team.get("name", "Unknown"),
                "team_short": team.get("short_name", "?"),
                "team_id": el.get("team"),
                "position": pos_map.get(el.get("element_type"), "Unknown"),
                "now_cost": el.get("now_cost", 0) / 10,
                "total_points": el.get("total_points", 0),
                "gw_points": ls.get("total_points", 0),
                "form": _sf(el.get("form")),
                "goals_scored": el.get("goals_scored", 0),
                "assists": el.get("assists", 0),
                "minutes": el.get("minutes", 0),
                "selected_by_percent": _sf(el.get("selected_by_percent")),
                "status": el.get("status"),
                "multiplier": pick["multiplier"],
                "is_captain": pick["is_captain"],
                "is_vice_captain": pick["is_vice_captain"],
                "position_in_team": pick["position"],
            })

        return {
            "team_id": team_id,
            "team_name": entry.get("name", "Unknown"),
            "manager": f"{entry.get('player_first_name','')} {entry.get('player_last_name','')}".strip(),
            "overall_points": entry.get("summary_overall_points", 0),
            "overall_rank": entry.get("summary_overall_rank", 0),
            "gameweek": gw,
            "gameweek_points": entry.get("summary_event_points", 0),
            "bank": entry.get("last_deadline_bank", 0) / 10,
            "team_value": entry.get("last_deadline_value", 0) / 10,
            "squad": squad,
        }

    # ── player detail ─────────────────────────────────────────────────────────
    async def get_player_detail(self, player_id: int) -> dict:
        async with self._client() as c:
            boot_r, summ_r = await asyncio.gather(
                c.get(BOOTSTRAP_URL),
                c.get(f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"),
            )
            boot_r.raise_for_status()
            summ_r.raise_for_status()

        bootstrap = boot_r.json()
        summary   = summ_r.json()
        el_map    = {el["id"]: el for el in bootstrap["elements"]}
        team_map  = {t["id"]: t["name"] for t in bootstrap["teams"]}
        pos_map   = {et["id"]: et["singular_name_short"] for et in bootstrap["element_types"]}
        el = el_map.get(player_id)
        if not el:
            return {}
        mins = el.get("minutes", 0)
        return {
            "id": el["id"],
            "name": f"{el['first_name']} {el['second_name']}",
            "web_name": el["web_name"],
            "team": team_map.get(el["team"], "Unknown"),
            "position": pos_map.get(el["element_type"], "Unknown"),
            "now_cost": el["now_cost"] / 10,
            "total_points": el["total_points"],
            "form": _sf(el.get("form")),
            "goals_scored": el.get("goals_scored", 0),
            "assists": el.get("assists", 0),
            "clean_sheets": el.get("clean_sheets", 0),
            "goals_conceded": el.get("goals_conceded", 0),
            "minutes": mins,
            "ict_index": _sf(el.get("ict_index")),
            "influence": _sf(el.get("influence")),
            "creativity": _sf(el.get("creativity")),
            "threat": _sf(el.get("threat")),
            "expected_goals": _sf(el.get("expected_goals")),
            "expected_assists": _sf(el.get("expected_assists")),
            "expected_goal_involvements": _sf(el.get("expected_goal_involvements")),
            "selected_by_percent": _sf(el.get("selected_by_percent")),
            "status": el.get("status"),
            "chance_of_playing_next_round": el.get("chance_of_playing_next_round"),
            "history": summary.get("history", [])[-10:],
            "fixtures": summary.get("fixtures", [])[:6],
        }

    # ── player analysis (structured + positional avgs) ────────────────────────
    async def get_player_analysis(self, player_id: int) -> dict:
        async with self._client() as c:
            boot_r, summ_r = await asyncio.gather(
                c.get(BOOTSTRAP_URL),
                c.get(f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"),
            )
            boot_r.raise_for_status()
            summ_r.raise_for_status()

        bootstrap = boot_r.json()
        summary   = summ_r.json()
        el_map    = {el["id"]: el for el in bootstrap["elements"]}
        team_map  = {t["id"]: t["name"] for t in bootstrap["teams"]}
        pos_map   = {et["id"]: et["singular_name_short"] for et in bootstrap["element_types"]}

        el = el_map.get(player_id)
        if not el:
            return {}

        pos_type    = el["element_type"]
        pos_players = [p for p in bootstrap["elements"] if p["element_type"] == pos_type and p.get("minutes", 0) > 90]
        def _avg(key):
            vals = [_sf(p.get(key)) for p in pos_players]
            return round(sum(vals) / len(vals), 2) if vals else 0

        mins = el.get("minutes", 0)
        xg   = _sf(el.get("expected_goals"))
        xa   = _sf(el.get("expected_assists"))

        history  = summary.get("history", [])
        last_5   = [
            {"round": h["round"], "total_points": h["total_points"],
             "minutes": h["minutes"], "goals_scored": h.get("goals_scored", 0),
             "assists": h.get("assists", 0)}
            for h in history[-5:]
        ]
        upcoming = summary.get("fixtures", [])[:5]
        fixtures_out = []
        for f in upcoming:
            opp_id = f["team_a"] if f["is_home"] else f["team_h"]
            fixtures_out.append({
                "event": f["event"],
                "difficulty": f["difficulty"],
                "opponent": team_map.get(opp_id, "Unknown"),
                "is_home": f["is_home"],
            })

        return {
            "id": el["id"],
            "name": f"{el['first_name']} {el['second_name']}",
            "web_name": el["web_name"],
            "team": team_map.get(el["team"], "Unknown"),
            "position": pos_map.get(el["element_type"], "Unknown"),
            "now_cost": el["now_cost"] / 10,
            "total_points": el.get("total_points", 0),
            "form": _sf(el.get("form")),
            "goals_scored": el.get("goals_scored", 0),
            "assists": el.get("assists", 0),
            "minutes": mins,
            "ict_index": _sf(el.get("ict_index")),
            "expected_goals": xg,
            "expected_assists": xa,
            "xg_per_90": round(xg / (mins / 90), 3) if mins >= 90 else 0,
            "xa_per_90": round(xa / (mins / 90), 3) if mins >= 90 else 0,
            "selected_by_percent": _sf(el.get("selected_by_percent")),
            "status": el.get("status"),
            "last_5_gws": last_5,
            "upcoming_fixtures": fixtures_out,
            "positional_averages": {
                "total_points": _avg("total_points"),
                "form": _avg("form"),
                "expected_goals": _avg("expected_goals"),
                "expected_assists": _avg("expected_assists"),
                "ict_index": _avg("ict_index"),
            },
        }

    # ── gameweek summary ──────────────────────────────────────────────────────
    async def get_gameweek_summary(self) -> dict:
        data = await self._fetch_bootstrap()
        gw   = _current_gw(data["events"])

        async with self._client() as c:
            live_r = await c.get(f"https://fantasy.premierleague.com/api/event/{gw}/live/")
            live_r.raise_for_status()

        live     = live_r.json()
        el_map   = {el["id"]: el for el in data["elements"]}
        team_map = {t["id"]: t["name"] for t in data["teams"]}

        live_players = []
        for lel in live["elements"]:
            pl  = el_map.get(lel["id"], {})
            pts = lel["stats"].get("total_points", 0)
            if pts > 0 or lel["stats"].get("minutes", 0) > 0:
                live_players.append({
                    "id": lel["id"],
                    "name": pl.get("web_name", "Unknown"),
                    "team": team_map.get(pl.get("team"), "Unknown"),
                    "gw_points": pts,
                    "goals_scored": lel["stats"].get("goals_scored", 0),
                    "assists": lel["stats"].get("assists", 0),
                    "minutes": lel["stats"].get("minutes", 0),
                    "bonus": lel["stats"].get("bonus", 0),
                })

        most_in  = sorted(data["elements"], key=lambda x: -x.get("transfers_in_event", 0))[:5]
        most_out = sorted(data["elements"], key=lambda x: -x.get("transfers_out_event", 0))[:5]

        return {
            "gameweek": gw,
            "top_scorers": sorted(live_players, key=lambda x: -x["gw_points"])[:10],
            "most_transferred_in":  [{"id": p["id"], "name": p["web_name"], "team": team_map.get(p["team"]), "count": p.get("transfers_in_event",  0)} for p in most_in],
            "most_transferred_out": [{"id": p["id"], "name": p["web_name"], "team": team_map.get(p["team"]), "count": p.get("transfers_out_event", 0)} for p in most_out],
        }

    # ── recommendations ───────────────────────────────────────────────────────
    async def get_recommendations(self, team_id: int) -> dict:
        async with self._client() as c:
            entry_r, boot_r, fix_r = await asyncio.gather(
                c.get(f"https://fantasy.premierleague.com/api/entry/{team_id}/"),
                c.get(BOOTSTRAP_URL),
                c.get(FIXTURES_URL),
            )
            entry_r.raise_for_status()
            boot_r.raise_for_status()
            fix_r.raise_for_status()

        entry     = entry_r.json()
        bootstrap = boot_r.json()
        fixtures  = fix_r.json()
        gw        = _current_gw(bootstrap["events"])

        async with self._client() as c:
            picks_r = await c.get(
                f"https://fantasy.premierleague.com/api/entry/{team_id}/event/{gw}/picks/"
            )
            picks_r.raise_for_status()

        squad_ids = {p["element"] for p in picks_r.json()["picks"]}
        team_map  = {t["id"]: t for t in bootstrap["teams"]}
        pos_map   = {et["id"]: et["singular_name_short"] for et in bootstrap["element_types"]}

        upcoming   = [f for f in fixtures if not f["finished"] and f["event"] is not None]
        future_gws = sorted({f["event"] for f in upcoming})[:5]

        def get_next_fixtures(t_id: int) -> list[dict]:
            result = []
            for f in upcoming:
                if f["event"] not in future_gws:
                    continue
                if f["team_h"] == t_id:
                    opp = team_map.get(f["team_a"], {})
                    result.append({"gw": f["event"], "opp": opp.get("short_name", "?"), "is_home": True,  "fdr": f["team_h_difficulty"]})
                elif f["team_a"] == t_id:
                    opp = team_map.get(f["team_h"], {})
                    result.append({"gw": f["event"], "opp": opp.get("short_name", "?"), "is_home": False, "fdr": f["team_a_difficulty"]})
            return sorted(result, key=lambda x: x["gw"])[:5]

        # Position-aware strength-based difficulty.
        # Attackers (MID/FWD) face the opponent's defensive strength.
        # Defenders/GKs (DEF/GKP) face the opponent's attacking strength.
        # Home/away: if the player is at home the opponent plays away, so use
        # the opponent's away rating, and vice versa.
        ATT_POSITIONS = {"MID", "FWD"}

        def strength_difficulty(opp: dict, is_home: bool, position: str) -> float:
            if position in ATT_POSITIONS:
                key = "strength_defence_away" if is_home else "strength_defence_home"
            else:
                key = "strength_attack_away" if is_home else "strength_attack_home"
            return float(opp.get(key) or 1200)

        def avg_strength_fdr(t_id: int, position: str) -> float:
            scores = []
            for f in upcoming:
                if f["event"] not in future_gws:
                    continue
                if f["team_h"] == t_id:
                    opp = team_map.get(f["team_a"], {})
                    scores.append(strength_difficulty(opp, is_home=True,  position=position))
                elif f["team_a"] == t_id:
                    opp = team_map.get(f["team_h"], {})
                    scores.append(strength_difficulty(opp, is_home=False, position=position))
            return sum(scores) / len(scores) if scores else 1200.0

        rows = []
        for el in bootstrap["elements"]:
            mins  = el.get("minutes", 0)
            xg    = _sf(el.get("expected_goals"))
            xa    = _sf(el.get("expected_assists"))
            xg90  = (xg + xa) / (mins / 90) if mins >= 45 else 0
            pos   = pos_map.get(el["element_type"], "MID")
            team  = team_map.get(el["team"], {})
            rows.append({
                "id": el["id"],
                "web_name": el["web_name"],
                "name": f"{el['first_name']} {el['second_name']}",
                "team": team.get("name", "Unknown"),
                "team_short": team.get("short_name", "?"),
                "team_id": el["team"],
                "position": pos,
                "now_cost": el["now_cost"] / 10,
                "total_points": el["total_points"],
                "form": _sf(el.get("form")),
                "goals_scored": el.get("goals_scored", 0),
                "assists": el.get("assists", 0),
                "minutes": mins,
                "ict_index": _sf(el.get("ict_index")),
                "expected_goals": xg,
                "expected_assists": xa,
                "selected_by_percent": _sf(el.get("selected_by_percent")),
                "status": el.get("status"),
                "in_squad": el["id"] in squad_ids,
                "_str_fdr": avg_strength_fdr(el["team"], pos),
                "_xg90": xg90,
                "_mpg": mins / max(gw, 1),
            })

        def norm(vals: list, invert: bool = False) -> list:
            mn, mx = min(vals), max(vals)
            if mx == mn:
                return [5.0] * len(vals)
            out = [(v - mn) / (mx - mn) * 10 for v in vals]
            return [10 - v for v in out] if invert else out

        # Weights: fixtures 50%, form 20%, xG+xA 20%, minutes 10%
        form_s = norm([r["form"]      for r in rows])
        fix_s  = norm([r["_str_fdr"]  for r in rows], invert=True)
        xg_s   = norm([r["_xg90"]     for r in rows])
        min_s  = norm([r["_mpg"]      for r in rows])

        for i, r in enumerate(rows):
            r["transfer_score"] = round(form_s[i]*0.20 + fix_s[i]*0.50 + xg_s[i]*0.20 + min_s[i]*0.10, 2)
            r["score_breakdown"] = {
                "form":    round(form_s[i], 2),
                "fixture": round(fix_s[i],  2),
                "xg_xa":   round(xg_s[i],   2),
                "minutes": round(min_s[i],  2),
            }
            r["next_fixtures"] = get_next_fixtures(r["team_id"])
            del r["_str_fdr"], r["_xg90"], r["_mpg"]

        squad_rows = [r for r in rows if r["in_squad"]]
        non_squad  = [r for r in rows if not r["in_squad"]]
        transfers_out = sorted(squad_rows, key=lambda r: r["transfer_score"])
        transfers_in  = sorted(non_squad,  key=lambda r: -r["transfer_score"])[:20]

        worst_by_pos = {}
        for r in transfers_out:
            worst_by_pos.setdefault(r["position"], r)
        for r in transfers_in:
            r["replace_player"] = worst_by_pos.get(r["position"])

        return {
            "transfers_in":  transfers_in,
            "transfers_out": transfers_out,
            "budget":        entry.get("last_deadline_bank", 0) / 10,
            "team_value":    entry.get("last_deadline_value", 0) / 10,
            "gameweek":      gw,
        }

    # ── AI chat ───────────────────────────────────────────────────────────────
    async def ai_chat(self, message: str, team_id: str | None = None) -> str:
        api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if not api_key:
            return (
                "⚙️ **AI features not configured.**\n\n"
                "Add your Anthropic API key to `backend/.env`:\n"
                "```\nANTHROPIC_API_KEY=sk-ant-...\n```\n"
                "Then restart the backend server."
            )

        context: dict = {}

        # Bootstrap + GW summary (parallel)
        try:
            boot_task = asyncio.create_task(self._fetch_bootstrap())
            gw_task   = asyncio.create_task(self.get_gameweek_summary())
            bootstrap = await boot_task
            context["current_gameweek"] = _current_gw(bootstrap["events"])
            gw_summary = await gw_task
            context["gameweek_summary"] = gw_summary
        except Exception as ex:
            context["data_fetch_error"] = str(ex)

        # Team + recommendations (parallel, only if team_id given)
        if team_id:
            try:
                team_data, recs = await asyncio.gather(
                    self.get_my_team(int(team_id)),
                    self.get_recommendations(int(team_id)),
                    return_exceptions=True,
                )
                if not isinstance(team_data, Exception):
                    context["my_team"] = {
                        "team_name": team_data["team_name"],
                        "manager": team_data["manager"],
                        "overall_points": team_data["overall_points"],
                        "overall_rank": team_data["overall_rank"],
                        "gameweek_points": team_data["gameweek_points"],
                        "bank": f"£{team_data['bank']}m",
                        "squad": [
                            {
                                "name": p["web_name"], "team": p["team"],
                                "position": p["position"], "price": f"£{p['now_cost']}m",
                                "total_pts": p["total_points"], "gw_pts": p["gw_points"],
                                "form": p["form"],
                                "captain": p["is_captain"], "vice_captain": p["is_vice_captain"],
                                "bench": p["position_in_team"] > 11,
                            }
                            for p in team_data["squad"]
                        ],
                    }
                if not isinstance(recs, Exception):
                    context["transfer_recommendations"] = {
                        "top_buys": [
                            {"name": p["web_name"], "team": p["team_short"], "pos": p["position"],
                             "price": f"£{p['now_cost']}m", "score": p["transfer_score"],
                             "form": p["form"], "next_3_fixtures": p["next_fixtures"][:3]}
                            for p in recs["transfers_in"][:8]
                        ],
                        "consider_selling": [
                            {"name": p["web_name"], "pos": p["position"], "score": p["transfer_score"], "form": p["form"]}
                            for p in recs["transfers_out"][:5]
                        ],
                    }
            except Exception:
                pass

        system_prompt = (
            "You are an expert FPL (Fantasy Premier League) advisor. "
            "Give specific, actionable advice backed by the data provided. "
            "Reference actual player names, stats, and fixture difficulties. "
            "Be opinionated — don't sit on the fence. "
            "Format responses with clear markdown: **bold** key points, use bullet lists, "
            "keep it concise.\n\n"
            f"Current FPL data:\n{json.dumps(context, indent=2, default=str)}"
        )

        client   = anthropic.AsyncAnthropic(api_key=api_key)
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": message}],
        )
        return response.content[0].text
