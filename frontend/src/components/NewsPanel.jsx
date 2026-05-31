import { useState, useEffect } from 'react';
import { getNews } from '../api/stockApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diffMs    = Date.now() - new Date(dateStr).getTime();
  const diffMins  = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays  = Math.floor(diffHours / 24);

  if (diffMins  <  1)  return 'just now';
  if (diffMins  < 60)  return `${diffMins}m ago`;
  if (diffHours < 24)  return `${diffHours}h ago`;
  if (diffDays  <  7)  return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Sub-components (defined outside parent to prevent remount) ───────────────

function SentimentBadge({ sentiment }) {
  if (sentiment === 'bullish') {
    return <span className="badge-bull">▲ Bullish</span>;
  }
  if (sentiment === 'bearish') {
    return <span className="badge-bear">▼ Bearish</span>;
  }
  return <span className="badge-neutral">● Neutral</span>;
}

function ArticleCard({ article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700
                 hover:border-slate-500 rounded-lg transition-colors group"
    >
      <p className="text-slate-200 text-sm font-medium leading-snug
                    group-hover:text-white line-clamp-2 mb-2">
        {article.title}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-xs truncate max-w-[60%]">
          {article.publisher}
        </span>
        <span className="text-slate-600 text-xs shrink-0 ml-2">
          {timeAgo(article.publishedAt)}
        </span>
      </div>
    </a>
  );
}

function ArticleSkeleton() {
  return (
    <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-lg space-y-2">
      <div className="shimmer h-4 w-full" />
      <div className="shimmer h-4 w-3/4" />
      <div className="shimmer h-3 w-1/3 mt-1" />
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-2 mt-4 pt-4 border-t border-slate-700">
      <div className="shimmer h-4 w-1/2 mb-3" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="shimmer h-3 w-full" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

/**
 * Render the Claude news summary, which uses ### Section headers.
 * Handles bold (**text**) and bullet lines.
 */
function NewsSummary({ text }) {
  const sections = [];
  const parts = text.split(/(?=###\s)/);

  for (const part of parts) {
    const headerMatch = part.match(/###\s+(.+)/);
    if (!headerMatch) continue;
    const title   = headerMatch[1].trim();
    const content = part.replace(/###\s+.+\n?/, '').trim();
    sections.push({ title, content });
  }

  if (sections.length === 0) {
    return <p className="text-slate-400 text-sm leading-relaxed">{text}</p>;
  }

  return (
    <div className="space-y-3">
      {sections.map((section, i) => (
        <div key={i}>
          <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-1">
            {section.title}
          </h4>
          <div className="space-y-1">
            {section.content.split('\n').filter(Boolean).map((line, j) => {
              const parts = line.split(/\*\*(.+?)\*\*/g);
              const rendered = parts.map((p, k) =>
                k % 2 === 1
                  ? <strong key={k} className="text-slate-200">{p}</strong>
                  : <span key={k}>{p}</span>
              );
              const isBullet = line.startsWith('- ') || line.startsWith('• ');
              if (isBullet) {
                return (
                  <div key={j} className="flex gap-2 text-slate-400 text-sm">
                    <span className="text-slate-600 shrink-0 mt-0.5">•</span>
                    <span>{rendered}</span>
                  </div>
                );
              }
              return (
                <p key={j} className="text-slate-400 text-sm leading-relaxed">
                  {rendered}
                </p>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NewsPanel({ symbol }) {
  const [news,      setNews]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [fromCache, setFromCache] = useState(false);

  const fetchNews = async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNews(symbol, fresh);
      setNews(data);
      setFromCache(data.fromCache);
    } catch (err) {
      setError(
        err.response?.data?.error ??
        'Could not load news. Try refreshing.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      setNews(null);
      fetchNews(false);
    }
  }, [symbol]);

  return (
    <div className="card">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-slate-300 font-semibold">Recent News</h2>
          <p className="text-slate-600 text-xs mt-0.5">
            Powered by Polygon · Summarized by Claude
          </p>
        </div>

        <div className="flex items-center gap-3">
          {news && fromCache && (
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
              cached
            </span>
          )}
          {news && (
            <SentimentBadge sentiment={news.sentiment} />
          )}
          <button
            onClick={() => fetchNews(true)}
            disabled={loading}
            className="px-3 py-1.5 border border-slate-600 hover:border-slate-400
                       text-slate-400 hover:text-slate-200 text-sm rounded-lg
                       transition-colors disabled:opacity-40"
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4
                        text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !news && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <ArticleSkeleton key={i} />)}
          <SummarySkeleton />
        </div>
      )}

      {/* Content */}
      {news && (
        <div>
          {news.articles.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">
              No recent news found for {symbol}.
            </p>
          ) : (
            <div className="space-y-2">
              {news.articles.map((article, i) => (
                <ArticleCard key={article.url ?? i} article={article} />
              ))}
            </div>
          )}

          {/* Claude summary */}
          {news.summary && news.articles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <NewsSummary text={news.summary} />
            </div>
          )}

          {/* Educational note */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <p className="text-xs text-slate-600 italic">
              📰 News moves prices short-term. Always check whether news sentiment
              confirms or contradicts your technical signals — they often diverge.
              This summary is for educational purposes only.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
