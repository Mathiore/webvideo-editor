import { useState } from 'react';
import { Image, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { VideoFile, FrameSettings } from '@/types';

interface FramesControlsProps {
  video: VideoFile;
  onExtract: (settings: FrameSettings) => void;
  isProcessing: boolean;
}

export function FramesControls({ video, onExtract, isProcessing }: FramesControlsProps) {
  const [fps, setFps] = useState(1);

  const estimatedFrames = Math.ceil(video.duration * fps);

  const handleExtract = () => {
    onExtract({ fps });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Image className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-foreground">Extract Frames</h3>
          <p className="text-xs text-muted-foreground">Generate thumbnails from video</p>
        </div>
      </div>

      {/* FPS slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Frames per second</Label>
          <span className="text-sm font-mono text-primary">{fps} fps</span>
        </div>
        <Slider
          value={[fps]}
          min={0.5}
          max={5}
          step={0.5}
          onValueChange={(value) => setFps(value[0])}
          aria-label="Frames per second"
        />
        <p className="text-xs text-muted-foreground">
          Lower = fewer frames, higher = more frames
        </p>
      </div>

      {/* Estimated output */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Estimated frames
          </span>
          <span className="font-mono font-medium text-foreground">~{estimatedFrames} images</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border">
        <p className="text-xs text-muted-foreground">
          Frames will be extracted as JPEG images. You can preview them in a gallery and download all as a ZIP file.
        </p>
      </div>

      {/* Extract button */}
      <Button
        className="w-full glow-primary"
        onClick={handleExtract}
        disabled={isProcessing}
      >
        <Image className="w-4 h-4 mr-2" />
        Extract Frames
      </Button>
    </motion.div>
  );
}
