import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Clip } from '@/types';

interface TimelineProps {
  clips: Clip[];
  activeClipId: string | null;
  onSelectClip: (id: string) => void;
  totalDuration: number;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function Timeline({ clips, activeClipId, onSelectClip, totalDuration }: TimelineProps) {
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

  return (
    <div className="w-full bg-muted/30 rounded-lg p-3 border border-border">
      <div className="relative h-16">
        {/* Timeline track */}
        <div className="absolute inset-0 flex items-center">
          <div className="relative w-full h-8 bg-muted rounded overflow-hidden">
            {clipPositions.map((pos, index) => (
              <motion.div
                key={pos.clip.id}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`absolute h-full cursor-pointer transition-all ${
                  pos.isActive
                    ? 'ring-2 ring-primary ring-offset-1 z-10'
                    : 'hover:opacity-80'
                }`}
                style={{
                  left: `${pos.startPercent}%`,
                  width: `${pos.widthPercent}%`,
                  backgroundColor: pos.isActive 
                    ? 'hsl(var(--primary))' 
                    : `hsl(var(--primary) / 0.6)`,
                }}
                onClick={() => onSelectClip(pos.clip.id)}
                title={`${pos.clip.name} (${formatDuration(pos.startTime)} - ${formatDuration(pos.startTime + pos.duration)})`}
              >
                {/* Clip label */}
                <div className="absolute inset-0 flex items-center justify-center px-1">
                  <span className="text-xs font-medium text-primary-foreground truncate max-w-full">
                    {pos.clip.name}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Time markers */}
        <div className="absolute top-0 left-0 right-0 flex justify-between text-xs text-muted-foreground px-1">
          <span>0:00</span>
          <span>{formatDuration(totalDuration)}</span>
        </div>
      </div>

      {/* Clip info below timeline */}
      {activeClipId && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 pt-2 border-t border-border"
        >
          {(() => {
            const activePos = clipPositions.find((p) => p.clip.id === activeClipId);
            if (!activePos) return null;
            
            const clip = activePos.clip;
            const isTrimmed = clip.start > 0 || clip.end < clip.duration;
            
            return (
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium text-foreground">{clip.name}</span>
                  {isTrimmed && (
                    <span className="ml-2 text-muted-foreground">
                      (Trimmed: {formatDuration(clip.start)} - {formatDuration(clip.end)})
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground">
                  Position: {formatDuration(activePos.startTime)} - {formatDuration(activePos.startTime + activePos.duration)}
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}
