# Browser extension

The source is the existing v3.1 extension, now built with WXT and TypeScript. WXT produces the Chromium MV3 extension in `.output/chrome-mv3/`.

```sh
npm ci
npm run dev --workspace @jarvis/extension
npm run build --workspace @jarvis/extension
```

For a local install, use Chrome/Edge/Brave's extension page with Developer mode enabled and choose **Load unpacked**, then select `.output/chrome-mv3/`.

This Foundation milestone keeps the existing browser permissions and product behavior. The Examiner, CDP action runner, per-site data approval, and stronger local bridge authentication are planned milestones.
