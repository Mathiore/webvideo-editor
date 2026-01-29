import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';
import { Uploader } from '@/components/Uploader';
import { VideoPreview } from '@/components/VideoPreview';
import { VideoInfo } from '@/components/VideoInfo';
import { ActionTabs } from '@/components/ActionTabs';
import { TrimControls } from '@/components/TrimControls';
import { FramesControls } from '@/components/FramesControls';
import { ConvertControls } from '@/components/ConvertControls';
import { OutputPanel } from '@/components/OutputPanel';
import { EmptyState } from '@/components/EmptyState';
import { ClipsPanel } from '@/components/ClipsPanel';
import { Timeline } from '@/components/Timeline';
import { ffmpegClient } from '@/lib/ffmpegClient';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { 
  VideoFile, 
  ActionTab, 
  ProcessingState, 
  ExportResult,
  TrimSettings,
  FrameSettings,
  ConvertSettings,
  MergeSettings,
  Clip,
  Project
} from '@/types';

const initialProcessingState: ProcessingState = {
  status: 'idle',
  progress: 0,
  message: '',
  logs: [],
};

/** Revoke blob URL after a delay so in-flight requests (e.g. video Range) can finish - videos can make multiple Range requests */
const revokeObjectURLDeferred = (url: string, delayMs = 2000) => {
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore if already revoked
    }
  }, delayMs);
};

