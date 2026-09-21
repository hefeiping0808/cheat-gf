import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { useAuthStore } from "./stores/auth";
import { fetchSessionAndApplyToStore } from "./utils/session";
import { I18nProvider } from "./i18n";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function enableMocking() {
  const enableMockInBuild = import.meta.env.VITE_ENABLE_MOCK === "true";
  // 业务联调默认直接请求 GoFrame，只有显式打开开关时才启用脚手架 Mock。
  if (!enableMockInBuild) return;
  const { worker } = await import("./mocks/browser");
  return worker.start({ onUnhandledRequest: "bypass" });
}

enableMocking()
  .then(async () => {
    await useAuthStore.persist.rehydrate();
    const { isAuthenticated, tokens } = useAuthStore.getState();
    if (isAuthenticated && tokens) {
      try {
        await fetchSessionAndApplyToStore();
      } catch {
        useAuthStore.getState().logout();
      }
    }

    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <I18nProvider>
          <RouterProvider router={router} />
        </I18nProvider>
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    console.error("Failed to initialize app:", err);
  });
