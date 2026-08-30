import React, { useState } from 'react';
import { TimelineMarker } from '../../utils/timelineCalculator';
import { Clock } from 'lucide-react';

interface TimelineMarkersProps {
  markers: TimelineMarker[];
  onSeek: (seconds: number) => void;
}

export const TimelineMarkers: React.FC<TimelineMarkersProps> = ({ markers, onSeek }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!markers || markers.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-visible font-sans select-none">
      {markers.map((marker) => {
        const isHovered = hoveredId === marker.id;

        return (
          <div
            key={marker.id}
            style={{ left: `${marker.percentage}%` }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-auto group cursor-pointer"
            onMouseEnter={() => setHoveredId(marker.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSeek(marker.timestampSec);
            }}
          >
            {/* Glowing Anchor Pin */}
            <div
              className={`w-2.5 h-3 rounded-full border border-white/80 transition-all duration-150 shadow-md ${
                isHovered
                  ? 'bg-sky-300 scale-135 shadow-[0_0_12px_rgba(56,189,248,1)]'
                  : 'bg-sky-400 hover:bg-sky-300 shadow-[0_0_6px_rgba(56,189,248,0.8)]'
              }`}
            />

            {/* Hover Tooltip Popup */}
            {isHovered && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
                <div className="bg-slate-900/95 text-slate-100 border border-slate-700/80 shadow-2xl backdrop-blur-md px-3 py-1.5 rounded-xl whitespace-nowrap text-xs flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-sky-500/20 text-sky-400 font-mono text-[10px] font-bold flex items-center justify-center">
                    {marker.index}
                  </div>
                  <span className="font-semibold text-white max-w-[220px] truncate">
                    {marker.title}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-sky-300 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-800/40">
                    <Clock className="w-2.5 h-2.5" />
                    {marker.timestampStr}
                  </span>
                </div>
                {/* Arrow */}
                <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700/80 rotate-45 mx-auto -mt-1" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
