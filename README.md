# Wasm Video Editor

A production-ready, browser-based video editor powered by FFmpeg WebAssembly. All processing happens locally in your browser — no server uploads, complete privacy.

## Features

### 🎬 Trim Video
- Select start and end times with precision
- **Fast Cut**: Stream copy (faster, may have keyframe issues)
- **Accurate Cut**: Re-encode for precise cuts
- Output format: MP4

### 🖼️ Extract Frames
- Generate thumbnails at configurable FPS (0.5 - 5 fps)
- Preview frames in a gallery grid
- Download all frames as a ZIP file (client-side)

### 🔄 Convert Format
- Convert MP4 to WebM (VP9 + Opus)
- Quality presets: Low, Medium, High
- Shows output file size after export

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** for blazing fast development
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **FFmpeg.wasm** for video processing
- **JSZip** + **FileSaver** for ZIP downloads
- **shadcn/ui** components

## Architecture

```
src/
├── components/
│   ├── Header.tsx          # App header with branding
│   ├── Uploader.tsx         # Drag-and-drop file upload
│   ├── VideoPreview.tsx     # HTML5 video player with controls
│   ├── VideoInfo.tsx        # File metadata display
│   ├── ActionTabs.tsx       # Tab navigation (Trim/Frames/Convert)
│   ├── TrimControls.tsx     # Trim settings UI
│   ├── FramesControls.tsx   # Frame extraction settings
│   ├── ConvertControls.tsx  # Format conversion settings
│   ├── OutputPanel.tsx      # Export history & downloads
│   └── EmptyState.tsx       # Onboarding empty state
├── lib/
│   └── ffmpegClient.ts      # FFmpeg client bridge
├── workers/
│   └── ffmpeg.worker.ts     # Web Worker for FFmpeg operations
├── types/
│   └── index.ts             # TypeScript definitions
└── pages/
    └── Index.tsx            # Main application page
```

## FFmpeg Commands Used

| Operation | Command |
|-----------|---------|
| Fast Trim | `-ss {start} -to {end} -i input.mp4 -c copy output.mp4` |
| Accurate Trim | `-ss {start} -to {end} -i input.mp4 -c:v libx264 -c:a aac output.mp4` |
| Extract Frames | `-i input.mp4 -vf fps={fps} frames/out_%03d.jpg` |
| Convert to WebM | `-i input.mp4 -c:v libvpx-vp9 -b:v 0 -crf {crf} -c:a libopus output.webm` |

## Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Browser Requirements

- Modern browser with WebAssembly support
- SharedArrayBuffer support (requires COOP/COEP headers in production)
- Recommended: Chrome, Firefox, Edge (latest versions)

## Privacy

**100% Local Processing**: Your videos never leave your device. All FFmpeg operations run in a Web Worker using WebAssembly, ensuring complete privacy and eliminating upload wait times.

## License

MIT
