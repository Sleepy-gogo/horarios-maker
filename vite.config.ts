import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  build: {
    cssMinify: "esbuild",
    target: "es2022",
    // The editor shell (React, Radix, motion, the scene engine) is one ~500 kB chunk by design; heavy dialogs split off.
    chunkSizeWarningLimit: 600,
  },
  // harfbuzzjs locates its .wasm through import.meta.url and uses top-level await; pre-bundling would break both.
  optimizeDeps: {
    exclude: ['harfbuzzjs'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
