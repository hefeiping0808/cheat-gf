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

// 2026-10-12 11:16:23 CST：同一 module/token 再次打开 H5 链接时续用已持久化的 key 与 item1，不同链接则重置访客身份。
// 触发场景：访客离开后重新打开原链接，需保留身份并让 WebSocket 恢复到同一条访客记录。
// 维护注意：访客链接以 module/token 区分恢复范围；更换其中任一项时必须清除旧 item1，避免串用访客状态。
export const useH5Store = create<H5State>()(
  persist(
    (set) => ({
      module: "",
      token: "",
      key: "key1",
      item1: "",
      hasHydrated: false,
      setSession: (module, token, key) => set((current) => {
        const resumeSameVisitor = current.module === module && current.token === token;
        return {
          module,
          token,
          key: resumeSameVisitor ? current.key : key,
          item1: resumeSameVisitor ? current.item1 : "",
        };
      }),
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
