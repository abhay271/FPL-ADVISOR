import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FDR, getCurrentGW, getNextFixture } from "../utils/fixtures.js";
import { useTeamId } from "../hooks/useTeamId.js";
import { TeamIdGate } from "../components/TeamIdGate.jsx";

const POS_ORDER = ["GKP", "DEF", "MID", "FWD"];
// TODO(v2): support multiple gameweeks — let the user browse their team history GW by GW

// ─── Football pitch CSS ────────────────────────────────────────────────────────
function Pitch({ children }) {
  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      style={{
        minHeight: 520,
        background: `
          repeating-linear-gradient(
            to bottom,
            #1b6e33 0px, #1b6e33 65px,
            #1f7d3b 65px, #1f7d3b 130px
          )
        `,
        border: "2px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* ── Field markings (all pointer-events-none) ── */}

      {/* Inner pitch border */}
      <div className="absolute inset-[5%] border border-white/15 rounded pointer-events-none" />

      {/* Halfway line */}
      <div className="absolute top-1/2 left-[5%] right-[5%] h-px bg-white/15 pointer-events-none" />

      {/* Centre circle */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 pointer-events-none"
        style={{ width: 96, height: 96 }}
      />
      {/* Centre dot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/20 pointer-events-none" />

      {/* Top penalty box */}
      <div
        className="absolute left-1/2 -translate-x-1/2 border border-white/15 border-t-0 pointer-events-none"
        style={{ top: "5%", width: "52%", height: "16%" }}
      />
      {/* Top goal box */}
      <div
        className="absolute left-1/2 -translate-x-1/2 border border-white/15 border-t-0 pointer-events-none"
        style={{ top: "5%", width: "26%", height: "7%" }}
      />

      {/* Bottom penalty box */}
      <div
        className="absolute left-1/2 -translate-x-1/2 border border-white/15 border-b-0 pointer-events-none"
        style={{ bottom: "5%", width: "52%", height: "16%" }}
      />
      {/* Bottom goal box */}
      <div
        className="absolute left-1/2 -translate-x-1/2 border border-white/15 border-b-0 pointer-events-none"
        style={{ bottom: "5%", width: "26%", height: "7%" }}
      />

      {/* ── Player rows sit inside an absolute flex column ── */}
      <div className="absolute inset-0 flex flex-col justify-around py-6 px-3">
        {children}
      </div>
    </div>
  );
}

// ─── Pitch player card ─────────────────────────────────────────────────────────
function PitchCard({ player, fixture, teamById }) {
  const fdr    = fixture ? FDR[fixture.difficulty] ?? FDR[3] : null;
  const oppShort = fixture ? teamById[fixture.opponentId]?.short_name ?? "?" : null;

  return (
    <div className="relative flex flex-col items-center gap-0.5">
      {/* Captain / VC badge */}
      {(player.is_captain || player.is_vice_captain) && (
        <div
          className={`absolute -top-2 -right-1 z-10 w-4 h-4 rounded-full
            flex items-center justify-center text-[9px] font-black shadow-lg
            ${player.is_captain ? "bg-fpl-green text-dark-900" : "bg-slate-500 text-white"}`}
          title={player.is_captain ? "Captain" : "Vice Captain"}
        >
          {player.is_captain ? "C" : "V"}
        </div>
      )}

      {/* Card body */}
      <div
        className="bg-dark-800/90 backdrop-blur-sm rounded-lg shadow-xl
                   border border-dark-400/60 text-center px-2 py-1.5"
        style={{ minWidth: 68, maxWidth: 84 }}
      >
        <div className="text-white text-[11px] font-bold leading-tight truncate">
          {player.web_name}
        </div>
        <div className="text-slate-400 text-[9px] leading-none mt-0.5">
          {player.team_short}
        </div>
        <div className="text-fpl-green text-[11px] font-bold leading-tight mt-0.5 tabular-nums">
          {player.gw_points ?? 0} pts
        </div>
      </div>

      {/* Next fixture FDR badge */}
      {fdr ? (
        <div
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-none"
          style={{ background: fdr.bg, color: fdr.text }}
        >
          {oppShort} {fixture.isHome ? "H" : "A"}
        </div>
      ) : (
        <div className="text-[9px] text-white/30">—</div>
      )}
    </div>
  );
}

// ─── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, accent }) {
  return (
    <div className="flex flex-col items-center bg-dark-600 rounded-lg px-4 py-3 min-w-[90px]">
      <span className={`text-lg font-bold tabular-nums ${accent ? "text-fpl-green" : "text-slate-100"}`}>
        {value}
      </span>
      <span className="text-xs text-slate-500 mt-0.5 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── AI Team Review Modal ──────────────────────────────────────────────────────
function AITeamReviewModal({ teamId, onClose }) {
  const [response, setResponse] = useState("");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/ai-chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        message: "Review my entire FPL squad. Give me: (1) an overall rating out of 10, (2) my strongest assets, (3) my weakest links I should consider selling, (4) captaincy recommendation for this week, (5) suggested strategy for the next 3 gameweeks. Be specific and opinionated.",
        team_id: teamId,
      }),
    })
      .then((r) => r.json())
      .then((d) => setResponse(d.response ?? d.detail ?? "No response."))
      .catch(() => setResponse("⚠️ Error fetching team review."))
      .finally(() => setLoading(false));
  }, [teamId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-dark-500">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <span className="text-fpl-green text-lg">✦</span>
            AI Team Review
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-2xl leading-none">×</button>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-6 h-6 border-2 border-fpl-green border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-sm">Analysing your squad…</span>
            </div>
          ) : (
            <div className="md-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{response}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inner team view ───────────────────────────────────────────────────────────
function TeamView({ teamId }) {
  const [team, setTeam]       = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [teams, setTeams]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [aiReview, setAiReview]   = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/my-team/${teamId}`),
      fetch("/api/fixtures"),
      fetch("/api/teams"),
    ])
      .then(async ([tr, fr, tsr]) => {
        if (!tr.ok)  throw new Error(`My team: HTTP ${tr.status}`);
        if (!fr.ok)  throw new Error(`Fixtures: HTTP ${fr.status}`);
        if (!tsr.ok) throw new Error(`Teams: HTTP ${tsr.status}`);
        return Promise.all([tr.json(), fr.json(), tsr.json()]);
      })
      .then(([t, f, ts]) => { setTeam(t); setFixtures(f); setTeams(ts); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [teamId]);

  const teamById  = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const currentGW = useMemo(() => (fixtures.length ? getCurrentGW(fixtures) : 1), [fixtures]);

  const { starting, bench, grouped } = useMemo(() => {
    if (!team) return { starting: [], bench: [], grouped: {} };
    const s = team.squad.filter((p) => p.position_in_team <= 11);
    const b = team.squad.filter((p) => p.position_in_team > 11).sort((a, b) => a.position_in_team - b.position_in_team);
    const g = {};
    POS_ORDER.forEach((pos) => (g[pos] = []));
    s.forEach((p) => { if (g[p.position]) g[p.position].push(p); });
    return { starting: s, bench: b, grouped: g };
  }, [team]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-fpl-green border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading team {teamId}…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="card p-6 text-center max-w-sm">
        <p className="text-red-400 font-semibold">Failed to load team</p>
        <p className="text-slate-500 text-sm mt-1">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 pt-8">
      {/* Team header */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-fpl-green">{team.team_name}</h2>
            <p className="text-slate-400 text-sm mt-0.5">{team.manager} · GW{team.gameweek}</p>
            <button
              onClick={() => setAiReview(true)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                         bg-fpl-green/10 border border-fpl-green/30 text-fpl-green
                         hover:bg-fpl-green/20 transition-colors"
            >
              <span>✦</span> Get AI Team Review
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatPill label="GW Points"    value={team.gameweek_points}                        accent />
            <StatPill label="Total Points" value={team.overall_points} />
            <StatPill label="Overall Rank" value={team.overall_rank?.toLocaleString() ?? "—"} />
            <StatPill label="Squad Value"  value={`£${team.team_value?.toFixed(1)}m`} />
            <StatPill label="Bank"         value={`£${team.bank?.toFixed(1)}m`} />
          </div>
        </div>
      </div>

      {/* Football pitch */}
      <Pitch>
        {/* Rows rendered top→bottom: FWD, MID, DEF, GKP */}
        {[...POS_ORDER].reverse().map((pos) => {
          const players = grouped[pos];
          if (!players.length) return null;
          return (
            <div key={pos} className="flex justify-around items-center">
              {players.map((p) => {
                const playerTeam = teams.find((t) => t.name === p.team);
                const fix = playerTeam ? getNextFixture(fixtures, playerTeam.id, currentGW) : null;
                return <PitchCard key={p.id} player={p} fixture={fix} teamById={teamById} />;
              })}
            </div>
          );
        })}
      </Pitch>

      {/* Bench */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
          Bench
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {bench.map((p) => {
            const playerTeam = teams.find((t) => t.name === p.team);
            const fix = playerTeam ? getNextFixture(fixtures, playerTeam.id, currentGW) : null;
            const fdr     = fix ? FDR[fix.difficulty] ?? FDR[3] : null;
            const oppShort = fix ? teamById[fix.opponentId]?.short_name ?? "?" : null;
            return (
              <div key={p.id}
                className="card p-3 flex items-center justify-between gap-3 opacity-60 hover:opacity-80 transition-opacity">
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm text-slate-100 truncate">{p.web_name}</span>
                  <span className="text-xs text-slate-500">{p.team_short} · {p.position}</span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-fpl-green font-bold tabular-nums">{p.gw_points ?? 0} pts</span>
                  {fdr && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: fdr.bg, color: fdr.text }}>
                      {oppShort} {fix.isHome ? "H" : "A"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap px-1">
        {[["C", "bg-fpl-green text-dark-900", "Captain"], ["V", "bg-slate-500 text-white", "Vice Captain"]].map(([char, cls, label]) => (
          <span key={char} className="flex items-center gap-1.5">
            <span className={`w-4 h-4 rounded-full ${cls} flex items-center justify-center font-black text-[9px]`}>{char}</span>
            {label}
          </span>
        ))}
        <span>· Fixture badges colored by FDR (1=easy → 5=hard)</span>
      </div>

      {/* AI Team Review modal */}
      {aiReview && <AITeamReviewModal teamId={teamId} onClose={() => setAiReview(false)} />}
    </div>
  );
}

// ─── Page wrapper with team ID gate ───────────────────────────────────────────
export default function MyTeamPage() {
  const { teamId, setTeamId, clearTeamId } = useTeamId();

  return (
    <TeamIdGate teamId={teamId} onSave={setTeamId} onClear={clearTeamId}>
      {(id) => <TeamView teamId={id} />}
    </TeamIdGate>
  );
}
