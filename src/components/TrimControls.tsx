import { useState, useEffect } from 'react';
import { Scissors, Zap, Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import type { VideoFile, TrimSettings } from '@/types';

interface TrimControlsProps {
  video: VideoFile;
  currentTime: number;
  onTrim: (settings: TrimSettings) => void;
  isProcessing: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function TrimControls({ video, currentTime, onTrim, isProcessing }: TrimControlsProps) {
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(video.duration);
  const [mode, setMode] = useState<'fast' | 'accurate'>('fast');

  useEffect(() => {
    setEndTime(video.duration);
  }, [video.duration]);

  const handleStartTimeChange = (value: number[]) => {
    const newStart = value[0];
    if (newStart < endTime) {
      setStartTime(newStart);
    }
  };

  const handleEndTimeChange = (value: number[]) => {
    const newEnd = value[0];
    if (newEnd > startTime) {
      setEndTime(newEnd);
    }
  };

  const setStartToCurrent = () => {
    if (currentTime < endTime) {
      setStartTime(currentTime);
    }
  };

  const setEndToCurrent = () => {
    if (currentTime > startTime) {
      setEndTime(currentTime);
    }
  };

  const handleTrim = () => {
    if (startTime >= endTime) {
      return;
    }
    onTrim({ startTime, endTime, mode });
  };

  const duration = endTime - startTime;
  const isValid = startTime < endTime && duration > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Scissors className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-foreground">Trim Video</h3>
          <p className="text-xs text-muted-foreground">Cut a portion of your video</p>
        </div>
      </div>

      {/* Start Time */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Start Time</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-primary">{formatTime(startTime)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={setStartToCurrent}
            >
              Set to current
            </Button>
          </div>
        </div>
        <Slider
          value={[startTime]}
          min={0}
          max={video.duration}
          step={0.01}
          onValueChange={handleStartTimeChange}
          aria-label="Start time"
        />
      </div>

      {/* End Time */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">End Time</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-primary">{formatTime(endTime)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={setEndToCurrent}
            >
              Set to current
            </Button>
          </div>
        </div>
        <Slider
          value={[endTime]}
          min={0}
          max={video.duration}
          step={0.01}
          onValueChange={handleEndTimeChange}
          aria-label="End time"
        />
      </div>

      {/* Duration display */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Output duration</span>
          <span className="font-mono font-medium text-foreground">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {mode === 'fast' ? 'Fast Cut' : 'Accurate Cut'}
            </p>
            <p className="text-xs text-muted-foreground">
              {mode === 'fast'
                ? 'Stream copy, faster but may have keyframe issues'
                : 'Re-encode, accurate but slower'}
            </p>
          </div>
        </div>
        <Switch
          checked={mode === 'accurate'}
          onCheckedChange={(checked) => setMode(checked ? 'accurate' : 'fast')}
          aria-label="Toggle accurate mode"
        />
      </div>

      {/* Trim button */}
      <Button
        className="w-full glow-primary"
        onClick={handleTrim}
        disabled={!isValid || isProcessing}
      >
        <Scissors className="w-4 h-4 mr-2" />
        Trim Video
      </Button>

      {!isValid && (
        <p className="text-xs text-destructive text-center">
          Start time must be less than end time
        </p>
      )}
    </motion.div>
  );
}
