import { useState, useEffect, useMemo, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Tooltip } from "../components/Tooltip.jsx";
import { useTeamId } from "../hooks/useTeamId.js";

// ─── Column definitions ────────────────────────────────────────────────────────
const COLUMNS = [
  { key: "web_name",            label: "Player",  tooltip: null,                                              align: "left"   },
  { key: "team",                label: "Team",    tooltip: null,                                              align: "left"   },
  { key: "position",            label: "Pos",     tooltip: "Position",                                        align: "center" },
  { key: "now_cost",            label: "Price",   tooltip: "Current price in £m",                             align: "right",  fmt: (v) => `£${v.toFixed(1)}` },
  { key: "total_points",        label: "Pts",     tooltip: "Total points this season",                        align: "right"  },
  { key: "form",                label: "Form",    tooltip: "Average points per game over the last 30 days",   align: "right",  fmt: (v) => v.toFixed(1), colored: true },
  { key: "goals_scored",        label: "GS",      tooltip: "Goals Scored",                                    align: "right"  },
  { key: "assists",             label: "A",       tooltip: "Assists",                                         align: "right"  },
  { key: "expected_goals",      label: "xG",      tooltip: "Expected Goals",                                  align: "right",  fmt: (v) => v.toFixed(2) },
  { key: "expected_assists",    label: "xA",      tooltip: "Expected Assists",                                align: "right",  fmt: (v) => v.toFixed(2) },
  { key: "minutes",             label: "Min",     tooltip: "Minutes Played",                                  align: "right"  },
  { key: "ict_index",           label: "ICT",     tooltip: "Influence + Creativity + Threat Index",           align: "right",  fmt: (v) => v.toFixed(1) },
  { key: "selected_by_percent", label: "Sel %",   tooltip: "Selected by % of all FPL managers",              align: "right",  fmt: (v) => `${v.toFixed(1)}%` },
];

const POSITIONS = ["GKP", "DEF", "MID", "FWD"];
const PRICE_MIN = 3.5;
const PRICE_MAX = 16.0;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formColor(form) {
  if (form > 6)  return "text-emerald-400";
  if (form >= 4) return "text-yellow-400";
  return "text-red-400";
}

