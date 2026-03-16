# FPL Advisor — Backend

FastAPI backend that proxies and parses data from the official Fantasy Premier League API.

## Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the dev server
uvicorn main:app --reload --port 8000
```

The API will be available at http://localhost:8000.
Interactive docs: http://localhost:8000/docs

## Endpoints

| Method | Path            | Description                                      |
|--------|-----------------|--------------------------------------------------|
| GET    | /api/players    | All players with stats (cost, form, xG, etc.)   |
| GET    | /api/teams      | All 20 PL teams with strength ratings            |
| GET    | /api/fixtures   | All fixtures with FDR difficulty ratings         |

## Notes

- `now_cost` is returned in £m (e.g. 9.5 = £9.5m)
- Player positions: GKP, DEF, MID, FWD
- FDR difficulty is 1–5 (1 = easiest, 5 = hardest)
