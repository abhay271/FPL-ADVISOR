# FPL Advisor

A full-stack Fantasy Premier League assistant powered by live FPL data and Claude AI. Get transfer recommendations, fixture difficulty ratings, and AI-driven squad analysis — all in one dark-themed dashboard.

---

## Features

- **Player Stats** — sortable, filterable table of all 800+ FPL players with xG, xA, ICT, form, and more
- **Fixture Difficulty Visualiser** — 20-team × 6-GW FDR grid with position-aware strength ratings
- **My Team** — football pitch view of your squad with live GW points and captain badges
- **Transfer Recommender** — weighted scoring algorithm (fixtures 50 %, form 20 %, xG+xA 20 %, minutes 10 %) surfacing the best buys and weakest sells
- **AI Advisor** — chat interface backed by Claude that gives opinionated, data-grounded FPL advice

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · FastAPI · httpx · Anthropic SDK |
| Frontend | React 18 · Vite · Tailwind CSS v3 · React Router v6 |
| AI | Claude (`claude-sonnet-4-6`) via Anthropic API |
| Data | Official FPL API (`fantasy.premierleague.com`) |

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone the repo

```bash
git clone https://github.com/abhay271/FPL-ADVISOR.git
cd FPL-ADVISOR
```

### 2. Backend

```bash
cd backend
python -m venv venv
```

**Windows:**
```bash
venv\Scripts\activate
```

**macOS / Linux:**
```bash
source venv/bin/activate
```

```bash
pip install -r requirements.txt
```

Create `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Start the server:

```bash
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. Visit `http://localhost:8000/api/status` to confirm it's up.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Project Structure

```
fpl-advisor/
├── backend/
│   ├── main.py                  # FastAPI app & route definitions
│   ├── services/
│   │   └── fpl_service.py       # FPL API client + scoring + AI chat
│   ├── tests/
│   │   └── test_smoke.py
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/               # PlayersPage, FixturesPage, MyTeamPage, TransfersPage, AIAdvisorPage
        ├── components/          # Tooltip, TeamIdGate
        ├── hooks/               # useTeamId
        └── utils/               # fixtures.js (FDR helpers)
```

---

## License

[MIT](LICENSE)
