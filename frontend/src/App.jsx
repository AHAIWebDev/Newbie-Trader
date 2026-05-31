import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import StockPage       from './pages/StockPage';
import JournalPage     from './pages/JournalPage';
import PerformancePage from './pages/PerformancePage';

/**
 * Top-level navigation bar — persists across all pages.
 * NavLink automatically applies active styling.
 */
function TopNav() {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-blue-400 text-lg">
            📈 Newbie Trader
          </span>
          <span className="text-xs text-slate-600 hidden sm:inline">
            Paper trading · Educational only
          </span>
        </div>

        {/* Page navigation */}
        <nav className="flex items-center gap-1">
          {[
            { to: '/',            label: '🔍 Analyze'     },
            { to: '/journal',     label: '📓 Journal'     },
            { to: '/performance', label: '📊 Performance' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors
                 ${isActive
                   ? 'bg-blue-600 text-white'
                   : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`
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
      <div className="min-h-screen bg-background">
        <TopNav />
        <Routes>
          <Route path="/"            element={<StockPage />}       />
          <Route path="/journal"     element={<JournalPage />}     />
          <Route path="/performance" element={<PerformancePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}