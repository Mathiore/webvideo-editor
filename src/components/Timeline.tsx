import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Clip } from '@/types';

interface TimelineProps {
  clips: Clip[];
  activeClipId: string | null;
  onSelectClip: (id: string) => void;
  totalDuration: number;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onSplit?: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function Timeline({
  clips,
  activeClipId,
  onSelectClip,
  totalDuration,
  currentTime = 0,
  onSeek,
  onSplit
}: TimelineProps) {
  const clipPositions = useMemo(() => {
    if (clips.length === 0) return [];

    let currentTime = 0;
    return clips.map((clip) => {
      const clipDuration = clip.end - clip.start;
      const startPercent = (currentTime / totalDuration) * 100;
      const widthPercent = (clipDuration / totalDuration) * 100;
      const isActive = clip.id === activeClipId;

      const position = {
        clip,
        startPercent,
        widthPercent,
        startTime: currentTime,
        duration: clipDuration,
        isActive,
      };

      currentTime += clipDuration;
      return position;
    });
  }, [clips, activeClipId, totalDuration]);

  if (clips.length === 0) {
    return null;
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percent * totalDuration);
  };

  const playheadPercent = (currentTime / totalDuration) * 100;

  return (
    <div className="w-full bg-muted/30 rounded-lg p-3 border border-border flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={onSplit}
            disabled={!activeClipId}
            title="Split clip at playhead"
          >
            <Scissors className="w-4 h-4 mr-1.5" />
            Split
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          {formatDuration(currentTime)} / {formatDuration(totalDuration)}
        </div>
      </div>

      <div className="relative h-12">
        {/* Timeline track */}
        <div
          className="absolute inset-0 flex items-center cursor-pointer group"
          onClick={handleTimelineClick}
        >
          <div className="relative w-full h-8 bg-muted rounded overflow-hidden">
            {clipPositions.map((pos, index) => (
              <motion.div
                key={pos.clip.id}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`absolute h-full transition-all border-r border-background/20 last:border-r-0 ${pos.isActive
                    ? 'ring-2 ring-primary ring-offset-1 z-10'
                    : 'group-hover:opacity-80'
                  }`}
                style={{
                  left: `${pos.startPercent}%`,
                  width: `${pos.widthPercent}%`,
                  backgroundColor: pos.isActive
                    ? 'hsl(var(--primary))'
                    : `hsl(var(--primary) / 0.6)`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectClip(pos.clip.id);
                  handleTimelineClick(e);
                }}
                title={`${pos.clip.name} (${formatDuration(pos.startTime)} - ${formatDuration(pos.startTime + pos.duration)})`}
              />
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none"
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-red-500 rounded-full transform shadow-sm flex items-center justify-center">
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Time markers */}
        <div className="absolute top-full left-0 right-0 flex justify-between text-[10px] text-muted-foreground px-1 mt-1">
          <span>0:00</span>
          <span>{formatDuration(totalDuration)}</span>
        </div>
      </div>

      {/* Clip info below timeline */}
      {activeClipId && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-2 border-t border-border"
        >
          {(() => {
            const activePos = clipPositions.find((p) => p.clip.id === activeClipId);
            if (!activePos) return null;

            return (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate max-w-[200px]">{activePos.clip.name}</span>
                <span>{formatDuration(activePos.duration)}</span>
              </div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}
