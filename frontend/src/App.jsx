import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import PlayersPage   from "./pages/PlayersPage.jsx";
import FixturesPage  from "./pages/FixturesPage.jsx";
import MyTeamPage    from "./pages/MyTeamPage.jsx";
import TransfersPage from "./pages/TransfersPage.jsx";
import AIAdvisorPage from "./pages/AIAdvisorPage.jsx";

const NAV = [
  { to: "/",          label: "Player Stats" },
  { to: "/fixtures",  label: "Fixtures"     },
  { to: "/my-team",   label: "My Team"      },
  { to: "/transfers", label: "Transfers"    },
  { to: "/ai",        label: "✦ AI Advisor" },
];

function NavBar() {
  return (
    <header className="bg-dark-800 border-b border-dark-500 sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center gap-6 h-14">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-fpl-green font-black text-xl tracking-tight">FPL</span>
          <span className="text-slate-200 font-semibold text-xl">Advisor</span>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-fpl-green text-dark-900 font-bold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-dark-600"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-dark-900 flex flex-col">
        <NavBar />
        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">
          <Routes>
            <Route path="/"          element={<PlayersPage />}   />
            <Route path="/fixtures"  element={<FixturesPage />}  />
            <Route path="/my-team"   element={<MyTeamPage />}    />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route path="/ai"        element={<AIAdvisorPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
