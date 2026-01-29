import { useState, useCallback } from 'react';
import { FileVideo, X, ChevronUp, ChevronDown, Scissors, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Clip } from '@/types';

interface ClipsPanelProps {
  clips: Clip[];
  activeClipId: string | null;
  onAddClip: (file: File) => void;
  onRemoveClip: (id: string) => void;
  onMoveClip: (id: string, direction: 'up' | 'down') => void;
  onSelectClip: (id: string) => void;
  onTrimClip: (id: string) => void;
  isLoading?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ClipsPanel({
  clips,
  activeClipId,
  onAddClip,
  onRemoveClip,
  onMoveClip,
  onSelectClip,
  onTrimClip,
  isLoading = false,
}: ClipsPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      onAddClip(file);
    }
  }, [onAddClip]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddClip(file);
    }
  }, [onAddClip]);

  const totalSize = clips.reduce((acc, clip) => acc + clip.size, 0);
  const maxSizeMB = 500;
  const totalSizeMB = totalSize / (1024 * 1024);
  const isOverLimit = totalSizeMB > maxSizeMB;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileVideo className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-foreground">Clips</h3>
          <p className="text-xs text-muted-foreground">
            {clips.length} clip{clips.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Add Clip Zone */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById('clip-input')?.click()}
        role="button"
        tabIndex={0}
        aria-label="Add video clip"
      >
        <input
          id="clip-input"
          type="file"
          accept="video/*"
          onChange={handleFileInput}
          className="hidden"
          disabled={isLoading}
        />
        <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Drop video or click to add
        </p>
      </motion.div>

      {/* Size Warning */}
      {isOverLimit && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning-foreground text-xs"
        >
          <p className="font-medium mb-1">Large project size</p>
          <p>
            Total size: {totalSizeMB.toFixed(1)} MB (max {maxSizeMB} MB recommended)
          </p>
          <p className="mt-1 text-muted-foreground">
            Processing may be slower on older devices.
          </p>
        </motion.div>
      )}

      {/* Clips List */}
      <div className="space-y-2">
        <AnimatePresence>
          {clips.map((clip, index) => {
            const isActive = clip.id === activeClipId;
            const isTrimmed = clip.start > 0 || clip.end < clip.duration;
            const displayDuration = clip.end - clip.start;

            return (
              <motion.div
                key={clip.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className={`p-3 cursor-pointer transition-all ${
                    isActive 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => onSelectClip(clip.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail placeholder */}
                    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <FileVideo className="w-6 h-6 text-muted-foreground" />
                    </div>

                    {/* Clip Info */}
                    <div className="flex-1 min-w-0">
                      <p 
                        className="font-medium text-sm text-foreground truncate" 
                        title={clip.name}
                      >
                        {clip.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatBytes(clip.size)}</span>
                        <span>•</span>
                        <span>
                          {formatDuration(displayDuration)}
                          {isTrimmed && (
                            <span className="text-primary"> (trimmed)</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Trim button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTrimClip(clip.id);
                        }}
                        aria-label="Trim clip"
                        title="Trim clip"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                      </Button>

                      {/* Move Up */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveClip(clip.id, 'up');
                        }}
                        disabled={index === 0}
                        aria-label="Move up"
                        title="Move up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>

                      {/* Move Down */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveClip(clip.id, 'down');
                        }}
                        disabled={index === clips.length - 1}
                        aria-label="Move down"
                        title="Move down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>

                      {/* Remove */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveClip(clip.id);
                        }}
                        aria-label="Remove clip"
                        title="Remove clip"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {clips.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8 text-muted-foreground text-sm"
        >
          <p>No clips added yet</p>
          <p className="text-xs mt-1">Add videos to create a timeline</p>
        </motion.div>
      )}
    </div>
  );
}
