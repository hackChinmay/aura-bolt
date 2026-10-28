import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'cyan' | 'amber' | 'emerald' | 'rose' | 'default';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtitle,
  icon: Icon,
  variant = 'default',
}) => {
  const colorMap = {
    cyan: 'text-cyan-400 border-cyan-500/20 bg-slate-900',
    amber: 'text-amber-400 border-amber-500/20 bg-slate-900',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-slate-900',
    rose: 'text-rose-400 border-rose-500/20 bg-slate-900',
    default: 'text-slate-100 border-slate-800 bg-slate-900',
  };

  const iconColor = {
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    default: 'text-slate-400',
  };

  return (
    <div className={`p-4 rounded border transition-all ${colorMap[variant]}`}>
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
        <span className="font-medium tracking-wide uppercase text-[10px] text-slate-400">
          {label}
        </span>
        {Icon && <Icon className={`w-4 h-4 ${iconColor[variant]}`} />}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight text-white font-mono">
          {value}
        </span>
        {unit && <span className="text-xs text-slate-400 font-normal">{unit}</span>}
      </div>

      {subtitle && (
        <div className="mt-1.5 text-xs text-slate-400 truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};
