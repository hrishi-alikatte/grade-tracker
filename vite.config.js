import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        VitePWA({
            // injectManifest: we keep a small readable sw source
            // (src/sw.js) and the plugin injects the build-time precache
            // manifest — every deploy invalidates stale assets by content
            // hash instead of a hand-bumped cache name.
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.js',
            registerType: 'prompt',
            injectRegister: false,
            manifest: false, // public/manifest.json is the source of truth
            injectManifest: {
                globPatterns: ['**/*.{js,css,html,svg,png,webp,mp3,json,woff2}']
            }
        })
    ]
});
