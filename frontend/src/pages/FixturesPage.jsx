// TODO(v2): add a gameweek range selector so managers can scout fixtures beyond the next 6 GWs
import { useState, useEffect, useMemo } from "react";
import { FDR, getCurrentGW, buildTeamSchedule } from "../utils/fixtures.js";

const GW_COUNT = 6;

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState([]);
  const [teams, setTeams]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [sortByDiff, setSortByDiff] = useState(true); // true = easiest first

  useEffect(() => {
    Promise.all([fetch("/api/fixtures"), fetch("/api/teams")])
      .then(async ([fr, tr]) => {
        if (!fr.ok) throw new Error(`Fixtures: HTTP ${fr.status}`);
        if (!tr.ok) throw new Error(`Teams: HTTP ${tr.status}`);
        return Promise.all([fr.json(), tr.json()]);
      })
      .then(([f, t]) => { setFixtures(f); setTeams(t); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Build lookup maps
  const teamById = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams]
  );

  const currentGW = useMemo(() => (fixtures.length ? getCurrentGW(fixtures) : 1), [fixtures]);

  // schedule: Map<teamId, Array<fixture|null>> for next GW_COUNT weeks
  const schedule = useMemo(
    () => buildTeamSchedule(fixtures, currentGW, GW_COUNT),
    [fixtures, currentGW]
  );

  // Build row data per team
  const rows = useMemo(() => {
    return teams.map((team) => {
      const slots = schedule.get(team.id) ?? new Array(GW_COUNT).fill(null);
      const totalDiff = slots.reduce((sum, s) => sum + (s?.difficulty ?? 3), 0);
      return { team, slots, totalDiff };
    });
  }, [teams, schedule]);

  const sorted = useMemo(() => {
    if (sortByDiff) return [...rows].sort((a, b) => a.totalDiff - b.totalDiff);
    return [...rows].sort((a, b) => a.team.name.localeCompare(b.team.name));
  }, [rows, sortByDiff]);

  // Easiest: bottom-third of total difficulty
  const diffValues = rows.map((r) => r.totalDiff).sort((a, b) => a - b);
  const easyThreshold = diffValues[Math.floor(diffValues.length * 0.33)] ?? 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-fpl-green border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading fixtures…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="card p-6 text-center max-w-sm">
        <p className="text-red-400 font-semibold">Failed to load fixtures</p>
        <p className="text-slate-500 text-sm mt-1">{error}</p>
      </div>
    </div>
  );

  const gwHeaders = Array.from({ length: GW_COUNT }, (_, i) => currentGW + i);

  return (
    <div className="flex flex-col gap-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Fixture Difficulty Ratings</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Next {GW_COUNT} gameweeks starting GW{currentGW}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort toggle */}
          <button
            onClick={() => setSortByDiff((v) => !v)}
            className="filter-btn text-xs"
          >
            Sort: {sortByDiff ? "Easiest first ↑" : "A–Z"}
          </button>
        </div>
      </div>

      {/* FDR legend */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 mr-1">FDR:</span>
        {Object.entries(FDR).map(([k, v]) => (
          <span
            key={k}
            className="px-2 py-0.5 rounded text-xs font-semibold"
            style={{ background: v.bg, color: v.text }}
          >
            {k} — {v.label}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-dark-600 border-b border-dark-400">
                <th className="th-cell text-left w-8">#</th>
                <th className="th-cell text-left min-w-[140px]">Team</th>
                {gwHeaders.map((gw) => (
                  <th key={gw} className="th-cell text-center min-w-[90px]">GW{gw}</th>
                ))}
                <th
                  className="th-cell text-center min-w-[80px] cursor-pointer hover:text-fpl-green"
                  onClick={() => setSortByDiff((v) => !v)}
                  title="Total difficulty — click to sort"
                >
                  Total ↕
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ team, slots, totalDiff }, idx) => {
                const isEasy = totalDiff <= easyThreshold;
                return (
                  <tr
                    key={team.id}
                    className={`border-b border-dark-600 hover:bg-dark-600/50 transition-colors ${
                      isEasy ? "bg-fpl-green/5" : ""
                    }`}
                  >
                    <td className="td-cell text-slate-600 text-xs">{idx + 1}</td>
                    <td className="td-cell">
                      <div className="flex items-center gap-2">
                        {isEasy && (
                          <span
                            title="Best fixture run"
                            className="w-1.5 h-1.5 rounded-full bg-fpl-green shrink-0"
                          />
                        )}
                        <span className={`font-medium ${isEasy ? "text-fpl-green" : "text-slate-200"}`}>
                          {team.name}
                        </span>
                        <span className="text-slate-600 text-xs">{team.short_name}</span>
                      </div>
                    </td>
                    {slots.map((slot, i) => {
                      if (!slot) return (
                        <td key={i} className="td-cell text-center">
                          <span className="text-slate-700 text-xs">—</span>
                        </td>
                      );
                      const opp = teamById[slot.opponentId];
                      const fdr = FDR[slot.difficulty] ?? FDR[3];
                      return (
                        <td key={i} className="td-cell text-center p-1">
                          <span
                            className="inline-flex flex-col items-center justify-center rounded px-1.5 py-1 text-xs font-bold leading-tight w-full"
                            style={{ background: fdr.bg, color: fdr.text }}
                            title={`FDR ${slot.difficulty} — ${fdr.label}`}
                          >
                            <span>{opp?.short_name ?? "?"}</span>
                            <span className="text-[10px] font-normal opacity-80">
                              {slot.isHome ? "H" : "A"}
                            </span>
                          </span>
                        </td>
                      );
                    })}
                    {/* Total difficulty */}
                    <td className="td-cell text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold tabular-nums ${
                          isEasy
                            ? "bg-fpl-green/20 text-fpl-green"
                            : "text-slate-400"
                        }`}
                      >
                        {totalDiff}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-600 px-1">
        * Highlighted rows (green dot) indicate teams in the easiest third of fixture runs over the next {GW_COUNT} gameweeks.
        Blank cells = blank gameweek / postponed fixture.
      </p>
    </div>
  );
}
