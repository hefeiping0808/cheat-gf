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
export const Page9: FC = () => {
  const { module } = useModuleData();
  const { infoArr, setKey } = useH5Store();
  const moduleTheme = getModuleTheme(module);

  const pageLabels: Record<string, string[]> = {
    module1: [infoArr[11], infoArr[12], ],
    module2: [infoArr[11], infoArr[12], ],
    module3: [infoArr[11], infoArr[12], ],
    module4: [infoArr[11], infoArr[12], ],
    module5: [infoArr[11], infoArr[12], ],
    module6: [infoArr[11], infoArr[12], ],
  };

  return (
    <main className="min-h-screen w-screen bg-white px-6 py-10 text-sm">
      <div className="mx-auto w-full max-w-xl flex flex-col items-center gap-y-4">
        <Image src={getModuleBanner(module)} className={moduleBannerStyle[module]}></Image>

        <div className={clsx('w-[80vw] rounded-lg shadow-xl flex flex-col items-center gap-y-4 py-4')}>
          <div className={clsx("icon-[bi--info-circle-fill] text-5xl py-8", moduleTheme.bgClass)}></div>
          <div className="text-xl font-bold text-black">{pageLabels[module]?.[0] || "错误"}</div>
          <div className="text-[#b63333] text-sm">{pageLabels[module]?.[1] || ""}</div>
          <Button shape="round" onClick={() => setKey('key5')} className={' px-12 py-6 text-[16px] font-bold mb-4'} type="primary" variant="solid" color={moduleTheme.antdColor}>返回填写</Button>

        </div>
      </div>
    </main>
  );
};
