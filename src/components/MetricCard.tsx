import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'violet' | 'amber' | 'emerald' | 'coral' | 'sky' | 'default';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend,
  trendValue,
}) => {
  const variantStyles = {
    violet: {
      border: 'border-[#A78BFA]/30 hover:border-[#A78BFA]/60',
      badge: 'bg-[#A78BFA]/10 text-[#A78BFA]',
      text: 'text-[#A78BFA]',
      icon: 'text-[#A78BFA]',
    },
    emerald: {
      border: 'border-[#34D399]/30 hover:border-[#34D399]/60',
      badge: 'bg-[#12352C] text-[#34D399]',
      text: 'text-[#34D399]',
      icon: 'text-[#34D399]',
    },
    amber: {
      border: 'border-[#FBBF24]/30 hover:border-[#FBBF24]/60',
      badge: 'bg-[#FBBF24]/10 text-[#FBBF24]',
      text: 'text-[#FBBF24]',
      icon: 'text-[#FBBF24]',
    },
    coral: {
      border: 'border-[#FB7185]/30 hover:border-[#FB7185]/60',
      badge: 'bg-[#3A2029] text-[#FB7185]',
      text: 'text-[#FB7185]',
      icon: 'text-[#FB7185]',
    },
    sky: {
      border: 'border-[#60A5FA]/30 hover:border-[#60A5FA]/60',
      badge: 'bg-[#60A5FA]/10 text-[#60A5FA]',
      text: 'text-[#60A5FA]',
      icon: 'text-[#60A5FA]',
    },
    default: {
      border: 'border-[#343B48] hover:border-[#4B5563]',
      badge: 'bg-[#252B36] text-[#9CA3AF]',
      text: 'text-[#F3F4F6]',
      icon: 'text-[#9CA3AF]',
    },
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className={`p-3.5 rounded-lg bg-[#1D222B] border ${style.border} transition-all duration-200 shadow-sm flex flex-col justify-between`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#9CA3AF] font-medium truncate">
          {label}
        </span>
        {Icon && (
          <div className="p-1 rounded bg-[#252B36] border border-[#343B48]/50">
            <Icon className={`w-3.5 h-3.5 ${style.icon}`} />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 my-0.5">
        <span className="text-2xl font-bold font-mono tracking-tight text-[#F3F4F6]">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-mono text-[#9CA3AF]">{unit}</span>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-[#343B48]/40 flex items-center justify-between text-[11px]">
        {subtitle && (
          <span className="text-[#9CA3AF] truncate text-[10px]">{subtitle}</span>
        )}
        {trendValue && (
          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${style.badge}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
        )}
      </div>
    </div>
  );
};
