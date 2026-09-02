import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Resolve the project from the process working directory. This keeps Vite's
  // HTML asset names relative when the Chinese Windows path is temporarily
  // mounted to an ASCII drive for local builds and tests.
  root: process.cwd(),
  resolve: { preserveSymlinks: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AI Life Worlds',
        short_name: 'Life Worlds',
        description: '可加载不同剧本的 AI 人生世界沙盒',
        theme_color: '#f6f0e6',
        background_color: '#f6f0e6',
        display: 'standalone',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api/ai-proxy/zhipu': {
        target: 'https://open.bigmodel.cn',
        changeOrigin: true,
        rewrite: () => '/api/paas/v4/chat/completions',
      },
      '/api/ai-proxy/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: () => '/chat/completions',
      },
      '/api/ai-proxy/qwen': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
        rewrite: () => '/compatible-mode/v1/chat/completions',
      },
    },
  },
})
