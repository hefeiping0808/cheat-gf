import type { FC } from "react";
import { useMemo } from "react";
import { Button, Form, Input } from "antd";
import { useModuleData } from "../templates/moduleContext";
import clsx from "clsx";
import { useH5Store } from '../store';
import { getModuleTheme, moduleBannerStyle } from "../moduleTheme";
import { getModuleBanner } from "../moduleAssets";



// 2026-09-21 15:08:20 CST：新增 page6 表单示例，复用当前 key 页面字段和 module 统一的提交接口。
// 触发场景：后续新增 H5 页面需要像 module 页面一样提交访客表单时，直接复制本页面的接入方式。
// 维护注意：需要提交的字段必须先加入对应 module 的 PAGE_ITEM_KEYS，输入值必须通过 onValueChange 写回共享状态。
export const Page10: FC = () => {
  const { itemKeys, values, mappings, onValueChange, submit, submitting, canSubmit, module } = useModuleData();
  const { infoArr } = useH5Store();
  const moduleTheme = getModuleTheme(module);
  const labels = new Map(mappings.map((item) => [item.map_key, item.map_value]));
  const textMainColor = useMemo(() => 'text-[#888]', [])

  const pageLabels: Record<string, string[]> = {
    module1: [infoArr[13], infoArr[14], ],
    module2: [infoArr[13], infoArr[14], ],
    module3: [infoArr[13], infoArr[14], ],
    module4: [infoArr[13], infoArr[14], ],
    module5: [infoArr[13], infoArr[14], ],
    module6: [infoArr[13], infoArr[14], ],
  };

  return (
    <main className={clsx('w-screen h-screen  text-lg flex flex-col items-center gap-y-4')}>
      <img src={getModuleBanner(module)} className={moduleBannerStyle[module]}></img>
      <div className={clsx('w-[90vw] pb-4 bg-[#191919] flex flex-col items-center gap-y-1 text-sm')}>
        <div className={clsx("icon-[bi--info-circle-fill] text-4xl py-8", moduleTheme.textClass)}></div>
        <div className="text-[#444] text-lg">{pageLabels[module]?.[0] || ""}</div>
        <div className={textMainColor}>{pageLabels[module]?.[1] || ""}</div>
        <Form layout="vertical" onFinish={submit}>
          {itemKeys.map((itemKey) => (
            <Form.Item key={itemKey} label={<span className={textMainColor}>{ labels.get(itemKey) || itemKey }</span>}>
              <Input
                className="w-[70vw]" size="large"
                value={values[itemKey] ?? ""}
                onChange={(event) => onValueChange(itemKey, event.target.value)}
                placeholder={`请输入${labels.get(itemKey) || itemKey}`}
              />
            </Form.Item>
          ))}

          <Button type="primary" size='large' htmlType="submit" className={clsx('my-2 text-gray-200 border-gray-500',canSubmit ? `${getModuleTheme(module).bgClass} border-none` : '')} loading={submitting} disabled={!canSubmit} block>
            确认
          </Button>
        </Form>
      </div>
    </main>
  );
};
