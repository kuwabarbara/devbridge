import { copyFile, mkdir } from 'node:fs/promises';
// Serve the exact locked npm artifact from our own origin; no external CDN.
await mkdir(new URL('../public/relate/', import.meta.url), { recursive: true });
await copyFile(new URL('../node_modules/@relate/relate-wasm/relate_bg.wasm', import.meta.url), new URL('../public/relate/relate_bg.wasm', import.meta.url));
