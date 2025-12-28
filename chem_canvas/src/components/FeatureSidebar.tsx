import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type FeatureItem = {
  id: string;
  label: string;
  description: string;
  steps: string[];
  icon: LucideIcon;
  action?: () => void;
  children?: FeatureItem[];
};

export type FeatureGroup = {
  id: string;
  label: string;
  items: FeatureItem[];
};

interface FeatureSidebarProps {
  groups: FeatureGroup[];
  collapsed: boolean;
  activeId?: string | null;
  onToggle: () => void;
  onSelect: (feature: FeatureItem) => void;
  onHelp: (feature: FeatureItem) => void;
}

const FeatureSidebar: React.FC<FeatureSidebarProps> = ({
  groups,
  collapsed,
  activeId,
  onToggle,
  onSelect,
  onHelp
}) => {
  return (
    <aside
      className={`flex h-full flex-col border-r border-slate-800/70 bg-[#111111] ${collapsed ? 'w-16' : 'w-64'} transition-all duration-200`}
    >
      <div className="flex items-center justify-between px-3 py-3">
        {!collapsed && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Features
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/70 bg-[#171717] text-slate-300 transition hover:text-white"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-2 pb-4">
        {groups.map(group => (
          <div key={group.id} className="space-y-1">
            {!collapsed && (
              <div className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {group.label}
              </div>
            )}
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = item.id === activeId;
              return (
                <div key={item.id} className="space-y-1">
                  <div
                    className={`group flex w-full items-center rounded-xl transition-all duration-200 ${isActive
                      ? 'bg-[#1c1c1c] text-white shadow-sm shadow-black/30'
                      : 'text-slate-300 hover:bg-[#1a1a1a] hover:text-white'
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className="flex flex-1 items-center gap-3 px-3 py-2 text-left text-xs font-medium"
                      title={item.label}
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/70 bg-[#171717] text-slate-200">
                        <Icon className="h-4 w-4" />
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                    {!collapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onHelp(item);
                        }}
                        className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-md"
                        title="View Guide"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {!collapsed && item.children && (
                    <div className="space-y-1 pl-12">
                      {item.children.map(child => {
                        const ChildIcon = child.icon;
                        const isChildActive = child.id === activeId;
                        return (
                          <div
                            key={child.id}
                            className={`group flex w-full items-center rounded-lg transition-all duration-200 ${isChildActive
                              ? 'bg-[#1a1a1a] text-white'
                              : 'text-slate-400 hover:bg-[#181818] hover:text-slate-100'
                              }`}
                          >
                            <button
                              type="button"
                              onClick={() => onSelect(child)}
                              className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left text-[11px] font-medium"
                              title={child.label}
                            >
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-800 bg-[#151515] text-slate-300">
                                <ChildIcon className="h-3 w-3" />
                              </span>
                              <span className="truncate">{child.label}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onHelp(child);
                              }}
                              className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-600 hover:text-slate-300"
                              title="View Guide"
                            >
                              <HelpCircle className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default FeatureSidebar;