function Index() {
  // Legacy single video support (for backward compatibility)
  const [video, setVideo] = useState<VideoFile | null>(null);
  
  // New timeline/project state
  const [project, setProject] = useState<Project>({
    clips: [],
    activeClipId: null,
  });
  
  const [activeTab, setActiveTab] = useState<ActionTab>('trim');
  const [currentTime, setCurrentTime] = useState(0);
  const [processingState, setProcessingState] = useState<ProcessingState>(initialProcessingState);
  const [exports, setExports] = useState<ExportResult[]>([]);
  const [previewResult, setPreviewResult] = useState<ExportResult | null>(null);
  const [trimmingClipId, setTrimmingClipId] = useState<string | null>(null);

  // Determine if we're in timeline mode (has clips) or single video mode
  const isTimelineMode = project.clips.length > 0;
  const activeClip = project.clips.find(c => c.id === project.activeClipId) || null;
  
  // For backward compatibility: if single video exists but no clips, use video
  const displayVideo = isTimelineMode ? null : video;
  
  // Calculate total timeline duration
  const totalDuration = useMemo(() => {
    return project.clips.reduce((acc, clip) => acc + (clip.end - clip.start), 0);
  }, [project.clips]);

  const handleAddClip = useCallback(async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    
    // Get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    return new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        const clip: Clip = {
          id: crypto.randomUUID(),
          name: file.name,
          file,
          size: file.size,
          duration: video.duration,
          objectUrl,
          type: file.type,
          start: 0,
          end: video.duration,
        };
        
        setProject((prev) => ({
          clips: [...prev.clips, clip],
          activeClipId: prev.activeClipId || clip.id,
        }));
        
        video.removeAttribute('src');
        video.load();
        resolve();
      };
      
      video.onerror = () => {
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load video'));
      };
      
      video.src = objectUrl;
    });
  }, []);

  const handleFileSelect = useCallback((videoFile: VideoFile) => {
    // If in timeline mode, add as clip; otherwise, set as single video
    if (isTimelineMode) {
      handleAddClip(videoFile.file);
    } else {
      setVideo((prev) => {
        if (prev?.objectUrl) {
          revokeObjectURLDeferred(prev.objectUrl);
        }
        return videoFile;
      });
      setProcessingState(initialProcessingState);
    }
  }, [isTimelineMode, handleAddClip]);

  const handleRemoveClip = useCallback((id: string) => {
    setProject((prev) => {
      const clip = prev.clips.find(c => c.id === id);
      if (clip?.objectUrl) {
        revokeObjectURLDeferred(clip.objectUrl);
      }
      
      const newClips = prev.clips.filter(c => c.id !== id);
      return {
        clips: newClips,
        activeClipId: prev.activeClipId === id 
          ? (newClips.length > 0 ? newClips[0].id : null)
          : prev.activeClipId,
      };
    });
  }, []);

  const handleMoveClip = useCallback((id: string, direction: 'up' | 'down') => {
    setProject((prev) => {
      const index = prev.clips.findIndex(c => c.id === id);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.clips.length) return prev;
      
      const newClips = [...prev.clips];
      [newClips[index], newClips[newIndex]] = [newClips[newIndex], newClips[index]];
      
      return {
        ...prev,
        clips: newClips,
      };
    });
  }, []);

  const handleSelectClip = useCallback((id: string) => {
    setProject((prev) => ({
      ...prev,
      activeClipId: id,
    }));
    setTrimmingClipId(null);
  }, []);

  const handleTrimClip = useCallback((id: string) => {
    setTrimmingClipId(id);
    setActiveTab('trim');
  }, []);

  const handleUpdateClipTrim = useCallback((id: string, start: number, end: number) => {
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map(clip =>
        clip.id === id ? { ...clip, start, end } : clip
      ),
    }));
  }, []);

  const handleClearVideo = useCallback(() => {
    if (video?.objectUrl) {
      revokeObjectURLDeferred(video.objectUrl);
    }
    setVideo(null);
    setCurrentTime(0);
    setProcessingState(initialProcessingState);
  }, [video]);

  const handleTrim = useCallback(async (settings: TrimSettings) => {
    // If trimming a specific clip in timeline mode
    if (trimmingClipId && isTimelineMode) {
      const clip = project.clips.find(c => c.id === trimmingClipId);
      if (!clip) return;
      
      try {
        const result = await ffmpegClient.trim(clip.file, settings, setProcessingState);
        setExports((prev) => [result, ...prev]);
        setProcessingState({ ...initialProcessingState, status: 'complete', message: 'Trim complete!' });
        
        // Update clip trim settings
        handleUpdateClipTrim(trimmingClipId, settings.startTime, settings.endTime);
        setTrimmingClipId(null);
      } catch (error) {
        setProcessingState({
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'Trim failed',
          logs: [],
        });
      }
      return;
    }
    
    // Legacy single video trim
    if (!video) return;
    
    try {
      const result = await ffmpegClient.trim(video.file, settings, setProcessingState);
      setExports((prev) => [result, ...prev]);
      setProcessingState({ ...initialProcessingState, status: 'complete', message: 'Trim complete!' });
    } catch (error) {
      setProcessingState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Trim failed',
        logs: [],
      });
    }
  }, [video, trimmingClipId, isTimelineMode, project.clips, handleUpdateClipTrim]);

  const handleExtractFrames = useCallback(async (settings: FrameSettings) => {
    const targetVideo = isTimelineMode && activeClip ? activeClip : video;
    if (!targetVideo) return;
    
    const file = isTimelineMode && activeClip ? activeClip.file : (video?.file);
    if (!file) return;
    
    try {
      const result = await ffmpegClient.extractFrames(file, settings, setProcessingState);
      setExports((prev) => [result, ...prev]);
      setProcessingState({ ...initialProcessingState, status: 'complete', message: 'Frames extracted!' });
    } catch (error) {
      setProcessingState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Frame extraction failed',
        logs: [],
      });
    }
  }, [video, isTimelineMode, activeClip]);

  const handleConvert = useCallback(async (settings: ConvertSettings) => {
    const targetVideo = isTimelineMode && activeClip ? activeClip : video;
    if (!targetVideo) return;
    
    const file = isTimelineMode && activeClip ? activeClip.file : (video?.file);
    if (!file) return;
    
    try {
      const result = await ffmpegClient.convert(file, settings, setProcessingState);
      setExports((prev) => [result, ...prev]);
      setProcessingState({ ...initialProcessingState, status: 'complete', message: 'Conversion complete!' });
    } catch (error) {
      setProcessingState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Conversion failed',
        logs: [],
      });
    }
  }, [video, isTimelineMode, activeClip]);

  const handleMerge = useCallback(async (settings: MergeSettings) => {
    if (project.clips.length < 2) return;
    
    try {
      const result = await ffmpegClient.merge(project.clips, settings, setProcessingState);
      setExports((prev) => [result, ...prev]);
      setProcessingState({ ...initialProcessingState, status: 'complete', message: 'Merge complete!' });
    } catch (error) {
      setProcessingState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Merge failed',
        logs: [],
      });
    }
  }, [project.clips]);

  const handleClearExport = useCallback((id: string) => {
    setExports((prev) => {
      const result = prev.find((e) => e.id === id);
      if (result) {
        if (result.objectUrl) {
          revokeObjectURLDeferred(result.objectUrl);
        }
        result.frames?.forEach((f) => revokeObjectURLDeferred(f.objectUrl));
      }
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const handlePreview = useCallback((result: ExportResult) => {
    setPreviewResult(result);
  }, []);

  const isProcessing = processingState.status === 'processing' || processingState.status === 'loading';
  const hasContent = isTimelineMode || !!video;
  const currentVideo = isTimelineMode && activeClip 
    ? {
        file: activeClip.file,
        name: activeClip.name,
        size: activeClip.size,
        duration: activeClip.duration,
        objectUrl: activeClip.objectUrl,
        type: activeClip.type,
      } as VideoFile
    : displayVideo;

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header hasVideo={hasContent} />
      
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel - Clips & Actions */}
        <aside className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-border p-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Clips Panel (Timeline Mode) */}
            {isTimelineMode && (
              <ClipsPanel
                clips={project.clips}
                activeClipId={project.activeClipId}
                onAddClip={handleAddClip}
                onRemoveClip={handleRemoveClip}
                onMoveClip={handleMoveClip}
                onSelectClip={handleSelectClip}
                onTrimClip={handleTrimClip}
                isLoading={isProcessing}
              />
            )}

            {/* Uploader (Single Video Mode or Empty) */}
            {!hasContent ? (
              <Uploader onFileSelect={handleFileSelect} isLoading={isProcessing} />
            ) : (
              <>
                {/* Video Info (Single Video Mode) */}
                {!isTimelineMode && video && (
                  <VideoInfo video={video} onClear={handleClearVideo} />
                )}

                {/* Merge Export Button (Timeline Mode) */}
                {isTimelineMode && project.clips.length >= 2 && (
                  <div className="space-y-2">
                    <Button
                      className="w-full glow-primary"
                      onClick={() => handleMerge({ format: 'mp4' })}
                      disabled={isProcessing || project.clips.length < 2}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Merged Video (MP4)
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleMerge({ format: 'webm' })}
                      disabled={isProcessing || project.clips.length < 2}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Merged Video (WebM)
                    </Button>
                  </div>
                )}
                
                <ActionTabs 
                  activeTab={activeTab} 
                  onTabChange={setActiveTab}
                  disabled={isProcessing}
                />
                
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'trim' && currentVideo && (
                      <TrimControls
                        video={currentVideo}
                        currentTime={currentTime}
                        onTrim={handleTrim}
                        isProcessing={isProcessing}
                      />
                    )}
                    {activeTab === 'frames' && currentVideo && (
                      <FramesControls
                        video={currentVideo}
                        onExtract={handleExtractFrames}
                        isProcessing={isProcessing}
                      />
                    )}
                    {activeTab === 'convert' && currentVideo && (
                      <ConvertControls
                        video={currentVideo}
                        onConvert={handleConvert}
                        isProcessing={isProcessing}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </div>
        </aside>

        {/* Center - Preview */}
        <div className="flex-1 p-4 overflow-y-auto min-h-0 flex flex-col">
          {hasContent && currentVideo ? (
            <>
              <VideoPreview
                video={currentVideo}
                startTime={activeTab === 'trim' && trimmingClipId ? activeClip?.start : undefined}
                endTime={activeTab === 'trim' && trimmingClipId ? activeClip?.end : undefined}
                onTimeUpdate={setCurrentTime}
              />
              {/* Timeline */}
              {isTimelineMode && (
                <div className="mt-4">
                  <Timeline
                    clips={project.clips}
                    activeClipId={project.activeClipId}
                    onSelectClip={handleSelectClip}
                    totalDuration={totalDuration}
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Right Panel - Output */}
        <aside className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border p-4 overflow-hidden">
          <OutputPanel
            processingState={processingState}
            exports={exports}
            onPreview={handlePreview}
            onClearExport={handleClearExport}
          />
        </aside>
      </main>

      {/* Preview Dialog */}
      <Dialog 
        open={!!previewResult} 
        onOpenChange={(open) => {
          if (!open) {
            // Clear video src before closing to cancel any pending Range requests
            const videoEl = document.querySelector('video[data-preview-dialog]') as HTMLVideoElement;
            if (videoEl) {
              videoEl.removeAttribute('src');
              videoEl.load();
            }
            // Defer revoke to allow any in-flight requests to complete
            if (previewResult?.objectUrl) {
              revokeObjectURLDeferred(previewResult.objectUrl);
            }
            setPreviewResult(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {previewResult && (
            <video
              data-preview-dialog
              src={previewResult.objectUrl}
              controls
              autoPlay
              className="w-full"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Index;
