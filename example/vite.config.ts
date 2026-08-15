import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Point straight at the source so edits show up without a rebuild.
    alias: {
      'cf-react-internet-status': resolve(__dirname, '../src/index.ts'),
    },
  },
});
