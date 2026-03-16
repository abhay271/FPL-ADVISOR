import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTeamId } from "../hooks/useTeamId.js";
import { TeamIdGate } from "../components/TeamIdGate.jsx";
import { FDR } from "../utils/fixtures.js";

const POSITIONS   = ["ALL", "GKP", "DEF", "MID", "FWD"];
// TODO(v2): add a budget filter so users can hide transfers they can't afford
const SCORE_DIMS  = [
  { key: "form",    label: "Form",     color: "#00ff87" },
  { key: "fixture", label: "Fixtures", color: "#01d167" },
  { key: "xg_xa",  label: "xG+xA",   color: "#f59e0b" },
  { key: "minutes", label: "Minutes",  color: "#a78bfa" },
];

// ─── Score color ───────────────────────────────────────────────────────────────
function scoreColor(s) {
  if (s >= 7) return "text-emerald-400";
  if (s >= 5) return "text-yellow-400";
  return "text-red-400";
}
function scoreBg(s) {
  if (s >= 7) return "#065f46";
  if (s >= 5) return "#713f12";
  return "#7f1d1d";
}

// ─── Mini bar chart ────────────────────────────────────────────────────────────
function ScoreBars({ breakdown }) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {SCORE_DIMS.map(({ key, label, color }) => {
        const val = breakdown?.[key] ?? 0;
        return (
          <div key={key} className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-500 w-11 shrink-0">{label}</span>
            <div className="flex-1 bg-dark-500 rounded-full h-1 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(val / 10) * 100}%`, background: color }}
              />
            </div>
            <span className="text-[9px] tabular-nums text-slate-400 w-5 text-right">{val.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Fixture dots ──────────────────────────────────────────────────────────────
function FixtureDots({ fixtures }) {
  if (!fixtures?.length) return <span className="text-slate-700 text-xs">No fixtures</span>;
  return (
    <div className="flex gap-1 flex-wrap">
      {fixtures.map((f, i) => {
        const fdr = FDR[f.fdr] ?? FDR[3];
        return (
          <span
            key={i}
            title={`GW${f.gw}: ${f.opp} (${f.is_home ? "H" : "A"}) — FDR ${f.fdr}`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
            style={{ background: fdr.bg, color: fdr.text }}
          >
            {f.opp}
          </span>
        );
      })}
    </div>
  );
}

// ─── AI Explain Modal ──────────────────────────────────────────────────────────
function ExplainModal({ player, teamId, onClose }) {
  const [response, setResponse] = useState("");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const side   = player.in_squad ? "selling" : "buying";
    const prompt =
      `Explain in detail why ${player.web_name} (${player.team}, ${player.position}, £${player.now_cost.toFixed(1)}m) ` +
      `is being recommended for ${side}. ` +
      `Their transfer score is ${player.transfer_score.toFixed(1)}/10. ` +
      `Score breakdown — Fixtures: ${player.score_breakdown?.fixture?.toFixed(1)}, ` +
      `Form: ${player.score_breakdown?.form?.toFixed(1)}, ` +
      `xG+xA: ${player.score_breakdown?.xg_xa?.toFixed(1)}, ` +
      `Minutes: ${player.score_breakdown?.minutes?.toFixed(1)}. ` +
      `Give a natural language explanation with context and a clear recommendation.`;
    fetch("/api/ai-chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message: prompt, team_id: teamId || null }),
    })
      .then((r) => r.json())
      .then((d) => setResponse(d.response ?? d.detail ?? "No response."))
      .catch(() => setResponse("⚠️ Error fetching explanation."))
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
              <span className="text-fpl-green">✦</span>
              Why {player.web_name}?
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Transfer score: {player.transfer_score.toFixed(1)}/10 · {player.position} · £{player.now_cost.toFixed(1)}m
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-2xl leading-none">×</button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-5 h-5 border-2 border-fpl-green border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-sm">Generating explanation…</span>
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

// ─── Player card ───────────────────────────────────────────────────────────────
function PlayerCard({ player, canAfford = true, isSelected, onSelect, onExplain }) {
  const score = player.transfer_score ?? 0;

  return (
    <div
      onClick={() => onSelect(player)}
      className={`
        card p-3.5 cursor-pointer transition-all
        ${isSelected ? "border-fpl-green ring-1 ring-fpl-green" : "hover:border-dark-400"}
        ${!canAfford ? "opacity-50" : ""}
      `}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-100 truncate">{player.web_name}</span>
            {!canAfford && (
              <span className="text-[9px] text-red-400 font-semibold shrink-0">Too expensive</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {player.team_short} · {player.position} · £{player.now_cost.toFixed(1)}m
          </div>
        </div>

        {/* Transfer score badge */}
        <div
          className="flex flex-col items-center justify-center rounded-lg px-2 py-1 shrink-0 min-w-[44px]"
          style={{ background: scoreBg(score) }}
        >
          <span className={`text-lg font-black tabular-nums leading-none ${scoreColor(score)}`}>
            {score.toFixed(1)}
          </span>
          <span className="text-[9px] text-slate-400 leading-none mt-0.5">score</span>
        </div>
      </div>

      {/* Score breakdown bars */}
      <ScoreBars breakdown={player.score_breakdown} />

      {/* Next 5 fixtures + Explain */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div>
          <span className="text-[9px] text-slate-600 mr-1.5">Next 5:</span>
          <FixtureDots fixtures={player.next_fixtures} />
        </div>
        {onExplain && (
          <button
            onClick={(e) => { e.stopPropagation(); onExplain(player); }}
            className="text-[10px] px-2 py-0.5 rounded border border-dark-400 text-fpl-green
                       hover:bg-fpl-green/10 transition-colors shrink-0 flex items-center gap-1"
          >
            ✦ Explain
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Compare panel ─────────────────────────────────────────────────────────────
const COMPARE_STATS = [
  { key: "total_points",     label: "Total Pts",   higher: true },
  { key: "now_cost",         label: "Price £m",    higher: false, fmt: (v) => v.toFixed(1) },
  { key: "form",             label: "Form",        higher: true,  fmt: (v) => v.toFixed(1) },
  { key: "goals_scored",     label: "Goals",       higher: true  },
  { key: "assists",          label: "Assists",     higher: true  },
  { key: "expected_goals",   label: "xG",          higher: true,  fmt: (v) => v.toFixed(2) },
  { key: "expected_assists", label: "xA",          higher: true,  fmt: (v) => v.toFixed(2) },
  { key: "minutes",          label: "Minutes",     higher: true  },
  { key: "ict_index",        label: "ICT",         higher: true,  fmt: (v) => v.toFixed(1) },
  { key: "selected_by_percent", label: "Sel %",   higher: false, fmt: (v) => `${v.toFixed(1)}%` },
  { key: "transfer_score",   label: "Transfer Score", higher: true, fmt: (v) => v.toFixed(2) },
];

function ComparePanel({ players, onClose }) {
  const [a, b] = players;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-500">
          <h3 className="font-bold text-slate-100">Player Comparison</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xl leading-none">×</button>
        </div>

        {/* Player names */}
        <div className="grid grid-cols-3 gap-0 text-center border-b border-dark-500">
          <div className="p-3 bg-dark-600">
            <div className="font-bold text-slate-100">{a.web_name}</div>
            <div className="text-xs text-slate-500">{a.team_short} · £{a.now_cost.toFixed(1)}m</div>
          </div>
          <div className="p-3 flex items-center justify-center text-slate-600 text-xs font-bold">VS</div>
          <div className="p-3 bg-dark-600">
            <div className="font-bold text-slate-100">{b.web_name}</div>
            <div className="text-xs text-slate-500">{b.team_short} · £{b.now_cost.toFixed(1)}m</div>
          </div>
        </div>

        {/* Stats rows */}
        {COMPARE_STATS.map(({ key, label, higher, fmt }) => {
          const av = a[key] ?? 0;
          const bv = b[key] ?? 0;
          const aWins = higher ? av > bv : av < bv;
          const bWins = higher ? bv > av : bv < av;
          const fmtVal = fmt ?? ((v) => v);
          return (
            <div key={key} className="grid grid-cols-3 gap-0 border-b border-dark-700 text-sm">
              <div className={`px-4 py-2.5 text-right tabular-nums font-medium ${aWins ? "text-fpl-green" : "text-slate-300"}`}>
                {fmtVal(av)}
              </div>
              <div className="px-2 py-2.5 text-center text-xs text-slate-500 flex items-center justify-center">
                {label}
              </div>
              <div className={`px-4 py-2.5 text-left tabular-nums font-medium ${bWins ? "text-fpl-green" : "text-slate-300"}`}>
                {fmtVal(bv)}
              </div>
            </div>
          );
        })}

        {/* Fixtures */}
        <div className="grid grid-cols-2 gap-4 p-4">
          {[a, b].map((p) => (
            <div key={p.id}>
              <div className="text-xs text-slate-500 mb-1.5">{p.web_name} — Next 5</div>
              <FixtureDots fixtures={p.next_fixtures} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Inner transfers view ──────────────────────────────────────────────────────
function TransfersView({ teamId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [posTab, setPosTab]   = useState("ALL");
  const [selected, setSelected]     = useState([]); // up to 2 for compare
  const [explainModal, setExplainModal] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/recommendations/${teamId}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [teamId]);

  const handleSelect = (player) => {
    setSelected((prev) => {
      const alreadyIdx = prev.findIndex((p) => p.id === player.id);
      if (alreadyIdx >= 0) return prev.filter((_, i) => i !== alreadyIdx);
      if (prev.length >= 2) return [prev[1], player]; // replace oldest
      return [...prev, player];
    });
  };

  const { transfersIn, transfersOut } = useMemo(() => {
    if (!data) return { transfersIn: [], transfersOut: [] };
    const filter = (list) =>
      posTab === "ALL" ? list : list.filter((p) => p.position === posTab);
    return {
      transfersIn:  filter(data.transfers_in),
      transfersOut: filter(data.transfers_out),
    };
  }, [data, posTab]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-fpl-green border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Computing transfer recommendations…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="card p-6 text-center max-w-sm">
        <p className="text-red-400 font-semibold">Failed to load recommendations</p>
        <p className="text-slate-500 text-sm mt-1">{error}</p>
      </div>
    </div>
  );

  const budget = data?.budget ?? 0;

  return (
    <div className="flex flex-col gap-5 pt-8">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Transfer Recommendations</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Scored on fixtures (50%) · form (20%) · xG+xA (20%) · minutes (10%)
          </p>
        </div>

        {/* Budget */}
        <div className="flex items-center gap-2 card px-4 py-2">
          <span className="text-xs text-slate-500">Money in bank:</span>
          <span className={`font-bold tabular-nums text-sm ${budget >= 0 ? "text-fpl-green" : "text-red-400"}`}>
            £{budget.toFixed(1)}m
          </span>
        </div>
      </div>

      {/* Position tabs */}
      <div className="flex gap-1.5">
        {POSITIONS.map((pos) => (
          <button key={pos} onClick={() => setPosTab(pos)}
            className={`filter-btn ${posTab === pos ? "active" : ""}`}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Compare bar */}
      {selected.length > 0 && (
        <div className="card p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 text-xs">Comparing:</span>
            {selected.map((p) => (
              <span key={p.id} className="bg-fpl-green/10 text-fpl-green px-2 py-0.5 rounded text-xs font-semibold">
                {p.web_name}
                <button onClick={() => handleSelect(p)} className="ml-1 opacity-60 hover:opacity-100">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            {selected.length === 2 && (
              <button
                className="text-xs bg-fpl-green text-dark-900 font-bold px-3 py-1 rounded hover:brightness-110"
              >
                Compare ↗
              </button>
            )}
            <button onClick={() => setSelected([])} className="text-xs text-slate-500 hover:text-slate-200">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Transfer OUT (sell) ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-300">
              Transfer Out
            </h3>
            <span className="text-xs text-slate-600">Weakest players in your squad</span>
          </div>
          {transfersOut.length === 0 ? (
            <div className="card p-6 text-center text-slate-600 text-sm">No squad data for this position.</div>
          ) : (
            transfersOut.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                canAfford
                isSelected={selected.some((s) => s.id === p.id)}
                onSelect={handleSelect}
                onExplain={setExplainModal}
              />
            ))
          )}
        </div>

        {/* ── Transfer IN (buy) ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-300">Transfer In</h3>
            <span className="text-xs text-slate-600">Best available players to buy</span>
          </div>
          {transfersIn.length === 0 ? (
            <div className="card p-6 text-center text-slate-600 text-sm">No recommendations for this position.</div>
          ) : (
            transfersIn.map((p) => {
              const afford = p.now_cost <= (budget + (p.replace_player?.now_cost ?? 0));
              return (
                <div key={p.id} className="flex flex-col gap-0">
                  <PlayerCard
                    player={p}
                    canAfford={afford}
                    isSelected={selected.some((s) => s.id === p.id)}
                    onSelect={handleSelect}
                  />
                  {/* Suggested swap */}
                  {p.replace_player && (
                    <div className="bg-dark-600 rounded-b-xl px-3.5 py-2 border border-dark-500 border-t-0 flex items-center gap-2 text-xs text-slate-500">
                      <span>↔ Replace:</span>
                      <span className="text-slate-400 font-medium">{p.replace_player.web_name}</span>
                      <span>£{p.replace_player.now_cost.toFixed(1)}m</span>
                      <span className={`font-semibold ${scoreColor(p.replace_player.transfer_score)}`}>
                        Score {p.replace_player.transfer_score?.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Compare modal */}
      {selected.length === 2 && (
        <ComparePanel players={selected} onClose={() => setSelected([])} />
      )}

      {/* AI Explain modal */}
      {explainModal && (
        <ExplainModal player={explainModal} teamId={teamId} onClose={() => setExplainModal(null)} />
      )}
    </div>
  );
}

// ─── Page wrapper ──────────────────────────────────────────────────────────────
export default function TransfersPage() {
  const { teamId, setTeamId, clearTeamId } = useTeamId();

  return (
    <TeamIdGate teamId={teamId} onSave={setTeamId} onClear={clearTeamId}>
      {(id) => <TransfersView teamId={id} />}
    </TeamIdGate>
  );
}
