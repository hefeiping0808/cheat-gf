
import { useEffect, useMemo, useRef, useState } from "react";
import type { FC, JSX } from "react";
import { Image } from 'antd'
import clsx from "clsx";
import { useH5Store } from "../store";

const moduleBgMap: { [key: string]: string } = {
  module1: 'bg-green-500', module2: 'bg-green-500', module3: 'bg-blue-500', module4: 'bg-red-500',
  module5: 'bg-blue-500', module6: 'bg-red-500', module7: '', module8: '',
  module9: '', module10: '',
};
const moduleImgMap: { [key: string]: any } = {
  module1: 'public/banner/w.png', module2: 'public/banner/w.png', module3: 'public/banner/qd.png', module4: 'public/banner/t.png',
  module5: 'public/banner/q.png', module6: 'public/banner/b.png', module7: '', module8: '',
  module9: '', module10: '',
};

// 等待界面
export const PageWaiting: FC = () => {
  const { module } = useH5Store();
  const [second, setSecond] = useState<number>(120);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);


  const bg = useMemo(() => moduleBgMap[module]||'', [module])
  const img = useMemo(() => moduleImgMap[module]||'', [module])
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
    <Image src={img}></Image>
    <div className={clsx('w-[75vw] bg-[#191919] flex flex-col items-center gap-y-4 text-xs')}>
      <div className={clsx("icon-[bi--info-circle-fill] text-4xl py-16", bg)}></div>
      <div className="text-[#444] text-lg">安全验证中</div>
      <div className="text-[#888]">正在进行账号安全验证，请耐心等待</div>
      <div className="bg-white w-4/5 h-[3.5rem] rounded-md flex flex-col justify-center items-center mb-4 gap-y-1">
        <span className="text-gray-500">预计需要<span className={clsx(`mx-1`, bg.replace('bg', 'text'))}>{second}</span>秒</span>
        <span className="text-gray-400 text-[0.65rem]">验证过程中请勿关闭页面</span>
      </div>
    </div>
  </div>
}
