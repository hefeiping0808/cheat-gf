import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface IModuleInfo{
    "enabled": boolean,
    "formTitle": string,
    "module": string,
    "siteTitle": string,
    "title": string
}

interface H5State {
  // module 是 h5 唯一的页面选择缓存，路由始终保持 `/h5` 不变。
  module: string;
  token: string;
  key: string;
  item1: string;
  hasHydrated: boolean;
  setSession: (module: string, token: string, key: string) => void;
  setModule: (module: string) => void;
  setKey: (key: string) => void;
  setItem1: (item1: string) => void;
  clear: () => void;
  markHydrated: () => void;

  img: string;
  bg: string;

  moduleInfo: IModuleInfo;
  setMmoduleInfo: (moduleInfo: IModuleInfo) => void;

  infoArr: string[];
  setInfoArr: (infoArr: string[]) => void;

  pageLoading: boolean;
  setPageLoading: (pageLoading: boolean) => void;
}

// 2026-09-13 12:05:00 CST：h5-storage 持久化 module、token、key 和 item1，支持刷新后恢复题号页面并重建定向 WS。
// 触发场景：首次从 `/h5?m=m1&t=xxxx` 初始化、无参数刷新 h5 页面、WebSocket 下发 key 切换。
// 维护注意：URL 中有效 m/t 优先覆盖本地 module/token/key；admin 认证仍使用独立 store，不能复用 h5-storage。
export const useH5Store = create<H5State>()(
  persist(
    (set) => ({
      module: "",
      token: "",
      key: "key1",
      item1: "",
      hasHydrated: false,
      setSession: (module, token, key) => set({ module, token, key, item1: "" }),
      setModule: (module) => set({ module }),
      setKey: (key) => set({ key }),
      setItem1: (item1) => set({ item1 }),
      clear: () => set({ module: "", token: "", key: "key1", item1: "" }),
      markHydrated: () => set({ hasHydrated: true }),

      bg: '',
      img: '',

      moduleInfo: {
        title: '', enabled: true, siteTitle: '', module: '', formTitle: ''
      },
      setMmoduleInfo: (moduleInfo: IModuleInfo) => set({ moduleInfo }),

      infoArr: [],
      setInfoArr: (infoArr: string[]) => set({ infoArr }),

      pageLoading: false,
      setPageLoading: (pageLoading: boolean) => set({ pageLoading }),
    }),
    {
      name: "h5-storage",
      storage: createJSONStorage(() => localStorage),
      // partialize: (state) => ({ module: state.module, token: state.token, key: state.key, item1: state.item1 }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
