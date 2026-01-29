import { useState, useCallback } from 'react';
import { Download, Eye, Clock, FileVideo, Image, ChevronDown, ChevronUp, X, Archive, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { ExportResult, ProcessingState } from '@/types';

interface OutputPanelProps {
  processingState: ProcessingState;
  exports: ExportResult[];
  onPreview: (result: ExportResult) => void;
  onClearExport: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function OutputPanel({ processingState, exports, onPreview, onClearExport }: OutputPanelProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState<string | null>(null);

  const handleDownload = useCallback((result: ExportResult) => {
    if (result.objectUrl) {
      const link = document.createElement('a');
      link.href = result.objectUrl;
      link.download = result.filename;
      link.click();
    }
  }, []);

  const handleDownloadFramesZip = useCallback(async (result: ExportResult) => {
    if (!result.frames || result.frames.length === 0) return;
    
    setDownloadingZip(result.id);
    
    try {
      const zip = new JSZip();
      
      result.frames.forEach((frame) => {
        zip.file(frame.name, frame.data);
      });
      
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, result.filename);
    } catch (error) {
      console.error('Failed to create ZIP:', error);
    } finally {
      setDownloadingZip(null);
    }
  }, []);

  const isProcessing = processingState.status === 'processing' || processingState.status === 'loading';

  return (
    <div className="flex flex-col h-full">
      {/* Processing Status */}
      <AnimatePresence mode="wait">
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-4 mb-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">
                {processingState.status === 'loading' ? 'Loading FFmpeg...' : 'Processing...'}
              </span>
              <span className="text-sm font-mono text-primary">{processingState.progress}%</span>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full progress-gradient"
                initial={{ width: 0 }}
                animate={{ width: `${processingState.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            
            <p className="text-xs text-muted-foreground mt-2 truncate">
              {processingState.message}
            </p>

            {/* Logs toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-xs"
              onClick={() => setShowLogs(!showLogs)}
            >
              {showLogs ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" /> Hide Logs
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" /> Show Logs
                </>
              )}
            </Button>

            <AnimatePresence>
              {showLogs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <ScrollArea className="h-32 mt-2 rounded bg-background/50 p-2">
                    <div className="space-y-0.5">
                      {processingState.logs.slice(-50).map((log, i) => (
                        <p key={i} className="text-xs font-mono text-muted-foreground">
                          {log}
                        </p>
                      ))}
                    </div>
                  </ScrollArea>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {processingState.status === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 mb-4 rounded-lg bg-destructive/10 border border-destructive/20"
          >
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-xs text-destructive/80 mt-1">{processingState.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export History */}
      <div className="flex-1 min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground">Export History</h3>
          <span className="text-xs text-muted-foreground">{exports.length} items</span>
        </div>

        {exports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <FileVideo className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No exports yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your processed files will appear here
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100%-2rem)]">
            <div className="space-y-3 pr-2">
              {exports.map((result) => (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-card p-3 relative group"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onClearExport(result.id)}
                    aria-label="Remove export"
                  >
                    <X className="w-3 h-3" />
                  </Button>

                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      result.type === 'trim' ? 'bg-primary/10' :
                      result.type === 'frames' ? 'bg-success/10' :
                      result.type === 'merge' ? 'bg-primary/10' :
                      'bg-warning/10'
                    }`}>
                      {result.type === 'trim' && <FileVideo className="w-4 h-4 text-primary" />}
                      {result.type === 'frames' && <Image className="w-4 h-4 text-success" />}
                      {result.type === 'convert' && <FileVideo className="w-4 h-4 text-warning" />}
                      {result.type === 'merge' && <FileVideo className="w-4 h-4 text-primary" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {result.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formatBytes(result.size)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(result.createdAt)}
                        </span>
                      </div>

                      {/* Frame gallery for frames type */}
                      {result.type === 'frames' && result.frames && (
                        <div className="mt-2">
                          <div className="grid grid-cols-4 gap-1 mb-2">
                            {result.frames.slice(0, 8).map((frame, i) => (
                              <img
                                key={i}
                                src={frame.objectUrl}
                                alt={frame.name}
                                className="w-full aspect-video object-cover rounded"
                              />
                            ))}
                          </div>
                          {result.frames.length > 8 && (
                            <p className="text-xs text-muted-foreground">
                              +{result.frames.length - 8} more frames
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-3">
                        {result.type !== 'frames' && result.objectUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onPreview(result)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Preview
                          </Button>
                        )}
                        
                        {result.type === 'frames' ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleDownloadFramesZip(result)}
                            disabled={downloadingZip === result.id}
                          >
                            {downloadingZip === result.id ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Archive className="w-3 h-3 mr-1" />
                            )}
                            Download ZIP
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleDownload(result)}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
