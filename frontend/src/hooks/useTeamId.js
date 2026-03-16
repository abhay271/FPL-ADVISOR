import { useState } from "react";

const KEY = "fplTeamId";

export function useTeamId() {
  const [teamId, setTeamIdState] = useState(() => localStorage.getItem(KEY) ?? "");

  const setTeamId = (id) => {
    const str = String(id).trim();
    localStorage.setItem(KEY, str);
    setTeamIdState(str);
  };

  const clearTeamId = () => {
    localStorage.removeItem(KEY);
    setTeamIdState("");
  };

  return { teamId, setTeamId, clearTeamId };
}
