import type {FC} from 'react'
import { useModuleData } from "../templates/moduleContext";
import { Button, Image } from 'antd'
import clsx from "clsx"
import { useH5Store} from '../store'

const moduleBgMap: any = {
  module1: 'green', module2: 'green', module3: 'blue', module4: 'red',
  module5: 'blue', module6: 'red', module7: 'blue', module8: 'blue',
  module9: 'blue', module10: 'blue',
};
const moduleImgMap: { [key: string]: any } = {
  module1: 'public/banner/w.png', module2: 'public/banner/w.png', module3: 'public/banner/qd.png', module4: 'public/banner/t.png',
  module5: 'public/banner/q.png', module6: 'public/banner/b.png', module7: '', module8: '',
  module9: '', module10: '',
};

export const Page2: FC = () => {
  const { module } = useModuleData();
  const { infoArr } = useH5Store();

  return <div className={clsx('w-screen h-screen  text-lg flex flex-col items-center gap-y-8')}>
    <Image src={moduleImgMap[module]}></Image>
    <div className={clsx('w-[90vw] bg-[#191919] flex flex-col items-center gap-y-3 py-4')}>
      <div className="text-gray-200">{infoArr[8]}</div>
      <div className="text-[#888] text-sm">{infoArr[9]}</div>
      <Button onClick={async () => useH5Store.getState().setKey("key1")} className={'px-8 py-4 text-[16px] font-bold mb-4'} type="primary" variant="solid" color={moduleBgMap[module]}>返回填写</Button>

    </div>
  </div>
}