function SortIcon({ colKey, sortCol, sortDir }) {
  if (sortCol !== colKey) return <span className="ml-1 opacity-20">↕</span>;
  return <span className="ml-1 text-fpl-green">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function StatusDot({ status }) {
  if (status === "a") return null;
  const map = { d: ["bg-yellow-400", "Doubtful"], i: ["bg-red-500", "Injured"], s: ["bg-orange-400", "Suspended"] };
  const [color, label] = map[status] ?? ["bg-slate-500", "Unavailable"];
  return <span title={label} className={`inline-block w-2 h-2 rounded-full ${color} ml-1.5 shrink-0`} />;
}

// ─── AI Player Modal ──────────────────────────────────────────────────────────
function AIPlayerModal({ player, teamId, onClose }) {
  const [response, setResponse] = useState("");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const prompt =
      `Give me a concise FPL analysis of **${player.web_name}** (${player.team}, ${player.position}). ` +
      `Stats: ${player.total_points} pts, form ${player.form.toFixed(1)}, ` +
      `£${player.now_cost.toFixed(1)}m, selected by ${player.selected_by_percent.toFixed(1)}%, ` +
      `xG ${player.expected_goals.toFixed(2)}, xA ${player.expected_assists.toFixed(2)}, ` +
      `${player.minutes} mins, ICT ${player.ict_index.toFixed(1)}. ` +
      `Should I buy this player? Cover: current form, fixture outlook, verdict (buy/hold/avoid), and one key risk.`;
    fetch("/api/ai-chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message: prompt, team_id: teamId || null }),
    })
      .then((r) => r.json())
      .then((d) => setResponse(d.response ?? d.detail ?? "No response."))
      .catch(() => setResponse("⚠️ Error fetching AI analysis."))
      .finally(() => setLoading(false));
  }, [player.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-dark-500">
          <div>
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <span className="text-fpl-green text-lg">✦</span>
              AI Analysis: {player.web_name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{player.team} · {player.position} · £{player.now_cost.toFixed(1)}m</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-2xl leading-none">×</button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-5 h-5 border-2 border-fpl-green border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-sm">Analysing {player.web_name}…</span>
            </div>
          ) : (
            <div className="md-prose text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{response}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function PlayersPage() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]           = useState("");
  const [activePos, setActivePos]     = useState(new Set());
  const [teamFilter, setTeamFilter]   = useState("");
  const [priceMin, setPriceMin]       = useState(PRICE_MIN);
  const [priceMax, setPriceMax]       = useState(PRICE_MAX);
  const [aiModal, setAiModal]         = useState(null);
  const { teamId }                    = useTeamId();
  const [sortCol, setSortCol]         = useState("total_points");
  const [sortDir, setSortDir]         = useState("desc");

  useEffect(() => {
    fetch("/api/players")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setPlayers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const teams = useMemo(() => [...new Set(players.map((p) => p.team))].sort(), [players]);

  const filtered = useMemo(() => {
    let list = players;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.web_name.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }
    if (activePos.size > 0) list = list.filter((p) => activePos.has(p.position));
    if (teamFilter) list = list.filter((p) => p.team === teamFilter);
    list = list.filter((p) => p.now_cost >= priceMin && p.now_cost <= priceMax);
    return [...list].sort((a, b) => {
      const av = a[sortCol] ?? 0, bv = b[sortCol] ?? 0;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [players, search, activePos, teamFilter, priceMin, priceMax, sortCol, sortDir]);

  const handleSort = useCallback((col) => {
    setSortCol((prev) => {
      if (prev === col.key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return prev; }
      setSortDir("desc");
      return col.key;
    });
  }, []);

  const togglePos = useCallback((pos) => {
    setActivePos((prev) => { const n = new Set(prev); n.has(pos) ? n.delete(pos) : n.add(pos); return n; });
  }, []);

  const hasFilters = search || activePos.size > 0 || teamFilter || priceMin > PRICE_MIN || priceMax < PRICE_MAX;
  const clearFilters = () => { setSearch(""); setActivePos(new Set()); setTeamFilter(""); setPriceMin(PRICE_MIN); setPriceMax(PRICE_MAX); };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-fpl-green border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading player data…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="card p-6 text-center max-w-sm">
        <p className="text-red-400 font-semibold mb-1">Failed to load players</p>
        <p className="text-slate-500 text-sm">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-xs text-slate-500 font-medium">Search</label>
            <input type="text" placeholder="Player name…" value={search}
              onChange={(e) => setSearch(e.target.value)} className="input-base w-full" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Position</label>
            <div className="flex gap-1">
              {POSITIONS.map((pos) => (
                <button key={pos} onClick={() => togglePos(pos)} className={`filter-btn ${activePos.has(pos) ? "active" : ""}`}>{pos}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs text-slate-500 font-medium">Team</label>
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="input-base w-full">
              <option value="">All teams</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">
              Price: £{priceMin.toFixed(1)}m – £{priceMax.toFixed(1)}m
            </label>
            <div className="flex items-center gap-2">
              <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={0.1} value={priceMin}
                onChange={(e) => setPriceMin(Math.min(parseFloat(e.target.value), priceMax - 0.5))}
                className="w-28 accent-fpl-green" />
              <span className="text-slate-600 text-xs">to</span>
              <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={0.1} value={priceMax}
                onChange={(e) => setPriceMax(Math.max(parseFloat(e.target.value), priceMin + 0.5))}
                className="w-28 accent-fpl-green" />
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="filter-btn text-slate-500 hover:text-red-400 hover:border-red-500 self-end">
              Clear ×
            </button>
          )}
        </div>
      </div>

      {/* AI modal */}
      {aiModal && <AIPlayerModal player={aiModal} teamId={teamId} onClose={() => setAiModal(null)} />}

      {/* Results bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-slate-400">
          Showing <span className="text-fpl-green font-semibold">{filtered.length}</span> of {players.length} players
        </p>
        <p className="text-xs text-slate-600">
          Sorted by <span className="text-slate-400">{COLUMNS.find((c) => c.key === sortCol)?.label}</span>{" "}
          ({sortDir === "desc" ? "high → low" : "low → high"})
        </p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-dark-600 border-b border-dark-400">
                <th className="th-cell w-8 text-center">#</th>
                <th className="th-cell w-8 text-center">AI</th>
                {COLUMNS.map((col) => (
                  <th key={col.key}
                    className={`th-cell ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                    onClick={() => handleSort(col)}
                  >
                    <Tooltip text={col.tooltip}>
                      <span>{col.label}</span>
                      <SortIcon colKey={col.key} sortCol={sortCol} sortDir={sortDir} />
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="text-center py-12 text-slate-500 text-sm">
                    No players match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((player, idx) => (
                  <PlayerRow key={player.id} player={player} rank={idx + 1} sortCol={sortCol} onAiClick={() => setAiModal(player)} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────
const POS_STYLE = {
  GKP: "text-yellow-400 bg-yellow-400/10",
  DEF: "text-sky-400 bg-sky-400/10",
  MID: "text-emerald-400 bg-emerald-400/10",
  FWD: "text-red-400 bg-red-400/10",
};

const PlayerRow = memo(function PlayerRow({ player, rank, sortCol, onAiClick }) {
  return (
    <tr className="border-b border-dark-600 hover:bg-dark-600 transition-colors">
      <td className="td-cell text-center text-slate-600 text-xs w-8">{rank}</td>
      <td className="td-cell text-center w-8">
        <button
          onClick={onAiClick}
          title="AI analysis"
          className="text-slate-600 hover:text-fpl-green transition-colors text-base leading-none"
        >✦</button>
      </td>
      {COLUMNS.map((col) => {
        const raw     = player[col.key];
        const display = col.fmt ? col.fmt(raw) : raw;
        const isActive = sortCol === col.key;

        if (col.key === "form") return (
          <td key={col.key} className={`td-cell text-right font-semibold ${formColor(raw)}`}>{display}</td>
        );
        if (col.key === "web_name") return (
          <td key={col.key} className="td-cell">
            <div className="flex items-center gap-1">
              <span className={`font-medium ${isActive ? "text-slate-100" : "text-slate-200"}`}>{display}</span>
              <StatusDot status={player.status} />
            </div>
          </td>
        );
        if (col.key === "position") return (
          <td key={col.key} className="td-cell text-center">
            <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${POS_STYLE[raw] ?? "text-slate-400 bg-slate-400/10"}`}>
              {display}
            </span>
          </td>
        );
        const alignClass = col.align === "right" ? "text-right tabular-nums" : col.align === "center" ? "text-center" : "";
        return (
          <td key={col.key} className={`td-cell ${alignClass} ${isActive ? "text-slate-100" : "text-slate-300"}`}>
            {display ?? "—"}
          </td>
        );
      })}
    </tr>
  );
});
