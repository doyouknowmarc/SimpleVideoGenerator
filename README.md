# Simple Video Generator

A web app that turns a storyboard of images and audio clips into an MP4 video. Built around a **Quick-Add Wizard** that pairs images and audio by filename and lays them out on a horizontal timeline you can fine-tune.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![SQLite](https://img.shields.io/badge/SQLite-Prisma-blue) ![FFmpeg](https://img.shields.io/badge/FFmpeg-render-orange)

## Features

- **Quick-Add Wizard** — drop a folder of images + audio, the wizard auto-pairs them by filename (`1.png` ↔ `Slide1 NEU.wav`, `3.1.png` ↔ `Slide 3.1.wav`, etc.) and lets you tweak durations in a table before sending the whole batch to the timeline
- **Horizontal timeline** with separate image and audio tracks
- **Drag-and-drop clips** to reposition; drag edges to stretch durations
- **Snapping** to a 0.1s grid and to neighbouring clip edges (toggleable)
- **In-browser preview** with transport controls and Geist-mono timecode
- **Resizable preview/timeline split**, **collapsible** asset library sections, **editable project title**
- **Keyboard**: Space play/pause · Del/Backspace remove · ⌘D duplicate
- **Export to MP4** — 1920×1080, 30fps, H.264/AAC via server-side FFmpeg (independent image and audio tracks, audio clips mixed with `adelay`+`amix`)

## Requirements

- Node.js 18+
- [FFmpeg](https://ffmpeg.org/download.html) and `ffprobe` on your PATH (`brew install ffmpeg` on macOS)

## Getting started

```bash
git clone https://github.com/doyouknowmarc/SimpleVideoGenerator.git
cd SimpleVideoGenerator
npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **+ Add Media**, drop in some images and audio, and you have a slideshow in under a minute.

## Configuration

Copy `.env.example` to `.env` and adjust paths if FFmpeg is not on your PATH:

```env
DATABASE_URL="file:./dev.db"
FFMPEG_PATH="/opt/homebrew/bin/ffmpeg"
FFPROBE_PATH="/opt/homebrew/bin/ffprobe"
```

## How it works

1. **Upload** — assets are stored under `storage/uploads/`. Image dimensions via `sharp`; audio duration via `ffprobe`.
2. **Quick-Add Wizard** — opens from "+ Add Media". You drop files in bulk, then a table shows each pairing (auto-matched by filename token), where you can override the audio and duration, then "Add to timeline" (append or replace).
3. **Edit** — image and audio clips live on independent tracks and can be moved, resized, duplicated, deleted. The timeline auto-saves to SQLite via Prisma after every change.
4. **Preview** — the browser swaps `<img>` elements and plays multiple `<audio>` clips with the right time offset. No video encoding needed for preview.
5. **Render** — server-side FFmpeg in three stages: (a) build the video track from image clips with black fillers for gaps; (b) mix audio clips with `adelay`+`amix`; (c) combine into `final.mp4`.

## Design language

Light "Precision Video Workspace" palette — sterile white surfaces, slate text, indigo primary (`#4f46e5`). Inter for UI, Geist Mono for timecodes and ruler labels. Soft 4–8px corners, low-contrast outlines instead of drop shadows.

## Project structure

```
src/
  app/
    page.tsx                    Main editor page
    api/                        Upload, project save/load, render endpoints
  components/
    ProjectTitle.tsx            Editable project title in header
    AddMediaButton.tsx          + Add Media → opens wizard
    QuickAddWizard.tsx          Bulk upload + filename auto-pairing table
    AssetLibrary.tsx            Collapsible Images / Audio sections, drag to timeline
    WorkspaceSplit.tsx          Resizable preview/timeline divider
    PreviewPlayer.tsx           Centered preview stage
    TransportControls.tsx       Play/pause/skip + timecode
    TimelineEditor.tsx          Pixel-based timeline (move, resize, snap, drop)
    TimelineRuler.tsx           Time ruler with playhead
    TimelineClip.tsx            Individual clip
    BottomToolbar.tsx           Scissors / duplicate / trash / snap toggle
    ExportButton.tsx            Export popover with job progress
    icons.tsx                   SVG icon set
  lib/
    pairing.ts                  Filename → slot-token heuristic for auto-pairing
    timelineHelpers.ts          Duration math, render validation, grid snap
    ffmpeg.ts                   ffmpeg / ffprobe wrappers
    render-worker.mjs           Background render worker (no build step)
  state/
    timelineStore.ts            Zustand store with autosave
prisma/
  schema.prisma                 Project, MediaAsset, TimelineClip, RenderJob
storage/
  uploads/                      Original uploaded files
  renders/                      Per-job scene files and final.mp4
```

## Output format

| Setting | Value |
|---------|-------|
| Resolution | 1920 × 1080 |
| Frame rate | 30 fps |
| Video codec | H.264 (libx264) |
| Audio codec | AAC 192 kbps, 44.1 kHz stereo |
| Container | MP4 |

Gaps between image clips render as black. Audio clips can overlap (they mix in the output).

## License

MIT
