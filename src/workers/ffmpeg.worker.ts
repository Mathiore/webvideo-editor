// FFmpeg Web Worker
// This worker runs FFmpeg operations in a separate thread to keep UI responsive

import { FFmpeg } from '@ffmpeg/ffmpeg';
import type { WorkerMessage, WorkerResponse, FFmpegCommand, TrimSettings, FrameSettings, ConvertSettings, MergeSettings } from '../types';

// Self-hosted core (public/ffmpeg/) – same-origin, avoids CORS/import failures in worker
const CORE_BASE = '/ffmpeg';

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;

// Send message to main thread
const sendMessage = (response: WorkerResponse) => {
  self.postMessage(response);
};

// Log handler
const logHandler = ({ message }: { message: string }) => {
  sendMessage({ type: 'log', payload: { message } });
};

// Progress handler  
const progressHandler = ({ progress }: { progress: number }) => {
  sendMessage({ type: 'progress', payload: { progress: Math.round(progress * 100) } });
};

// Custom progress handler for merge operations with step tracking
let currentStep = '';
const mergeProgressHandler = ({ progress }: { progress: number }, step: string) => {
  currentStep = step;
  sendMessage({
    type: 'progress',
    payload: {
      progress: Math.round(progress * 100),
      step,
      message: step
    }
  });
};

// Check if SharedArrayBuffer is available (required for FFmpeg)
const checkSharedArrayBuffer = () => {
  if (typeof SharedArrayBuffer === 'undefined') {
    throw new Error(
      'SharedArrayBuffer is not available. ' +
      'This is required for FFmpeg.wasm. ' +
      'Make sure the server sends Cross-Origin-Opener-Policy: same-origin and ' +
      'Cross-Origin-Embedder-Policy: require-corp headers.'
    );
  }
};

