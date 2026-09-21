import { useModuleData } from "./moduleContext";

export const ITEM_KEYS = ["item1", "item2", "item7", "item12"] as const;

export default function Module7Page() {
  const moduleData = useModuleData();
  const labels = new Map(moduleData.mappings.map((item) => [item.map_key, item.map_value]));

  // 2026-09-10 16:55:00 CST：保留 module7 独立页面布局，便于后续按业务需求单独调整样式。
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl p-6" data-module="module7">
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); moduleData.submit(); }}>
        {moduleData.itemKeys.map((key) => <label key={key} htmlFor={`module7-${key}`} className="grid gap-2 text-sm font-medium text-slate-700"><span>{labels.get(key) || key}</span><input id={`module7-${key}`} name={key} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-500 focus:ring-4 focus:ring-slate-100" value={moduleData.values[key] ?? ""} placeholder={key} required onChange={(event) => moduleData.onValueChange(key, event.target.value)} /></label>)}
        <div className="mt-2"><button className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={moduleData.submitting || !moduleData.canSubmit}>{moduleData.submitting ? "提交中…" : "提交"}</button><span role="status" className="ml-3 text-sm text-slate-500">{moduleData.message}</span></div>
      </form>
    </main>
  );
}
