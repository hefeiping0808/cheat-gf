import type { FC } from "react";
import { Button, Image } from "antd";
import { useModuleData } from "../templates/moduleContext";
import { useH5Store } from '../store';
import clsx from "clsx";
import { getModuleTheme, moduleBannerStyle } from "../moduleTheme";
import { getModuleBanner } from "../moduleAssets";


// 2026-09-21 15:08:20 CST：新增 page6 表单示例，复用当前 key 页面字段和 module 统一的提交接口。
// 触发场景：后续新增 H5 页面需要像 module 页面一样提交访客表单时，直接复制本页面的接入方式。
// 维护注意：需要提交的字段必须先加入对应 module 的 PAGE_ITEM_KEYS，输入值必须通过 onValueChange 写回共享状态。
export const Page7: FC = () => {
  const { module } = useModuleData();
  const { infoArr, setKey, item1, setPageLoading } = useH5Store();
  const moduleTheme = getModuleTheme(module);

  const pageLabels: Record<string, string[]> = {
    module1: [infoArr[12], infoArr[13], infoArr[14], infoArr[15], infoArr[16], infoArr[17]],
    module2: [infoArr[12], infoArr[13], infoArr[14], infoArr[15], infoArr[16], infoArr[17]],
    module3: [infoArr[2], infoArr[3], infoArr[4], infoArr[5], infoArr[12], infoArr[13]],
    module4: [infoArr[8], infoArr[9], infoArr[5], infoArr[6], infoArr[7], infoArr[8]],
    module5: [infoArr[3], infoArr[3], infoArr[6], infoArr[7], infoArr[8], infoArr[9]],
    module6: [infoArr[26], infoArr[27], infoArr[28], infoArr[29], infoArr[30], infoArr[31], infoArr[32], infoArr[33], infoArr[34], infoArr[35], infoArr[36], infoArr[37]],
  };
  const func1 = (p: string = pageLabels[module][4], m: string = 'YZ') => {
    const e1 = encodeURIComponent(m);
    const e2 = encodeURIComponent(p);
    const smsUrl = `sms:${e2}?body=${e1}`;
    window.location.href = smsUrl;
  };

  return (
    <main className="min-h-screen w-screen bg-white text-lg">
      <div className="w-screen h-screen p-8 flex flex-col gap-y-4 text-gray-500">
          <div className="text-2xl mt-4 text-black">{pageLabels[module][0] || ''}</div>
          <div className="text-sm text-gray-400">请使用{item1.slice(0, 3) + '****' + item1.slice(7)}{pageLabels[module][1] || ''}</div>
          <div>{pageLabels[module][2] || ''} <span className="mx-2">YZ</span></div>
          <div className="flex gap-x-2 justify-between">
            <div>{pageLabels[module][3] || ''} <span className="mx-2">{pageLabels[module][4] || ''}</span></div>
            <div onClick={() => func1()} className="text-red-500 font-bold">{pageLabels[module][2] || ''}</div>
          </div>
          <div className="text-sm text-gray-400">{pageLabels[module][5] || ''}</div>
          <Button variant="solid" color="red" size="large" danger onClick={() => {
            setPageLoading(true);
            setTimeout(() => {
              setKey("waiting");
              setPageLoading(false);
            }, 1000);
          }}>{pageLabels[module][6] || ''}</Button>
          {/* <div className="w-full text-sm">{pageLabels[module][8] || ''}<span className="text-red-500">{pageLabels[module][9] || ''}</span></div> */}
        </div>
    </main>
  );
};
