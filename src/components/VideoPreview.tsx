import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { VideoFile } from '@/types';

interface VideoPreviewProps {
  video: VideoFile;
  startTime?: number;
  endTime?: number;
  onComplete?: () => void;
  autoPlay?: boolean;
  onTimeUpdate?: (time: number) => void;
  seekTo?: number | null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VideoPreview({ video, startTime, endTime, onTimeUpdate, seekTo, onComplete, autoPlay }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Handle external seek
  useEffect(() => {
    if (seekTo !== undefined && seekTo !== null && videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - seekTo) > 0.1) {
        videoRef.current.currentTime = seekTo;
        setCurrentTime(seekTo);
      }
    }
  }, [seekTo]);

  // Cleanup on unmount - ensure video is cleared before parent revokes blob URL
  useEffect(() => {
    return () => {
      const el = videoRef.current;
      if (el) {
        el.pause();
        el.removeAttribute('src');
        el.load();
      }
    };
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Store current URL to check if it changed
    const currentUrl = el.src;
    const newUrl = video.objectUrl;

    // Only update if URL actually changed
    if (currentUrl === newUrl) return;

    // Pause and clear src first to cancel any in-flight Range requests
    el.pause();
    el.removeAttribute('src');
    el.load();

    // Small delay to ensure previous requests are cancelled before setting new URL
    const timeoutId = setTimeout(() => {
      if (el && videoRef.current === el) {
        el.src = newUrl;

        // Initialize at startTime if provided
        const initialTime = startTime || 0;
        el.currentTime = initialTime;
        setCurrentTime(initialTime);

        if (autoPlay) {
          el.play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        } else {
          setIsPlaying(false);
        }

        // If there was a pending seek, apply it now (overrides startTime)
        if (seekTo !== undefined && seekTo !== null) {
          el.currentTime = seekTo;
          setCurrentTime(seekTo);
        }
      }
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      if (el && videoRef.current === el) {
        el.pause();
        el.removeAttribute('src');
        el.load();
      }
    };
  }, [video.objectUrl, seekTo, autoPlay, startTime]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    onTimeUpdate?.(time);

    // Check if we reached the end of the clip segment
    if (endTime !== undefined && time >= endTime && isPlaying) {
      onComplete?.();
    }
  }, [onTimeUpdate, endTime, isPlaying, onComplete]);

  // Handle natural video end
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    onComplete?.();
  }, [onComplete]);

  const handleSeek = useCallback((value: number[]) => {
    if (!videoRef.current) return;
    const time = value[0];
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVolumeChange = useCallback((value: number[]) => {
    if (!videoRef.current) return;
    const vol = value[0];
    videoRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  }, []);

  // Calculate timeline markers for trim range
  const trimStartPercent = startTime !== undefined ? (startTime / video.duration) * 100 : 0;
  const trimEndPercent = endTime !== undefined ? (endTime / video.duration) * 100 : 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card overflow-hidden"
    >
      {/* Video Container */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Play overlay button */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40"
            aria-label="Play video"
          >
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/90 glow-primary">
              <Play className="w-7 h-7 text-primary-foreground ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        {/* Timeline with trim markers */}
        <div className="relative">
          {/* Trim range indicator */}
          {(startTime !== undefined || endTime !== undefined) && (
            <div
              className="absolute top-0 h-full bg-primary/20 rounded pointer-events-none"
              style={{
                left: `${trimStartPercent}%`,
                width: `${trimEndPercent - trimStartPercent}%`,
              }}
            />
          )}
          <Slider
            value={[currentTime]}
            min={0}
            max={video.duration}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
            aria-label="Video timeline"
          />
        </div>

        {/* Time display */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(video.duration)}</span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                min={0}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="w-20"
                aria-label="Volume"
              />
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
          >
            <Maximize className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
