import React from 'react';
import { VideoSummaryResult } from '../../../types';

export interface SummaryArtifactsProps {
  isDark: boolean;
  summary: VideoSummaryResult;
  onSeekQuote: (seconds: number) => void;
}

export const SummaryArtifacts: React.FC<SummaryArtifactsProps> = ({
  isDark,
  summary,
  onSeekQuote,
}) => {
  const glossary = summary.glossary || [];
  const takeaways = summary.actionableTakeaways || [];
  const quotes = summary.punchlineQuotes || [];
  if (glossary.length === 0 && takeaways.length === 0 && quotes.length === 0) {
    return null;
  }

  const sectionClass = `p-3 rounded-xl border text-[13px] leading-relaxed ${
    isDark
      ? 'bg-slate-800/40 border-slate-700/50 text-slate-200'
      : 'bg-slate-50 border-slate-200 text-slate-700'
  }`;

  return (
    <div className="space-y-2.5">
      {takeaways.length > 0 && (
        <section className={sectionClass}>
          <h3 className="font-bold text-sky-500 mb-1.5">可执行收获</h3>
          <ul className="space-y-1 list-disc list-inside">
            {takeaways.map((takeaway, index) => (
              <li key={`${takeaway}_${index}`} className="select-text">
                {takeaway}
              </li>
            ))}
          </ul>
        </section>
      )}

      {glossary.length > 0 && (
        <section className={sectionClass}>
          <h3 className="font-bold text-sky-500 mb-1.5">术语表</h3>
          <dl className="space-y-1.5">
            {glossary.map((entry, index) => (
              <div key={`${entry.term}_${index}`} className="select-text">
                <dt className="font-semibold inline">{entry.term}：</dt>
                <dd className="inline">{entry.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {quotes.length > 0 && (
        <section className={sectionClass}>
          <h3 className="font-bold text-sky-500 mb-1.5">金句原文</h3>
          <div className="space-y-1.5">
            {quotes.map((quote, index) => (
              <div
                key={`${quote.timestamp}_${index}`}
                role="button"
                tabIndex={0}
                onClick={() => onSeekQuote(quote.timestamp)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSeekQuote(quote.timestamp);
                  }
                }}
                className={`flex items-start gap-2 p-1.5 rounded-lg cursor-pointer select-text ${
                  isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-200/70'
                }`}
                title="点击跳转到该字幕"
              >
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500 shrink-0">
                  {quote.timestampStr}
                </span>
                <p className="flex-1 min-w-0">{quote.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
