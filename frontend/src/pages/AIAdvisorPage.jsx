import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTeamId } from "../hooks/useTeamId.js";

const QUICK_QUESTIONS = [
  { label: "⚡ Captain pick",           text: "Who should I captain this week? Give me your top 3 picks with reasoning." },
  { label: "🔄 Best transfer",          text: "What's the single best transfer I can make this gameweek?" },
  { label: "🃏 Wildcard advice",        text: "Should I use my wildcard? If so, suggest a full 15-man squad." },
  { label: "⭐ Rate my team",           text: "Rate my team out of 10 and identify the weakest link I should target first." },
  { label: "🎯 Differentials",          text: "Who are the best differential picks under 10% ownership right now?" },
  { label: "💰 Budget picks",           text: "What are the best budget options under £6.0m for this gameweek?" },
];

function SparkleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10 1.5a.75.75 0 01.75.75v1.505l1.09-.63a.75.75 0 01.75 1.3l-1.09.63 1.09.63a.75.75 0 01-.75 1.3l-1.09-.63V7.5a.75.75 0 01-1.5 0V6.355l-1.09.63a.75.75 0 01-.75-1.3l1.09-.63-1.09-.63a.75.75 0 01.75-1.3l1.09.63V2.25A.75.75 0 0110 1.5zM4.5 9a.75.75 0 01.75.75v.755l.654-.378a.75.75 0 11.75 1.299l-.654.378.654.378a.75.75 0 11-.75 1.299l-.654-.378v.755a.75.75 0 11-1.5 0v-.755l-.654.378a.75.75 0 11-.75-1.299l.654-.378-.654-.378a.75.75 0 01.75-1.299l.654.378V9.75A.75.75 0 014.5 9zm11 0a.75.75 0 01.75.75v.755l.654-.378a.75.75 0 01.75 1.299l-.654.378.654.378a.75.75 0 01-.75 1.299l-.654-.378v.755a.75.75 0 01-1.5 0v-.755l-.654.378a.75.75 0 01-.75-1.299l.654-.378-.654-.378a.75.75 0 01.75-1.299l.654.378V9.75A.75.75 0 0115.5 9zm-5 5a.75.75 0 01.75.75v1.505l1.09-.63a.75.75 0 01.75 1.3l-1.09.63 1.09.63a.75.75 0 01-.75 1.3l-1.09-.63v1.145a.75.75 0 01-1.5 0v-1.145l-1.09.63a.75.75 0 01-.75-1.3l1.09-.63-1.09-.63a.75.75 0 01.75-1.3l1.09.63V14.75A.75.75 0 0110.5 14z" clipRule="evenodd" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-fpl-green rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-slate-500 ml-2">AI is thinking…</span>
    </div>
  );
}

function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1
          ${isUser ? "bg-dark-400 text-slate-300" : "bg-fpl-green/20 text-fpl-green"}`}
      >
        {isUser ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
          </svg>
        ) : (
          <SparkleIcon />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm
          ${isUser
            ? "bg-dark-500 text-slate-200 rounded-tr-sm"
            : "bg-dark-700 border border-dark-500 text-slate-200 rounded-tl-sm"
          }`}
      >
        {isUser ? (
          <p>{msg.content}</p>
        ) : (
          <div className="md-prose text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeScreen({ teamId }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 py-12 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "radial-gradient(circle, rgba(0,255,135,0.2), transparent)" }}
      >
        <span className="text-fpl-green text-3xl">✦</span>
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-100">AI FPL Advisor</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-sm">
          Ask anything about your FPL team, transfers, captaincy, or strategy.
          {!teamId && (
            <span className="block mt-1 text-xs text-slate-600">
              Tip: enter your Team ID in My Team for personalised advice.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export default function AIAdvisorPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const { teamId }              = useTeamId();
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res  = await fetch("/api/ai-chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: msg, team_id: teamId || null }),
      });
      const data = await res.json();
      const reply = data.response ?? data.detail ?? "Sorry, I couldn't get a response.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Connection error — make sure the backend is running." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden border border-dark-500"
      style={{
        height: "calc(100vh - 3.5rem - 3rem - 2px)",
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,255,135,0.04), transparent)",
      }}
    >
      {/* ── Messages area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 ? (
          <WelcomeScreen teamId={teamId} />
        ) : (
          messages.map((m, i) => <ChatBubble key={i} msg={m} />)
        )}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-fpl-green/20 text-fpl-green flex items-center justify-center shrink-0 mt-1">
              <SparkleIcon />
            </div>
            <div className="bg-dark-700 border border-dark-500 rounded-2xl rounded-tl-sm">
              <LoadingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Quick questions ────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-dark-600 flex gap-1.5 flex-wrap">
        {QUICK_QUESTIONS.map(({ label, text }) => (
          <button
            key={label}
            onClick={() => send(text)}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded-full border border-dark-400 text-slate-400
                       hover:border-fpl-green hover:text-fpl-green transition-colors disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Input bar ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-dark-500 bg-dark-800/60 flex gap-2 items-center">
        {teamId && (
          <span className="text-xs text-slate-600 shrink-0">Team {teamId}</span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask anything about your FPL team…"
          disabled={loading}
          className="flex-1 input-base disabled:opacity-50"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-fpl-green text-dark-900 font-bold text-sm rounded-lg
                     hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed
                     shrink-0"
        >
          {loading ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
