import { useCallback, useState } from 'react';
import { Upload, FileVideo, Loader2, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { VideoFile } from '@/types';

interface UploaderProps {
  onFileSelect: (videoFile: VideoFile) => void;
  isLoading?: boolean;
}

// Using a CORS-enabled sample video URL (public domain video)
const SAMPLE_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const SUPPORTED_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

export function Uploader({ onFileSelect, isLoading }: UploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    
    if (!SUPPORTED_TYPES.includes(file.type) && !file.name.match(/\.(mp4|webm|ogg|mov)$/i)) {
      setError('Unsupported file type. Please use MP4, WebM, OGG, or MOV.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    
    // Get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      // Don't revoke objectUrl here - it's managed by the parent component (Index.tsx)
      // The parent will revoke it when clearing/changing videos
      onFileSelect({
        file,
        name: file.name,
        size: file.size,
        duration: video.duration,
        objectUrl,
        type: file.type,
      });
      // Cleanup temporary video element's reference
      video.removeAttribute('src');
      video.load();
    };
    
    video.onerror = () => {
      // Only revoke on error since we won't use this objectUrl
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      setError('Failed to load video. The file may be corrupted.');
    };
    
    video.src = objectUrl;
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

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
      processFile(file);
    }
  }, [processFile]);

  const loadSampleVideo = useCallback(async () => {
    setLoadingSample(true);
    setError(null);
    
    try {
      const response = await fetch(SAMPLE_VIDEO_URL, {
        mode: 'cors',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const file = new File([blob], 'sample_video.mp4', { type: 'video/mp4' });
      await processFile(file);
    } catch (err) {
      console.error('Failed to load sample video:', err);
      setError(
        err instanceof Error && err.message.includes('CORS')
          ? 'Sample video unavailable due to CORS restrictions. Please upload your own video file.'
          : 'Failed to load sample video. Please try uploading your own video file.'
      );
    } finally {
      setLoadingSample(false);
    }
  }, [processFile]);

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`upload-zone p-8 text-center cursor-pointer ${isDragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById('file-input')?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload video file"
        onKeyDown={(e) => e.key === 'Enter' && document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileInput}
          disabled={isLoading || loadingSample}
        />
        
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
            {isLoading || loadingSample ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-primary" />
            )}
          </div>
          
          <div>
            <p className="text-foreground font-medium">
              {isDragOver ? 'Drop your video here' : 'Drag & drop your video'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse • MP4, WebM, OGG, MOV
            </p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={loadSampleVideo}
        disabled={isLoading || loadingSample}
      >
        {loadingSample ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Play className="w-4 h-4 mr-2" />
        )}
        Load sample video
      </Button>
    </div>
  );
}
