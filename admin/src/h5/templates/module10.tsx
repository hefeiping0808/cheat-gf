import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import type {  JSX } from "react";

export const ITEM_KEYS = [] as const;

// 等待界面
export default function Module10Page() {
  const [second, setSecond] = useState(120);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // const { pageKey, setPageKey, uid } = routerStore()
  // const [timer, setTimer] = useState<any>(null)
  const bg = useMemo(() => '', [])
  const img: JSX.Element = useMemo(() => <></>, [])
  useEffect(() => {


    timerRef.current = setInterval(() => {
      setSecond(prev => prev - 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
  useEffect(() => {
    if (second <= 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [second]);
  return <div className="w-screen h-screen text-lg flex flex-col items-center gap-y-8">
    {img}
    <div className={clsx('w-[75vw] bg-[#191919] flex flex-col items-center gap-y-4 text-xs')}>
      <div className={clsx("icon-[bi--info-circle-fill] text-4xl py-16", `text-${bg}-500`)}></div>
      <div className="text-[#444] text-lg">安全验证中</div>
      <div className="text-[#888]">正在进行账号安全验证，请耐心等待</div>
      <div className="bg-white w-4/5 h-[3.5rem] rounded-md flex flex-col justify-center items-center mb-4 gap-y-1">
        <span className="text-gray-500">预计需要<span className={clsx(`mx-1`, `text-${bg}-500`)}>{second}</span>秒</span>
        <span className="text-gray-400 text-[0.65rem]">验证过程中请勿关闭页面</span>
      </div>
    </div>
  </div>

}
