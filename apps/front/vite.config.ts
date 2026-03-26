/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@youtube-shorter/shared': '../../packages/shared/src/index.ts',
        },
    },
    define: {
        'process.env': {},
        'global': 'globalThis',
    },
    optimizeDeps: {
        include: ['@youtube-shorter/shared', 'class-transformer', 'class-validator', 'reflect-metadata'],
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
        watch: {
            usePolling: true,
        },
    },
    build: {
        sourcemap: true,
    },
    css: {
        devSourcemap: true,
    },
});
