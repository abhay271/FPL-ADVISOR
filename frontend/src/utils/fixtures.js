// Shared fixture/FDR utilities used by FixturesPage and MyTeamPage

export const FDR = {
  1: { bg: "#00ff87", text: "#0a0a14", label: "Very Easy" },
  2: { bg: "#01d167", text: "#0a0a14", label: "Easy" },
  3: { bg: "#555566", text: "#e2e8f0", label: "Medium" },
  4: { bg: "#ff6900", text: "#fff",    label: "Hard" },
  5: { bg: "#ff0050", text: "#fff",    label: "Very Hard" },
};

/**
 * Given the full fixtures list, determine the current/upcoming gameweek.
 * Returns the lowest event number among unfinished fixtures.
 */
export function getCurrentGW(fixtures) {
  const unfinished = fixtures.filter((f) => !f.finished && f.event !== null);
  if (unfinished.length === 0) {
    // All done — return max event
    return Math.max(...fixtures.map((f) => f.event ?? 0));
  }
  return Math.min(...unfinished.map((f) => f.event));
}

/**
 * For a given team_id, return the next fixture at or after minGW,
 * sorted by event. Returns { event, opponent, isHome, difficulty } or null.
 */
export function getNextFixture(fixtures, teamId, minGW) {
  const upcoming = fixtures
    .filter(
      (f) =>
        f.event !== null &&
        f.event >= minGW &&
        !f.finished &&
        (f.team_h === teamId || f.team_a === teamId)
    )
    .sort((a, b) => a.event - b.event);

  if (!upcoming.length) return null;

  const f = upcoming[0];
  const isHome = f.team_h === teamId;
  return {
    event: f.event,
    opponentId: isHome ? f.team_a : f.team_h,
    isHome,
    difficulty: isHome ? f.team_h_difficulty : f.team_a_difficulty,
  };
}

/**
 * Build a schedule for every team over `gwCount` gameweeks starting at `startGW`.
 * Returns Map<teamId, Array<{ event, opponentId, isHome, difficulty } | null>>
 */
export function buildTeamSchedule(fixtures, startGW, gwCount) {
  const schedule = new Map();
  const gwRange = Array.from({ length: gwCount }, (_, i) => startGW + i);

  for (const gw of gwRange) {
    const gwFixtures = fixtures.filter((f) => f.event === gw);
    for (const f of gwFixtures) {
      // home team
      if (!schedule.has(f.team_h)) schedule.set(f.team_h, new Array(gwCount).fill(null));
      schedule.get(f.team_h)[gw - startGW] = {
        event: gw,
        opponentId: f.team_a,
        isHome: true,
        difficulty: f.team_h_difficulty,
      };
      // away team
      if (!schedule.has(f.team_a)) schedule.set(f.team_a, new Array(gwCount).fill(null));
      schedule.get(f.team_a)[gw - startGW] = {
        event: gw,
        opponentId: f.team_h,
        isHome: false,
        difficulty: f.team_a_difficulty,
      };
    }
  }
  return schedule;
}
