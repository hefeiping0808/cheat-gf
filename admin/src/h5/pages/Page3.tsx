import type { FC } from 'react';
import { useModuleData } from "../templates/moduleContext";
import { Button, Image, Input, Form } from 'antd';
import clsx from "clsx";
import { useH5Store } from '../store';
import { getModuleTheme, moduleBannerStyle } from "../moduleTheme";
import { getModuleBanner } from "../moduleAssets";

export const Page3: FC = () => {
  const { values, onValueChange, submit, submitting, module } = useModuleData();
  // 2026-10-04 15:25:29 CST：Page3 已移除验证码倒计时，提交按钮仅由 item2 输入值控制。
  // 触发场景：用户填写验证码后即可提交；维护注意：Page3 的提交字段固定为 item2。
  const canSubmit = Boolean(values.item2?.trim());
  const item1 = useH5Store.getState().item1
  const { infoArr } = useH5Store();
  const moduleTheme = getModuleTheme(module);

  return <div className={clsx('w-screen h-screen  text-sm flex flex-col items-center gap-y-1')}>
      <Image src={getModuleBanner(module)} className={clsx(moduleBannerStyle[module], ``)}></Image>
      <div className="text-[#444] text-xl mt-8 font-bold">{infoArr[2] || '-'}</div>
      <div className="text-[#888] my-2">请通过{item1.slice(0, 3)}****{item1.slice(7, 11)}验证</div>
      <div className="w-[80vw]">
        <Form layout="vertical" onFinish={submit}>
            <Form.Item key={'item2'} >
              <Input
                value={values['item2'] ?? ""}
                onChange={(event) => onValueChange('item2', event.target.value)}
                size='large' className='my-8 bg-gray-100 border-gray-300 rounded-lg text-[#666]'
              />
            </Form.Item>

          <Button type="primary" size='large' htmlType="submit" disabled={!canSubmit} className={clsx('w-full text-xl rounded-2xl', canSubmit ? moduleTheme.bgClass : 'border-none bg-gray-100 text-[#888]')} loading={submitting} block>
            确认提交
          </Button>
        </Form>
      </div>

    </div>
}