// Load FFmpeg – self-hosted core from public/ffmpeg/, toBlobURL avoids CORS/CORP in worker
const loadFFmpeg = async () => {
  if (isLoaded && ffmpeg) return;

  try {
    // Check SharedArrayBuffer availability first
    checkSharedArrayBuffer();

    ffmpeg = new FFmpeg();
    ffmpeg.on('log', logHandler);
    ffmpeg.on('progress', progressHandler);

    sendMessage({
      type: 'log',
      payload: { message: 'Loading FFmpeg core...' }
    });

    // Custom fetchToBlobURL to debug loading issues
    const fetchToBlobURL = async (url: string, type: string) => {
      sendMessage({ type: 'log', payload: { message: `Fetching ${url}` } });
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        sendMessage({ type: 'log', payload: { message: `Fetched ${url} (${blob.size} bytes)` } });
        return URL.createObjectURL(blob);
      } catch (e) {
        throw new Error(`Network error fetching ${url}: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    // Same-origin assets (public/ffmpeg/) + toBlobURL for reliable load in worker
    sendMessage({ type: 'log', payload: { message: 'Fetching FFmpeg core...' } });
    const coreURL = await fetchToBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript');

    sendMessage({ type: 'log', payload: { message: 'Fetching FFmpeg wasm...' } });
    const wasmURL = await fetchToBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm');

    sendMessage({ type: 'log', payload: { message: 'Initializing FFmpeg...' } });
    await ffmpeg.load({ coreURL, wasmURL });

    isLoaded = true;
    sendMessage({
      type: 'log',
      payload: { message: 'FFmpeg loaded successfully' }
    });
    sendMessage({ type: 'loaded' });
  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error) === '{}' ? error.toString() : JSON.stringify(error);
    }

    sendMessage({
      type: 'log',
      payload: { message: `FFmpeg load error details: ${errorMessage}` }
    });
    console.error('FFmpeg Worker Error:', error);
    sendMessage({
      type: 'error',
      payload: { error: `Failed to load FFmpeg: ${errorMessage}` }
    });
  }
};

// Write input file to FFmpeg filesystem - ALWAYS use ArrayBuffer to avoid blob URL / Referrer Policy issues
// Never use fetchFile(inputFile) as it may try to fetch blob URLs which fail in workers
const writeInputFile = async (
  inputData: ArrayBuffer | undefined,
  inputFile: File | undefined,
  inputName: string
) => {
  if (!ffmpeg) throw new Error('FFmpeg not loaded');
  let data: Uint8Array;
  if (inputData) {
    // Preferred: use transferred ArrayBuffer (no blob URL issues)
    data = new Uint8Array(inputData);
  } else if (inputFile) {
    // Fallback: read File directly using FileReader (not fetchFile which may use blob URLs)
    // This should rarely happen as we always send inputData from main thread
    data = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(reader.result));
        } else {
          reject(new Error('Failed to read file as ArrayBuffer'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsArrayBuffer(inputFile);
    });
  } else {
    throw new Error('No input data or file provided');
  }
  await ffmpeg.writeFile(inputName, data);
};

// Execute trim command
const executeTrim = async (
  inputData: ArrayBuffer | undefined,
  inputFile: File | undefined,
  settings: TrimSettings
): Promise<Uint8Array> => {
  if (!ffmpeg) throw new Error('FFmpeg not loaded');
  const inputName = 'input.mp4';
  const outputName = 'output.mp4';
  await writeInputFile(inputData, inputFile, inputName);

  const startStr = settings.startTime.toFixed(2);
  const endStr = settings.endTime.toFixed(2);

  let args: string[];
  if (settings.mode === 'fast') {
    // Fast cut - stream copy (may have keyframe issues)
    args = ['-ss', startStr, '-to', endStr, '-i', inputName, '-c', 'copy', outputName];
  } else {
    // Accurate cut - re-encode
    args = ['-ss', startStr, '-to', endStr, '-i', inputName, '-c:v', 'libx264', '-c:a', 'aac', '-preset', 'fast', outputName];
  }

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName) as Uint8Array;

  // Cleanup
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return data;
};

// Execute frame extraction
const executeFrames = async (
  inputData: ArrayBuffer | undefined,
  inputFile: File | undefined,
  settings: FrameSettings
): Promise<{ name: string; data: Uint8Array }[]> => {
  if (!ffmpeg) throw new Error('FFmpeg not loaded');
  const inputName = 'input.mp4';
  await writeInputFile(inputData, inputFile, inputName);

  // Create frames directory
  await ffmpeg.createDir('frames');

  const args = ['-i', inputName, '-vf', `fps=${settings.fps}`, 'frames/out_%03d.jpg'];
  await ffmpeg.exec(args);

  // Read all frame files
  const frames: { name: string; data: Uint8Array }[] = [];
  const files = await ffmpeg.listDir('frames');

  for (const f of files) {
    if (f.name.endsWith('.jpg')) {
      const frameData = await ffmpeg.readFile(`frames/${f.name}`) as Uint8Array;
      frames.push({ name: f.name, data: frameData });
      await ffmpeg.deleteFile(`frames/${f.name}`);
    }
  }

  // Cleanup
  await ffmpeg.deleteDir('frames');
  await ffmpeg.deleteFile(inputName);

  return frames;
};

// Execute format conversion
const executeConvert = async (
  inputData: ArrayBuffer | undefined,
  inputFile: File | undefined,
  settings: ConvertSettings
): Promise<Uint8Array> => {
  if (!ffmpeg) throw new Error('FFmpeg not loaded');
  const inputName = 'input.mp4';
  const outputName = 'output.webm';
  await writeInputFile(inputData, inputFile, inputName);

  // Map quality to CRF
  const crfMap: Record<string, number> = {
    low: 40,
    medium: 32,
    high: 24,
  };

  const crf = crfMap[settings.quality] || 32;

  const args = [
    '-i', inputName,
    '-c:v', 'libvpx-vp9',
    '-b:v', '0',
    '-crf', crf.toString(),
    '-c:a', 'libopus',
    '-deadline', 'realtime',
    '-cpu-used', '4',
    outputName
  ];

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName) as Uint8Array;

  // Cleanup
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return data;
};

// Execute merge operation
const executeMerge = async (
  clips: Array<{ inputData: ArrayBuffer; start: number; end: number }>,
  settings: MergeSettings
): Promise<Uint8Array> => {
  if (!ffmpeg) throw new Error('FFmpeg not loaded');
  if (clips.length < 2) throw new Error('Need at least 2 clips to merge');

  const normalizedFiles: string[] = [];

  try {
    // Step 1: Normalize each clip to H.264 + AAC
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const inputName = `input_${i}.mp4`;
      const normalizedName = `clip_${String(i + 1).padStart(3, '0')}.mp4`;

      sendMessage({
        type: 'log',
        payload: { message: `Normalizing clip ${i + 1}/${clips.length}...` }
      });
      sendMessage({
        type: 'progress',
        payload: {
          progress: Math.round((i / clips.length) * 50),
          step: `Normalizing clip ${i + 1}/${clips.length}`,
          message: `Normalizing clip ${i + 1}/${clips.length}`
        }
      });

      // Write input file
      const data = new Uint8Array(clip.inputData);
      await ffmpeg.writeFile(inputName, data);

      // Normalize: trim if needed, then re-encode to H.264 + AAC
      const startStr = clip.start.toFixed(2);
      const endStr = clip.end.toFixed(2);

      const normalizeArgs = [
        '-ss', startStr,
        '-to', endStr,
        '-i', inputName,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        normalizedName
      ];

      await ffmpeg.exec(normalizeArgs);
      normalizedFiles.push(normalizedName);

      // Cleanup input file
      await ffmpeg.deleteFile(inputName);
    }

    // Step 2: Create concat list file
    sendMessage({
      type: 'log',
      payload: { message: 'Creating concat list...' }
    });
    sendMessage({
      type: 'progress',
      payload: {
        progress: 50,
        step: 'Preparing merge...',
        message: 'Preparing merge...'
      }
    });

    const concatList = normalizedFiles.map(f => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('concat_list.txt', new TextEncoder().encode(concatList));

    // Step 3: Merge clips
    sendMessage({
      type: 'log',
      payload: { message: 'Merging clips...' }
    });
    sendMessage({
      type: 'progress',
      payload: {
        progress: 60,
        step: 'Merging clips...',
        message: 'Merging clips...'
      }
    });

    const outputName = settings.format === 'webm' ? 'merged.webm' : 'merged.mp4';

    // Try fast copy first
    let mergeArgs: string[];
    if (settings.format === 'mp4') {
      mergeArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat_list.txt',
        '-c', 'copy',
        outputName
      ];
    } else {
      // For WebM, we need to re-encode
      mergeArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat_list.txt',
        '-c:v', 'libvpx-vp9',
        '-b:v', '0',
        '-crf', '32',
        '-c:a', 'libopus',
        outputName
      ];
    }

    try {
      await ffmpeg.exec(mergeArgs);
    } catch (error) {
      // Fallback to re-encode if copy fails
      sendMessage({
        type: 'log',
        payload: { message: 'Copy failed, re-encoding...' }
      });

      if (settings.format === 'mp4') {
        mergeArgs = [
          '-f', 'concat',
          '-safe', '0',
          '-i', 'concat_list.txt',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '23',
          '-c:a', 'aac',
          outputName
        ];
      }

      await ffmpeg.exec(mergeArgs);
    }

    sendMessage({
      type: 'progress',
      payload: {
        progress: 95,
        step: 'Finalizing...',
        message: 'Finalizing...'
      }
    });

    const data = await ffmpeg.readFile(outputName) as Uint8Array;

    // Cleanup
    for (const file of normalizedFiles) {
      try {
        await ffmpeg.deleteFile(file);
      } catch {
        // Ignore cleanup errors
      }
    }
    try {
      await ffmpeg.deleteFile('concat_list.txt');
      await ffmpeg.deleteFile(outputName);
    } catch {
      // Ignore cleanup errors
    }

    return data;
  } catch (error) {
    // Cleanup on error
    for (const file of normalizedFiles) {
      try {
        await ffmpeg.deleteFile(file);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
};

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'load':
        await loadFFmpeg();
        break;

      case 'execute': {
        if (!payload) throw new Error('No payload provided');
        const cmd = payload as FFmpegCommand;
        const { type: cmdType, inputData, inputFile, settings, clips } = cmd;
        switch (cmdType) {
          case 'trim':
            const trimData = await executeTrim(inputData, inputFile, settings as TrimSettings);
            sendMessage({ type: 'complete', payload: { data: trimData } });
            break;
          case 'frames':
            const frames = await executeFrames(inputData, inputFile, settings as FrameSettings);
            sendMessage({ type: 'complete', payload: { frames } });
            break;
          case 'convert':
            const convertData = await executeConvert(inputData, inputFile, settings as ConvertSettings);
            sendMessage({ type: 'complete', payload: { data: convertData } });
            break;
          case 'merge':
            if (!clips) throw new Error('No clips provided for merge');
            const mergeData = await executeMerge(clips, settings as MergeSettings);
            sendMessage({ type: 'complete', payload: { data: mergeData } });
            break;
        }
        break;
      }

      case 'cancel':
        // FFmpeg doesn't have a clean cancel mechanism
        // In practice, we'd need to terminate the worker
        break;
    }
  } catch (error) {
    sendMessage({
      type: 'error',
      payload: { error: error instanceof Error ? error.message : 'Unknown error occurred' }
    });
  }
};
