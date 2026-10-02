// 2026-09-23 15:10:28 CST：集中维护 H5 module 对应的图片资源，使用 public 目录的根路径 URL。
// 触发场景：Page 页面和 waiting 页面根据当前 module 展示对应 banner。
// 维护注意：新增图片必须先放入 admin/public，再使用 `/banner/...` 路径访问；不要把 public 目录文件写成 Vite import。
export const MODULE_BANNERS: Record<string, string> = {
  module1: "/banner/w.png",
  module2: "/w/wx_ecny.svg",
  module3: "/banner/qd.png",
  module4: "/banner/t.png",
  module5: "/banner/q.svg",
  module6: "/banner/b.png",
  module7: "",
  module8: "",
  module9: "",
  module10: "",
};

export function getModuleBanner(module: string) {
  return MODULE_BANNERS[module] ?? "";
}
