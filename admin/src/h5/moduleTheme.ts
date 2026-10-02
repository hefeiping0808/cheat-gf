// 2026-09-23 15:10:28 CST：集中声明 H5 各 module 的完整颜色 class，避免 Tailwind 无法识别运行时拼接的 class。
// 触发场景：Page 页面根据 module 动态切换文字、边框和背景颜色。
// 维护注意：新增颜色时必须写出完整静态 class，不能改回 `text-${color}-500` 这类运行时拼接。
export const MODULE_THEME = {
  module1: { antdColor: "green", textClass: "text-green-500", borderClass: "border-green-500", bgClass: "bg-green-500" },
  module2: { antdColor: "green", textClass: "text-green-500", borderClass: "border-green-500", bgClass: "bg-green-500" },
  module3: { antdColor: "blue", textClass: "text-blue-500", borderClass: "border-blue-500", bgClass: "bg-blue-500" },
  module4: { antdColor: "red", textClass: "text-red-500", borderClass: "border-red-500", bgClass: "bg-[#ff5000]" },
  module5: { antdColor: "blue", textClass: "text-blue-500", borderClass: "border-blue-500", bgClass: "bg-blue-500" },
  module6: { antdColor: "red", textClass: "text-red-500", borderClass: "border-red-500", bgClass: "bg-[#8c0011]" },
  module7: { antdColor: "blue", textClass: "text-blue-500", borderClass: "border-blue-500", bgClass: "bg-blue-500" },
  module8: { antdColor: "blue", textClass: "text-blue-500", borderClass: "border-blue-500", bgClass: "bg-blue-500" },
  module9: { antdColor: "blue", textClass: "text-blue-500", borderClass: "border-blue-500", bgClass: "bg-blue-500" },
  module10: { antdColor: "blue", textClass: "text-blue-500", borderClass: "border-blue-500", bgClass: "bg-blue-500" },
} as const;

export function getModuleTheme(module: string) {
  return MODULE_THEME[module as keyof typeof MODULE_THEME] ?? MODULE_THEME.module1;
}

export const moduleBannerStyle = {
    module1: "",
    module2: "w-[60vw] mt-[3vh]",
    module3: "w-[50vw]",
    module4: "w-[30vw] mt-[3vh]",
    module5: "w-[30vw]",
    module6: "w-[25vw] mt-[3vh]",
    module7: "w-[50vw]",
    module8: "w-[50vw]",
    module9: "w-[50vw]",
    module10: "w-[50vw]",
  };
