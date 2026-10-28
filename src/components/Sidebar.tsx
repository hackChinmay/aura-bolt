import React from 'react';
import {
  LayoutDashboard,
  Radio,
  BarChart3,
  Sliders,
  FlaskConical,
  FileSpreadsheet,
  BookOpen,
  Network,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'packet_lab'
  | 'comparison'
  | 'adaptive'
  | 'builder'
  | 'results'
  | 'docs';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  isRunning: boolean;
  activeProtocol: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  isRunning,
  activeProtocol,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Research Dashboard', icon: LayoutDashboard },
    { id: 'packet_lab', label: 'Live Packet Laboratory', icon: Radio },
    { id: 'comparison', label: 'Protocol Comparison', icon: BarChart3 },
    { id: 'adaptive', label: 'Adaptive Controller', icon: Sliders },
    { id: 'builder', label: 'Experiment Builder', icon: FlaskConical },
    { id: 'results', label: 'Results & Analysis', icon: FileSpreadsheet },
    { id: 'docs', label: 'Research Documentation', icon: BookOpen },
  ];

  const formatProtocolName = (p: string) => {
    switch (p) {
      case 'stop_and_wait': return 'Stop-and-Wait';
      case 'go_back_n': return 'Go-Back-N';
      case 'selective_repeat': return 'Selective Repeat';
      case 'aura_bolt': return 'AURA-BOLT (Adaptive)';
      default: return p;
    }
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
          <Network className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-sm tracking-wide text-white">AURA-BOLT</div>
          <div className="text-[11px] text-slate-400">ARQ Research Platform</div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectPage(item.id as PageId)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded transition-colors text-left ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Engine Status Block */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span>Engine State</span>
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span className={isRunning ? 'text-cyan-400' : 'text-slate-400'}>
              {isRunning ? 'Simulating' : 'Idle'}
            </span>
          </span>
        </div>

        <div className="text-[11px] text-slate-400 truncate">
          Active: <span className="text-slate-200">{formatProtocolName(activeProtocol)}</span>
        </div>
      </div>
    </aside>
  );
};
