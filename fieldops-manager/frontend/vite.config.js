import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — shared across all pages
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // TanStack Query + Axios — shared across all pages
          "vendor-query": ["@tanstack/react-query", "axios"],
          // Form libraries — only login + form-heavy pages
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          // Charts — only 3 pages use this; kept separate so other pages don't pay the cost
          "vendor-charts": ["recharts"],
          // Toast notifications
          "vendor-toast": ["react-toastify"],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:5000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, "/api"),
      },
    },
  },
});
