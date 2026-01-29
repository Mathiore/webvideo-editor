import { useState } from 'react';
import { FileVideo, ArrowRightLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { VideoFile, ConvertSettings } from '@/types';

interface ConvertControlsProps {
  video: VideoFile;
  onConvert: (settings: ConvertSettings) => void;
  isProcessing: boolean;
}

const QUALITY_LABELS: Record<string, { label: string; description: string; crf: number }> = {
  low: { label: 'Low', description: 'Smaller file, lower quality', crf: 40 },
  medium: { label: 'Medium', description: 'Balanced size and quality', crf: 32 },
  high: { label: 'High', description: 'Larger file, better quality', crf: 24 },
};

export function ConvertControls({ video, onConvert, isProcessing }: ConvertControlsProps) {
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');

  const qualityToSlider = (q: string): number => {
    switch (q) {
      case 'low': return 0;
      case 'medium': return 50;
      case 'high': return 100;
      default: return 50;
    }
  };

  const sliderToQuality = (value: number): 'low' | 'medium' | 'high' => {
    if (value <= 25) return 'low';
    if (value <= 75) return 'medium';
    return 'high';
  };

  const handleSliderChange = (value: number[]) => {
    setQuality(sliderToQuality(value[0]));
  };

  const handleConvert = () => {
    onConvert({ quality, format: 'webm' });
  };

  const qualityInfo = QUALITY_LABELS[quality];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <ArrowRightLeft className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-foreground">Convert Format</h3>
          <p className="text-xs text-muted-foreground">Convert MP4 to WebM (VP9)</p>
        </div>
      </div>

      {/* Format display */}
      <div className="flex items-center justify-center gap-4 p-4 rounded-lg bg-muted/30 border border-border">
        <div className="text-center">
          <div className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-sm font-mono">
            MP4
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">Input</span>
        </div>
        <ArrowRightLeft className="w-5 h-5 text-primary" />
        <div className="text-center">
          <div className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-mono">
            WebM
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">Output</span>
        </div>
      </div>

      {/* Quality slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Quality</Label>
          <span className="text-sm font-medium text-primary">{qualityInfo.label}</span>
        </div>
        <Slider
          value={[qualityToSlider(quality)]}
          min={0}
          max={100}
          step={50}
          onValueChange={handleSliderChange}
          aria-label="Quality"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Smaller</span>
          <span>Balanced</span>
          <span>Better</span>
        </div>
      </div>

      {/* Quality info */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border">
        <p className="text-sm text-foreground">{qualityInfo.label} Quality</p>
        <p className="text-xs text-muted-foreground mt-1">{qualityInfo.description}</p>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">CRF: {qualityInfo.crf}</p>
      </div>

      {/* Info */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border">
        <p className="text-xs text-muted-foreground">
          WebM uses VP9 video codec and Opus audio codec. Great for web compatibility and smaller file sizes.
        </p>
      </div>

      {/* Convert button */}
      <Button
        className="w-full glow-primary"
        onClick={handleConvert}
        disabled={isProcessing}
      >
        <FileVideo className="w-4 h-4 mr-2" />
        Convert to WebM
      </Button>
    </motion.div>
  );
}
