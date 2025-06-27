import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't delete other Electron build files
    rollupOptions: {
      input: {
        renderer: resolve(__dirname, 'dist/renderer.js'), // Use compiled JS files
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
        globals: {
          electron: 'electron'
        }
      },
      external: ['electron'], // Externalize Electron modules
    },
    target: 'esnext',
    sourcemap: true,
  },
  publicDir: false, // Don't copy static assets automatically
  server: {
    port: 5173,
    open: false,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
    extensions: ['.js', '.mjs', '.ts'] // Prioritize .js files from compilation
  },
  define: {
    // Define global variables for browser compatibility
    'process.env.NODE_ENV': '"production"',
  },
  optimizeDeps: {
    include: [
      './dist/imap-email-manager.js',
      './dist/email-composer.js',
      './dist/ui-theme-manager.js',
      './dist/ui-components.js'
    ]
  }
}); 