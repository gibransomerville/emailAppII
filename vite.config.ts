import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't delete other Electron build files
    rollupOptions: {
      input: {
        renderer: resolve(__dirname, 'dist/core/renderer.js'), // Updated path to match TypeScript output
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
  publicDir: 'public', // Copy static assets including PDF.js worker
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
      './dist/email/imap-email-manager.js',
      './dist/email/email-composer.js',
      './dist/ui/ui-theme-manager.js',
      './dist/ui/ui-components.js',
      'pdfjs-dist'
    ]
  }
}); 