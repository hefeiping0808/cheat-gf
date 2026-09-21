import { createFileRoute } from "@tanstack/react-router";
import H5Page from "@/h5/H5Page";

// 2026-09-12 00:00:00 CST：h5 只保留一个入口，页面内容由 Zustand 中的 module 状态切换。
// 触发场景：访问 `/h5?m=m1&t=xxxx`；不再通过 URL path 携带 module。
// 维护注意：m/t 是对外参数，内部仍使用 module1~module10，转换逻辑集中在 H5Page。
export const Route = createFileRoute("/h5")({ component: H5Page });
