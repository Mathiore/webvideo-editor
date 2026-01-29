import { Scissors, Image, ArrowRightLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ActionTab } from '@/types';

interface ActionTabsProps {
  activeTab: ActionTab;
  onTabChange: (tab: ActionTab) => void;
  disabled?: boolean;
}

const tabs: { id: ActionTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'trim', label: 'Trim', icon: Scissors },
  { id: 'frames', label: 'Frames', icon: Image },
  { id: 'convert', label: 'Convert', icon: ArrowRightLeft },
];

export function ActionTabs({ activeTab, onTabChange, disabled }: ActionTabsProps) {
  return (
    <div className="flex rounded-lg bg-muted/50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          disabled={disabled}
          className={cn(
            'relative flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            activeTab === tab.id
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label={tab.label}
          aria-selected={activeTab === tab.id}
          role="tab"
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-primary rounded-md glow-primary"
              transition={{ type: 'spring', duration: 0.3 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
