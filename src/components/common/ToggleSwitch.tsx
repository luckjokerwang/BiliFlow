import React from 'react';

export interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  badge?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  description,
  checked,
  onChange,
  badge,
  disabled = false,
  icon,
}) => {
  const isChecked = Boolean(checked);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange(!isChecked)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onChange(!isChecked);
        }
      }}
      className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all select-none cursor-pointer ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-slate-800 bg-slate-900/30'
          : isChecked
          ? 'border-sky-500/40 bg-sky-950/20 hover:border-sky-500/60'
          : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div
            className={`p-2 rounded-lg shrink-0 mt-0.5 ${
              isChecked
                ? 'bg-sky-500/20 text-sky-400'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {icon}
          </div>
        )}
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-white truncate">
              {label}
            </span>
            {badge && (
              <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      <div
        className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${
          checked ? 'bg-sky-500' : 'bg-slate-700'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 left-1 shadow-sm ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
  );
};
