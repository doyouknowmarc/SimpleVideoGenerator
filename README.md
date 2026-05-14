# Simple Video Generator

A web app that turns a storyboard of images and audio clips into an MP4 video. Upload assets, arrange scenes, preview in-browser, and export — all in one Next.js app.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![SQLite](https://img.shields.io/badge/SQLite-Prisma-blue) ![FFmpeg](https://img.shields.io/badge/FFmpeg-render-orange)

## Features

- **Upload** images (JPG, PNG, WebP) and audio (MP3, WAV, AAC, M4A)
- **Storyboard editor** — one image + optional audio per scene
- **Duration control** — set manually or match to audio length with one click
- **Drag-and-drop reorder** scenes
- **In-browser preview** — plays images and audio in sync along a timeline
- **Export to MP4** — 1920×1080, 30fps, H.264/AAC via server-side FFmpeg
- **Auto-saves** changes as you edit

## Requirements

- Node.js 18+
- [FFmpeg](https://ffmpeg.org/download.html) and `ffprobe` on your PATH

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg
```

## Getting started

```bash
git clone https://github.com/doyouknowmarc/SimpleVideoGenerator.git
cd SimpleVideoGenerator

npm install

# Initialise the SQLite database
npm run db:push

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Copy `.env.example` to `.env` and adjust if FFmpeg is not on your PATH:

```env
DATABASE_URL="file:./dev.db"
FFMPEG_PATH="/opt/homebrew/bin/ffmpeg"
FFPROBE_PATH="/opt/homebrew/bin/ffprobe"
```

## How it works

1. **Upload** — assets are stored under `storage/uploads/`. Image dimensions are read with `sharp`; audio duration is probed with `ffprobe`.
2. **Edit** — the storyboard is persisted in SQLite via Prisma and auto-saved on every change.
3. **Preview** — the browser swaps `<img>` elements and plays `<audio>` clips timed to each scene. No video encoding needed for preview.
4. **Render** — clicking *Export MP4* sends the timeline to the server. A background Node worker calls FFmpeg once per scene (still image → video segment with audio), then concatenates all segments with `ffmpeg -f concat` into a final `final.mp4` under `storage/renders/<jobId>/`.

## Project structure

```
src/
  app/
    page.tsx                  Main editor page
    api/
      upload/                 Multipart file upload + metadata extraction
      assets/[id]/file/       Serve uploaded files
      projects/               Load project + assets + timeline
      projects/[id]/          Save timeline changes
      render/                 Start a render job
      render/[jobId]/         Poll job status
      render/[jobId]/file/    Download finished MP4
  components/
    UploadPanel.tsx
    AssetLibrary.tsx
    Timeline.tsx
    SceneCard.tsx
    PreviewPlayer.tsx
    ExportButton.tsx
  state/
    timelineStore.ts          Zustand store with autosave
  lib/
    ffmpeg.ts                 ffmpeg / ffprobe wrappers
    render-worker.mjs         Background render worker (plain ESM, no build step)
    timelineCalc.ts           Start-time computation, render validation
prisma/
  schema.prisma               Project, MediaAsset, TimelineItem, RenderJob
storage/
  uploads/                    Original uploaded files
  renders/                    Per-job scene files and final.mp4
```

## Output format

| Setting | Value |
|---------|-------|
| Resolution | 1920 × 1080 |
| Frame rate | 30 fps |
| Video codec | H.264 (libx264) |
| Audio codec | AAC 192 kbps, 44.1 kHz stereo |
| Container | MP4 |

Scenes without audio get a silent audio track so concatenation stays uniform.

## MVP limitations

The following are out of scope for this initial version:

- Multi-project support and user accounts
- Fade or other transitions between scenes
- Text overlays and keyframe animation
- Waveform editor
- Cloud storage (S3) or a background job queue (BullMQ)

## License

MIT
