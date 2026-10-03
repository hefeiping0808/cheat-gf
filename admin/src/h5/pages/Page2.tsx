import type {FC} from 'react'
import { useModuleData } from "../templates/moduleContext";
import { Button, Image } from 'antd'
import clsx from "clsx"
import { useH5Store} from '../store'
import { getModuleTheme, moduleBannerStyle } from "../moduleTheme";
import { getModuleBanner } from "../moduleAssets";

export const Page2: FC = () => {
  const { module } = useModuleData();
  const { infoArr } = useH5Store();
  const moduleTheme = getModuleTheme(module);

  const pageLabels: Record<string, string[]> = {
    module1: [infoArr[0], infoArr[1], ],
    module2: [infoArr[0], infoArr[1], ],
    module3: [infoArr[0], infoArr[1], ],
    module4: [infoArr[0], infoArr[1], ],
    module5: [infoArr[0], infoArr[1], ],
    module6: [infoArr[0], infoArr[1], ],
  };
  return <div className={clsx('w-screen h-screen  text-lg flex flex-col items-center gap-y-8')}>
    <Image src={getModuleBanner(module)} className={moduleBannerStyle[module]}></Image>
    <div className={clsx('w-[90vw] bg-[#393939] flex flex-col items-center gap-y-3 py-4')}>
      <div className="text-gray-200">{pageLabels[module]?.[0] || "-"}</div>
      <div className="text-[#888] text-sm">{pageLabels[module]?.[1] || "-"}</div>
      <Button onClick={async () => useH5Store.getState().setKey("key1")} className={'px-8 py-4 text-[16px] font-bold mb-4'} type="primary" variant="solid" color={moduleTheme.antdColor}>返回填写</Button>

    </div>
  </div>
}
