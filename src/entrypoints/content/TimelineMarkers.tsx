import React, { useState, useEffect } from 'react';
import { TimelineMarker, TimelineSegment } from '../../utils/timelineCalculator';
import { Clock } from 'lucide-react';

interface TimelineMarkersProps {
  markers: TimelineMarker[];
  onSeek: (seconds: number) => void;
}

export const TimelineMarkers: React.FC<TimelineMarkersProps> = ({ markers, onSeek }) => {
  if (!markers || markers.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-visible font-sans select-none">
      {markers.map((marker) => (
        <div
          key={marker.id}
          style={{ left: `${marker.percentage}%` }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-[3px] rounded-[1px] bg-sky-400 hover:bg-sky-300 shadow-[0_0_4px_rgba(56,189,248,0.8)] pointer-events-auto cursor-pointer group z-20 transition-transform duration-150"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onSeek(marker.timestampSec);
          }}
        />
      ))}
    </div>
  );
};

interface TimelineCardOverlayProps {
  segments: TimelineSegment[];
  duration: number;
}

interface HoverPosition {
  pixelX: number;
  containerWidth: number;
}

export const TimelineCardOverlay: React.FC<TimelineCardOverlayProps> = ({
  segments = [],
  duration = 0,
}) => {
  const [hoveredSegment, setHoveredSegment] = useState<TimelineSegment | null>(null);
  const [hoverPos, setHoverPos] = useState<HoverPosition | null>(null);

  // Passive mouse tracking on Bilibili progress bar area
  // Ensures B站 native video thumbnail preview (.bpx-player-progress-popup) works untouched
  useEffect(() => {
    const progressBar = document.querySelector<HTMLElement>(
      '.bpx-player-progress-area, .bpx-player-progress-wrap, .bpx-player-progress'
    );
    if (!progressBar) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = progressBar.getBoundingClientRect();
      if (rect.width <= 0 || duration <= 0) return;

      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const hoverSec = ratio * duration;

      const active = segments.find(
        (s) => hoverSec >= s.startSec && hoverSec < s.endSec
      );

      setHoveredSegment(active || null);
      setHoverPos({
        pixelX: clickX,
        containerWidth: rect.width,
      });
    };

    const handleMouseLeave = () => {
      setHoveredSegment(null);
      setHoverPos(null);
    };

    progressBar.addEventListener('mousemove', handleMouseMove, { passive: true });
    progressBar.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      progressBar.removeEventListener('mousemove', handleMouseMove);
      progressBar.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [segments, duration]);

  if (!hoveredSegment || !hoverPos) {
    return null;
  }

  // Position card adjacent to B站 native preview thumbnail (~160px wide)
  // Places card to the right if space permits, else flips to the left
  let cardStyle: React.CSSProperties = { bottom: '26px' };
  const isRightAvailable = hoverPos.pixelX + 90 + 280 <= hoverPos.containerWidth;
  if (isRightAvailable) {
    cardStyle.left = `${hoverPos.pixelX + 95}px`;
  } else {
    cardStyle.left = `${hoverPos.pixelX - 95}px`;
    cardStyle.transform = 'translateX(-100%)';
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-visible font-sans select-none">
      <div
        className="absolute z-50 pointer-events-none animate-fade-in"
        style={cardStyle}
      >
        <div className="bg-slate-900/95 text-slate-100 border border-slate-700/80 shadow-2xl backdrop-blur-md px-3 py-2 rounded-xl text-xs flex flex-col gap-1 w-[280px]">
          {/* Header: Badge + Title + Time Range */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
              {hoveredSegment.index === 0 ? '引言' : `亮点 ${hoveredSegment.index}`}
            </span>
            <span className="font-semibold text-white truncate flex-1 text-xs">
              {hoveredSegment.title}
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[10px] text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/40">
              <Clock className="w-2.5 h-2.5" />
              {hoveredSegment.timeRangeStr}
            </span>
          </div>

          {/* Body: Key Point Snippet */}
          {hoveredSegment.keyPoint && (
            <p className="text-[11px] text-slate-300/90 leading-relaxed pt-1 border-t border-slate-800/80">
              {hoveredSegment.keyPoint}
            </p>
          )}
        </div>

        {/* Bottom Arrow Indicator */}
        <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700/80 rotate-45 mx-auto -mt-1" />
      </div>
    </div>
  );
};
