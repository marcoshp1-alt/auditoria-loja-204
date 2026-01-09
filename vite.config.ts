import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Stringify the API key to inject it into the client-side code safely during build
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill process.env to prevent crashes in libraries that expect it
      'process.env': {}
    },
    server: {
      port: 3000
    },
    build: {
      outDir: 'dist',
    }
  };
});