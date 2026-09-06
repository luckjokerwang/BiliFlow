import React from 'react';

export interface SliderInputProps {
  label: string;
  description?: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const SliderInput: React.FC<SliderInputProps> = ({
  label,
  description,
  unit = '秒',
  min,
  max,
  step,
  value,
  onChange,
  disabled = false,
  icon,
}) => {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : min;

  return (
    <div
      className={`p-3.5 rounded-xl border flex flex-col gap-3 transition-all select-none ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-slate-800 bg-slate-900/30'
          : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="p-2 rounded-lg shrink-0 mt-0.5 bg-slate-800 text-slate-400">
              {icon}
            </div>
          )}
          <div className="space-y-0.5 min-w-0">
            <span className="font-semibold text-xs text-white truncate block">
              {label}
            </span>
            {description && (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-950/60 border border-sky-800/50 text-sky-400 font-mono text-xs font-bold">
          <span>{safeValue}</span>
          <span className="text-[10px] text-slate-400">{unit}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <span className="text-[10px] font-mono text-slate-500">{min}{unit}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeValue}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-sky-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
        />
        <span className="text-[10px] font-mono text-slate-500">{max}{unit}</span>
      </div>
    </div>
  );
};
