// Video Editor Types

export interface VideoFile {
  file: File;
  name: string;
  size: number;
  duration: number;
  objectUrl: string;
  type: string;
}

export interface TrimSettings {
  startTime: number;
  endTime: number;
  mode: 'fast' | 'accurate';
}

export interface FrameSettings {
  fps: number;
}

export interface ConvertSettings {
  quality: 'low' | 'medium' | 'high';
  format: 'webm';
}

export interface ExportResult {
  id: string;
  type: 'trim' | 'frames' | 'convert' | 'merge';
  filename: string;
  size: number;
  createdAt: Date;
  data: Uint8Array;
  objectUrl: string;
  frames?: FrameData[];
}

export interface FrameData {
  name: string;
  data: Uint8Array;
  objectUrl: string;
}

export type ProcessingStatus = 'idle' | 'loading' | 'processing' | 'complete' | 'error';

export interface ProcessingState {
  status: ProcessingStatus;
  progress: number;
  message: string;
  logs: string[];
}

export interface Clip {
  id: string;
  name: string;
  file: File;
  size: number;
  duration: number;
  objectUrl: string;
  type: string;
  start: number; // Trim start time (0 = no trim)
  end: number; // Trim end time (duration = no trim)
  previewUrl?: string; // Thumbnail URL
}

export interface Project {
  clips: Clip[];
  activeClipId: string | null;
}

export interface MergeSettings {
  format: 'mp4' | 'webm';
}

export interface FFmpegCommand {
  type: 'trim' | 'frames' | 'convert' | 'merge';
  /** File object - only used when inputData is not provided (main thread may send inputData to avoid blob URL issues in worker) */
  inputFile?: File;
  /** File bytes transferred from main thread - preferred to avoid fetch(blob URL) / Referrer Policy issues in worker */
  inputData?: ArrayBuffer;
  /** Multiple clips for merge operation */
  clips?: Array<{ inputData: ArrayBuffer; start: number; end: number }>;
  settings: TrimSettings | FrameSettings | ConvertSettings | MergeSettings;
}

export interface WorkerMessage {
  type: 'load' | 'execute' | 'cancel';
  payload?: FFmpegCommand;
}

export interface WorkerResponse {
  type: 'loaded' | 'progress' | 'log' | 'complete' | 'error';
  payload?: {
    progress?: number;
    message?: string;
    data?: Uint8Array;
    frames?: { name: string; data: Uint8Array }[];
    error?: string;
    step?: string; // Current step description for merge operations
  };
}

export type ActionTab = 'trim' | 'frames' | 'convert';
