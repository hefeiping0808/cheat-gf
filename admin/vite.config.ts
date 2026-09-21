import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react-swc";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from 'node:path'

const BACKEND_TARGET = "http://localhost:8000";

export default defineConfig({
  plugins: [
    tanstackRouter({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), './src'),
    },
  },
  server: {
    // 2026-09-10 10:17:07 CST：开发环境将管理端同源 API 和 WebSocket 请求转发到 GoFrame 后端；生产环境由网关负责 443 端口和路由，勿把此配置当作生产代理。
    proxy: {
      "/api": {
        target: BACKEND_TARGET,
        changeOrigin: true,
        ws: true,
      },
      "/ws": {
        target: BACKEND_TARGET,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("node_modules/antd")) {
            return "vendor-antd";
          }
          if (id.includes("@tanstack/react-router") || id.includes("@tanstack/react-query")) {
            return "vendor-tanstack";
          }
          if (id.includes("lucide-react")) {
            return "vendor-ui";
          }
        },
      },
    },
    chunkSizeWarningLimit: 1024,
  },
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
});
