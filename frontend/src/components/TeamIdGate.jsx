import { useState } from "react";

export function TeamIdGate({ teamId, onSave, onClear, children }) {
  const [input, setInput] = useState("");
  const [err, setErr]     = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = input.trim();
    if (!val || isNaN(Number(val))) {
      setErr("Please enter a valid numeric FPL Team ID.");
      return;
    }
    setErr("");
    onSave(val);
  };

  if (!teamId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card p-8 w-full max-w-md">
          <div className="flex flex-col items-center gap-2 mb-6">
            <span className="text-3xl font-black text-fpl-green">FPL</span>
            <h2 className="text-xl font-bold text-slate-100">Enter Your Team ID</h2>
            <p className="text-sm text-slate-500 text-center">
              Find your Team ID in the URL when viewing your FPL team page:
              <br />
              <span className="text-slate-400 font-mono text-xs">
                fantasy.premierleague.com/entry/<span className="text-fpl-green font-bold">12345678</span>/event/…
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 4448030"
              value={input}
              onChange={(e) => { setInput(e.target.value); setErr(""); }}
              className="input-base w-full text-center text-lg tracking-widest"
              autoFocus
            />
            {err && <p className="text-xs text-red-400 text-center">{err}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-fpl-green text-dark-900 font-bold text-sm
                         hover:brightness-110 transition-all"
            >
              Load My Team
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Change ID button */}
      <button
        onClick={onClear}
        className="absolute top-0 right-0 text-xs text-slate-500 hover:text-fpl-green
                   transition-colors px-2 py-1 rounded border border-dark-400 hover:border-fpl-green"
      >
        Change Team ID
      </button>

      {typeof children === "function" ? children(teamId) : children}
    </div>
  );
}
