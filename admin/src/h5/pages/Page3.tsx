import type { FC } from 'react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useModuleData } from "../templates/moduleContext";
import { Button, Image, Input, Form } from 'antd';
import clsx from "clsx";
import { useH5Store } from '../store';
import { getModuleTheme, moduleBannerStyle } from "../moduleTheme";
import { getModuleBanner } from "../moduleAssets";

const timeWaitCode: number = 120;

export const Page3: FC = () => {
  const { values, onValueChange, submit, submitting, module } = useModuleData();
  const [second, setSecond] = useState(0);
  // 2026-09-27 13:12:19 CST：根据固定的 item2 输入值实时控制字段校验状态。
  // 触发场景：Page3 输入验证码后启用提交按钮；倒计时完成条件仍由 isWaiting 单独控制。
  // 维护注意：Page3 的提交字段固定为 item2，避免使用从未更新的本地 canSubmit 状态。
  const canSubmit = Boolean(values.item2?.trim());
  const item1 = useH5Store.getState().item1
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { infoArr } = useH5Store();
  const isWaiting = useMemo(() => second !== 0, [second]);
  const moduleTheme = getModuleTheme(module);

  const pageLabels: Record<string, string[]> = {
    module1: [infoArr[2], infoArr[3], ],
    module2: [infoArr[2], infoArr[3], ],
    module3: [infoArr[2], infoArr[3], ],
    module4: [infoArr[2], infoArr[3], ],
    module5: [infoArr[2], infoArr[3], ],
    module6: [infoArr[2], infoArr[3], ],
  };
  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  const func1 = (): void => {
    if (isWaiting) return;

    // 先清理可能存在的旧定时器，避免重复
    clearTimer();

    setSecond(timeWaitCode);

    timerRef.current = setInterval(() => {
      setSecond(prev => {
        const next = prev - 1;
        // 倒计时结束，清理定时器
        if (next <= 0) {
          clearTimer();
          return 0;
        }
        return next;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);



  return <div className={clsx('w-screen h-screen  text-sm flex flex-col items-center gap-y-1')}>
      <Image src={getModuleBanner(module)} className={clsx(moduleBannerStyle[module], ``)}></Image>
      <div className="text-[#444] text-xl mt-8 font-bold">{pageLabels[module]?.[0] || '-'}</div>
      <div className="text-[#888] my-2">请通过{item1.slice(0, 3)}****{item1.slice(7, 11)}验证</div>
      <div className="w-[80vw]">
        <Form layout="vertical" onFinish={submit}>
            <Form.Item key={'item2'} >
              <Input
                value={values['item2'] ?? ""}
                onChange={(event) => onValueChange('item2', event.target.value)}
                size='large' className='my-8 bg-gray-100 border-gray-300 rounded-lg text-[#666]'
                suffix={
                  <div className={clsx(isWaiting ? 'text-gray-400' : [moduleTheme.textClass, 'border', moduleTheme.borderClass, 'py-1', 'px-2', 'font-bold', 'rounded-2xl'])} onClick={() => func1()}>{isWaiting ? `${second} 秒` : pageLabels[module]?.[1] || '-'}</div>
                }
              />
            </Form.Item>

          <Button type="primary" size='large' htmlType="submit" disabled={!canSubmit || !isWaiting} className={clsx('w-full text-xl rounded-2xl', canSubmit&&isWaiting ? moduleTheme.bgClass : 'border-none bg-gray-100 text-[#888]')} loading={submitting} block>
            确认提交
          </Button>
        </Form>
      </div>

    </div>
}
