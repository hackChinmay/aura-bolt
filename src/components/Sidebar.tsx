import React, { useState } from 'react';
import {
  LayoutDashboard,
  Radio,
  BarChart3,
  Sliders,
  FlaskConical,
  FileSpreadsheet,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Activity,
  Cpu,
  Wifi,
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
  wsConnected?: boolean;
  simTimeMs?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  isRunning,
  activeProtocol,
  wsConnected = false,
  simTimeMs = 0,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const navItems = [
    { id: 'dashboard', label: 'Research Dashboard', short: 'Dash', icon: LayoutDashboard },
    { id: 'packet_lab', label: 'Live Packet Laboratory', short: 'Lab', icon: Radio },
    { id: 'comparison', label: 'Protocol Comparison', short: 'Comp', icon: BarChart3 },
    { id: 'adaptive', label: 'Adaptive Controller Inspector', short: 'Ctrl', icon: Sliders },
    { id: 'builder', label: 'Experiment Builder', short: 'Build', icon: FlaskConical },
    { id: 'results', label: 'Results & Research Analysis', short: 'Data', icon: FileSpreadsheet },
    { id: 'docs', label: 'Research Documentation', short: 'Docs', icon: BookOpen },
  ];

  const formatProtocolName = (p: string) => {
    switch (p) {
      case 'stop_and_wait':
        return 'Stop-and-Wait';
      case 'go_back_n':
        return 'Go-Back-N';
      case 'selective_repeat':
        return 'Selective Repeat';
      case 'loss_rate_adaptive':
        return 'Loss-Rate Adaptive';
      case 'aura_bolt':
        return 'AURA-BOLT (Adaptive)';
      default:
        return p.replace(/_/g, ' ');
    }
  };

  return (
    <aside
      className={`transition-all duration-300 ease-in-out bg-[#171A21] border-r border-[#343B48] flex flex-col shrink-0 select-none z-20 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-3.5 border-b border-[#343B48] flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Custom Geometric Network SVG Logo */}
          <div className="w-9 h-9 rounded-lg bg-[#1D222B] border border-[#A78BFA]/30 flex items-center justify-center shrink-0 shadow-inner">
            <svg
              className="w-5 h-5 text-[#A78BFA]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="18" cy="6" r="2.5" />
              <circle cx="12" cy="18" r="2.5" />
              <circle cx="12" cy="10" r="1.5" />
              <path d="M7.8 7.2L10.7 9.2" />
              <path d="M16.2 7.2L13.3 9.2" />
              <path d="M12 11.5V15.5" />
              <path d="M6 8.5V15.5L10 17.5" strokeDasharray="2 2" strokeOpacity="0.6" />
              <path d="M18 8.5V15.5L14 17.5" strokeDasharray="2 2" strokeOpacity="0.6" />
            </svg>
          </div>

          {!isCollapsed && (
            <div className="leading-tight truncate">
              <div className="font-bold text-xs tracking-wider text-[#F3F4F6] flex items-center gap-1.5">
                <span>AURA-BOLT</span>
                <span className="text-[9px] font-mono px-1 py-0.2 bg-[#252B36] text-[#A78BFA] border border-[#A78BFA]/20 rounded">
                  v1.2
                </span>
              </div>
              <div className="text-[10px] text-[#9CA3AF] tracking-tight">
                Network Systems Research Lab
              </div>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#252B36] transition-colors"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Destinations */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectPage(item.id as PageId)}
              title={isCollapsed ? `${item.label} (Ctrl+${idx + 1})` : undefined}
              className={`group relative w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium rounded-md transition-all text-left ${
                isActive
                  ? 'bg-[#252B36] text-[#F3F4F6] border border-[#A78BFA]/40 shadow-sm'
                  : 'text-[#9CA3AF] hover:bg-[#1D222B] hover:text-[#F3F4F6]'
              }`}
            >
              {/* Active left indicator pill */}
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#A78BFA] rounded-r" />
              )}

              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-[#A78BFA]' : 'text-[#6B7280] group-hover:text-[#9CA3AF]'
                }`}
              />

              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between truncate">
                  <span className="truncate">{item.label}</span>
                  <span className="text-[10px] font-mono text-[#6B7280] group-hover:text-[#9CA3AF]">
                    {idx + 1}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Status Block */}
      <div className="p-3 border-t border-[#343B48] bg-[#101216]/60 text-xs font-mono space-y-2">
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="flex items-center gap-1.5 text-[11px]">
                <Cpu className="w-3.5 h-3.5 text-[#6B7280]" />
                Engine State
              </span>
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                  isRunning
                    ? 'bg-[#12352C] text-[#34D399] border border-[#34D399]/30 flex items-center gap-1'
                    : 'bg-[#252B36] text-[#6B7280] border border-[#343B48]'
                }`}
              >
                {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-ping" />}
                {isRunning ? 'TRANSMITTING' : 'IDLE / READY'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="text-[11px]">Active ARQ</span>
              <span className="text-[10px] text-[#A78BFA] font-medium truncate max-w-[120px]">
                {formatProtocolName(activeProtocol)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="flex items-center gap-1 text-[11px]">
                <Wifi className="w-3 h-3 text-[#6B7280]" />
                WS Telemetry
              </span>
              <span
                className={`text-[10px] ${
                  wsConnected ? 'text-[#34D399]' : 'text-[#6B7280]'
                }`}
              >
                {wsConnected ? 'LIVE FEED' : 'SIM LOCAL'}
              </span>
            </div>

            <div className="pt-1 border-t border-[#343B48]/50 flex items-center justify-between text-[10px] text-[#6B7280]">
              <span>Sim Clock</span>
              <span className="text-[#F3F4F6] font-semibold">{Math.round(simTimeMs)} ms</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRunning ? 'bg-[#34D399] animate-pulse' : 'bg-[#6B7280]'
              }`}
              title={isRunning ? 'Engine Running' : 'Engine Idle'}
            />
            <Activity className="w-3.5 h-3.5 text-[#6B7280]" />
          </div>
        )}
      </div>
    </aside>
  );
};
