// FFmpeg Client - Bridge between UI and Web Worker

import type { 
  FFmpegCommand, 
  WorkerResponse, 
  ProcessingState, 
  TrimSettings, 
  FrameSettings, 
  ConvertSettings,
  MergeSettings,
  ExportResult,
  FrameData,
  Clip
} from '../types';

// Vite worker import – avoids optimizeDeps resolution issues
import FFmpegWorker from '../workers/ffmpeg.worker.ts?worker';

type ProgressCallback = (state: ProcessingState) => void;

/** Read file to ArrayBuffer so we can transfer to worker and avoid blob URL / Referrer Policy issues */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

class FFmpegClient {
  private worker: Worker | null = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;
  private currentCallback: ProgressCallback | null = null;
  private logs: string[] = [];
  private timeoutId: number | null = null;
  private readonly TIMEOUT_MS = 300000; // 5 minutes timeout

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    this.worker = new FFmpegWorker();
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);
  }

  private handleMessage(event: MessageEvent<WorkerResponse>) {
    const { type, payload } = event.data;
    
    switch (type) {
      case 'loaded':
        this.isLoaded = true;
        break;
        
      case 'progress':
        if (this.currentCallback && payload?.progress !== undefined) {
          const stepMessage = payload.step || payload.message || '';
          this.currentCallback({
            status: 'processing',
            progress: payload.progress,
            message: stepMessage || `Processing... ${payload.progress}%`,
            logs: this.logs,
          });
        }
        break;
        
      case 'log':
        if (payload?.message) {
          this.logs.push(payload.message);
          if (this.currentCallback) {
            this.currentCallback({
              status: 'processing',
              progress: 0,
              message: payload.message,
              logs: this.logs,
            });
          }
        }
        break;
        
      case 'complete':
        this.clearTimeout();
        if (this.currentCallback) {
          this.currentCallback({
            status: 'complete',
            progress: 100,
            message: 'Processing complete!',
            logs: this.logs,
          });
        }
        break;
        
      case 'error':
        this.clearTimeout();
        if (this.currentCallback) {
          this.currentCallback({
            status: 'error',
            progress: 0,
            message: payload?.error || 'Unknown error',
            logs: this.logs,
          });
        }
        break;
    }
  }

  private handleError(error: ErrorEvent) {
    this.clearTimeout();
    if (this.currentCallback) {
      this.currentCallback({
        status: 'error',
        progress: 0,
        message: `Worker error: ${error.message}`,
        logs: this.logs,
      });
    }
  }

  private clearTimeout() {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private startTimeout(callback: ProgressCallback) {
    this.clearTimeout();
    this.timeoutId = window.setTimeout(() => {
      callback({
        status: 'error',
        progress: 0,
        message: 'Processing timed out. The operation took too long.',
        logs: this.logs,
      });
      this.terminate();
      this.initWorker();
    }, this.TIMEOUT_MS);
  }

  async load(callback?: ProgressCallback): Promise<void> {
    if (this.isLoaded) return;
    
    // Check SharedArrayBuffer availability before loading
    if (typeof SharedArrayBuffer === 'undefined') {
      const error = new Error(
        'SharedArrayBuffer is not available. ' +
        'FFmpeg.wasm requires SharedArrayBuffer support. ' +
        'Please ensure the server sends Cross-Origin-Opener-Policy: same-origin and ' +
        'Cross-Origin-Embedder-Policy: require-corp headers.'
      );
      if (callback) {
        callback({
          status: 'error',
          progress: 0,
          message: error.message,
          logs: [],
        });
      }
      throw error;
    }
    
    if (this.loadPromise) {
      return this.loadPromise;
    }
    
    this.loadPromise = new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }
      
      const handleLoad = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'loaded') {
          this.worker?.removeEventListener('message', handleLoad);
          resolve();
        } else if (event.data.type === 'error') {
          this.worker?.removeEventListener('message', handleLoad);
          reject(new Error(event.data.payload?.error));
        }
      };
      
      this.worker.addEventListener('message', handleLoad);
      this.worker.postMessage({ type: 'load' });
      
      if (callback) {
        callback({
          status: 'loading',
          progress: 0,
          message: 'Loading FFmpeg...',
          logs: [],
        });
      }
    });
    
    return this.loadPromise;
  }

  async trim(
    file: File,
    settings: TrimSettings,
    callback: ProgressCallback
  ): Promise<ExportResult> {
    await this.load(callback);
    this.logs = [];
    this.currentCallback = callback;
    this.startTimeout(callback);
    const arrayBuffer = await readFileAsArrayBuffer(file);
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }
      const handleResult = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'complete') {
          this.worker?.removeEventListener('message', handleResult);
          const data = event.data.payload?.data;
          if (data) {
            const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : data.slice();
            const blob = new Blob([dataArray], { type: 'video/mp4' });
            resolve({
              id: crypto.randomUUID(),
              type: 'trim',
              filename: `trimmed_${Date.now()}.mp4`,
              size: data.byteLength,
              createdAt: new Date(),
              data: dataArray,
              objectUrl: URL.createObjectURL(blob),
            });
          }
        } else if (event.data.type === 'error') {
          this.worker?.removeEventListener('message', handleResult);
          reject(new Error(event.data.payload?.error));
        }
      };
      this.worker.addEventListener('message', handleResult);
      const command: FFmpegCommand = {
        type: 'trim',
        inputData: arrayBuffer,
        settings,
      };
      this.worker.postMessage({ type: 'execute', payload: command }, [arrayBuffer]);
    });
  }

  async extractFrames(
    file: File,
    settings: FrameSettings,
    callback: ProgressCallback
  ): Promise<ExportResult> {
    await this.load(callback);
    this.logs = [];
    this.currentCallback = callback;
    this.startTimeout(callback);
    const arrayBuffer = await readFileAsArrayBuffer(file);
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }
      const handleResult = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'complete') {
          this.worker?.removeEventListener('message', handleResult);
          const frames = event.data.payload?.frames;
          if (frames) {
            const frameData: FrameData[] = frames.map((f) => {
              const frameArray = f.data instanceof ArrayBuffer ? new Uint8Array(f.data) : f.data.slice();
              return {
                name: f.name,
                data: frameArray,
                objectUrl: URL.createObjectURL(new Blob([frameArray], { type: 'image/jpeg' })),
              };
            });
            const totalSize = frames.reduce((acc, f) => acc + f.data.byteLength, 0);
            resolve({
              id: crypto.randomUUID(),
              type: 'frames',
              filename: `frames_${Date.now()}.zip`,
              size: totalSize,
              createdAt: new Date(),
              data: new Uint8Array(),
              objectUrl: '',
              frames: frameData,
            });
          }
        } else if (event.data.type === 'error') {
          this.worker?.removeEventListener('message', handleResult);
          reject(new Error(event.data.payload?.error));
        }
      };
      this.worker.addEventListener('message', handleResult);
      const command: FFmpegCommand = {
        type: 'frames',
        inputData: arrayBuffer,
        settings,
      };
      this.worker.postMessage({ type: 'execute', payload: command }, [arrayBuffer]);
    });
  }

  async convert(
    file: File,
    settings: ConvertSettings,
    callback: ProgressCallback
  ): Promise<ExportResult> {
    await this.load(callback);
    this.logs = [];
    this.currentCallback = callback;
    this.startTimeout(callback);
    const arrayBuffer = await readFileAsArrayBuffer(file);
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }
      const handleResult = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'complete') {
          this.worker?.removeEventListener('message', handleResult);
          const data = event.data.payload?.data;
          if (data) {
            const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : data.slice();
            const blob = new Blob([dataArray], { type: 'video/webm' });
            resolve({
              id: crypto.randomUUID(),
              type: 'convert',
              filename: `converted_${Date.now()}.webm`,
              size: dataArray.byteLength,
              createdAt: new Date(),
              data: dataArray,
              objectUrl: URL.createObjectURL(blob),
            });
          }
        } else if (event.data.type === 'error') {
          this.worker?.removeEventListener('message', handleResult);
          reject(new Error(event.data.payload?.error));
        }
      };
      this.worker.addEventListener('message', handleResult);
      const command: FFmpegCommand = {
        type: 'convert',
        inputData: arrayBuffer,
        settings,
      };
      this.worker.postMessage({ type: 'execute', payload: command }, [arrayBuffer]);
    });
  }

  async merge(
    clips: Clip[],
    settings: MergeSettings,
    callback: ProgressCallback
  ): Promise<ExportResult> {
    if (clips.length < 2) {
      throw new Error('Need at least 2 clips to merge');
    }

    await this.load(callback);
    this.logs = [];
    this.currentCallback = callback;
    this.startTimeout(callback);

    // Read all clip files as ArrayBuffers
    const clipData = await Promise.all(
      clips.map(async (clip) => ({
        inputData: await readFileAsArrayBuffer(clip.file),
        start: clip.start,
        end: clip.end,
      }))
    );

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handleResult = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'complete') {
          this.worker?.removeEventListener('message', handleResult);
          const data = event.data.payload?.data;
          if (data) {
            const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : data.slice();
            const mimeType = settings.format === 'webm' ? 'video/webm' : 'video/mp4';
            const extension = settings.format === 'webm' ? 'webm' : 'mp4';
            const blob = new Blob([dataArray], { type: mimeType });
            resolve({
              id: crypto.randomUUID(),
              type: 'merge',
              filename: `merged_${Date.now()}.${extension}`,
              size: dataArray.byteLength,
              createdAt: new Date(),
              data: dataArray,
              objectUrl: URL.createObjectURL(blob),
            });
          }
        } else if (event.data.type === 'error') {
          this.worker?.removeEventListener('message', handleResult);
          reject(new Error(event.data.payload?.error));
        }
      };

      this.worker.addEventListener('message', handleResult);

      const command: FFmpegCommand = {
        type: 'merge',
        clips: clipData,
        settings,
      };

      // Transfer all ArrayBuffers
      const transferables = clipData.map((c) => c.inputData);
      this.worker.postMessage({ type: 'execute', payload: command }, transferables);
    });
  }

  terminate() {
    this.clearTimeout();
    this.worker?.terminate();
    this.worker = null;
    this.isLoaded = false;
    this.loadPromise = null;
  }
}

// Singleton instance
export const ffmpegClient = new FFmpegClient();
