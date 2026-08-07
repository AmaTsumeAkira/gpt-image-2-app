

# GPT Image 2 App

An AI image generation application based on the OpenAI gpt-image-2 API, supporting both Web and Android platforms.

[![Deploy to GitHub Pages](https://github.com/AmaTsumeAkira/gpt-image-2-app/actions/workflows/pages.yml/badge.svg)](https://github.com/AmaTsumeAkira/gpt-image-2-app/actions/workflows/pages.yml)

## Features

- **Text-to-Image / Image-to-Image / Multi-Image Synthesis** — Supports reference image upload and mask editing
- **Dual Providers** — APIMart (async polling) and DM-Fox (sync direct response)
- **Task Management** — Submission, progress tracking, retry, configuration reuse, batch operations
- **Folder Grouping** — Drag-and-drop classification, batch moving, quick filtering
- **Local Persistence** — IndexedDB stores task records and image cache, with no capacity limits
- **Database Browser** — View/download/delete all stored images in IndexedDB
- **Brush Mask Editing** — Built-in canvas tools, supports partial repaint
- **Image Upscaling** — Progressive upscaling from 1K → 2K → 4K
- **Search & Filter** — Quickly find by prompts, parameters, and status
- **Remote Task Fetching** — Fetch remote task status and results via task_id
- **Statistics Dashboard** — Usage and duration statistics by provider/time dimension
- **APK Online Update** — Check for new versions, auto-download and install
- **Offline Cache** — Local caching of remote images, browsable offline
- **Web Version** — Deployed on GitHub Pages, usable directly in browsers

## Tech Stack

| Layer | Technology |
|---|------|
| Framework | React 19 + TypeScript 5.8 |
| Build | Vite 6 |
| State Management | Zustand 5 (persist) |
| Styling | Tailwind CSS 3 |
| Persistence | IndexedDB + localStorage |
| Mobile | Capacitor 8 (Android) |
| CI/CD | GitHub Actions → GitHub Pages |

## Development

```bash
npm install
npm run dev        # Web development server
```

## Build

```bash
npm run build      # Web build → dist/
```

### Android Build

```bash
npm run build
npx cap sync android
npx cap open android   # Build APK with Android Studio
```

## Acknowledgments

This project was initially inspired by the project structure and partial UI design of [gpt_image_playground](https://github.com/CookSleep/gpt_image_playground), and has since undergone significant refactoring and feature expansion. Thanks to the original author [CookSleep](https://github.com/CookSleep) for their open-source contribution.

## License

[MIT License](LICENSE)
