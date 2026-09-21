
import colors from 'tailwindcss/colors'
import { addDynamicIconSelectors } from '@iconify/tailwind'

// 2026-09-12 00:00:00 CST：合并 h5 后由 admin 统一编译 Tailwind utility class。
// 触发场景：构建或开发 h5 module 页面；content 范围必须覆盖 admin/src/h5。
// 维护注意：新增 h5 页面目录后同步补充 content，避免生产构建丢失样式。
/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true,
  darkMode: 'selector',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
      extend: {
        animation: {
          'spin-slow': 'spin 3s linear infinite',
          orange: colors.orange['500'],
        },
        colors: {
          main: '#5B86E5',
        },
      },
    },
  plugins: [
    addDynamicIconSelectors()
  ],
};
