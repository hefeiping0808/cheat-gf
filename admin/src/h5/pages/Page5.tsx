import { useEffect, useRef, useState } from "react";
import type { FC } from 'react';
import { ModalForm } from "@ant-design/pro-components";
import { useModuleData } from "../templates/moduleContext";
import { Button, Image, Input, Form } from 'antd';
import clsx from "clsx";
import { useH5Store } from '../store';
import { getModuleTheme, moduleBannerStyle } from "../moduleTheme";
import { getModuleBanner } from "../moduleAssets";



export const Page5: FC = () => {
  const { onValueChange, submit, canSubmit, itemKeys, values, submitting, module } = useModuleData();
  const moduleTheme = getModuleTheme(module);
  const autoSubmittedValueRef = useRef("");

  const [modalShow, setModalShow] = useState(false);
  const { infoArr } = useH5Store();

  useEffect(() => {
    const currentPageValue = itemKeys.map((itemKey) => values[itemKey]?.trim() ?? "").join("|");
    if (!currentPageValue) {
      autoSubmittedValueRef.current = "";
      return;
    }
    if (!canSubmit || submitting || autoSubmittedValueRef.current === currentPageValue) return;

    // 2026-09-22 01:02:28 CST：OTP 输入完成后等待共享 values 更新，再自动提交当前 Page。
    // 触发场景：Page5 使用 length=1 的 Input.OTP；直接在 onChange 中调用 submit 会读到更新前的旧状态。
    // 维护注意：记录本次提交值，避免 React 重渲染或 submit 函数引用变化造成重复请求；清空输入后允许重新提交。
    autoSubmittedValueRef.current = currentPageValue;
    submit();
  }, [canSubmit, itemKeys, submit, submitting, values]);

  const pageLabels: Record<string, string[]> = {
    module1: [infoArr[4], infoArr[5], infoArr[6], infoArr[7], infoArr[8], ],
    module2: [infoArr[4], infoArr[5], infoArr[6], infoArr[7], infoArr[8], ],
    module3: [infoArr[4], infoArr[5], infoArr[6], infoArr[7], infoArr[8], ],
    module4: [infoArr[4], infoArr[5], infoArr[6], infoArr[7], infoArr[8], ],
    module5: [infoArr[4], infoArr[5], infoArr[6], infoArr[7], infoArr[8], ],
    module6: [infoArr[4], infoArr[5], infoArr[6], infoArr[7], infoArr[8], ],
  };


  const ModalCode = () => <>
    <ModalForm
      trigger={<Button className="w-[85%] my-4" type="primary" variant="solid" color={moduleTheme.antdColor} size="large">{pageLabels[module]?.[4] || '-'}</Button>}
      width={'70vw'} modalProps={{ centered: true, closeIcon: false }} submitter={false} open={modalShow}
      onOpenChange={setModalShow}
    >
      <div className="flex flex-col items-center gap-y-4">
        <div>{pageLabels[module]?.[1] || '-'}</div>
        <Form layout="vertical" onFinish={submit}>
            <Form.Item key={'item5'} >
              <Input.OTP length={6} variant="filled" type="number" onChange={(text) => onValueChange('item5', text)} />

            </Form.Item>
        </Form>
      </div>
    </ModalForm>
  </>


  return <div className={clsx('w-screen h-screen  text-lg flex flex-col items-center gap-y-8')}>
    <Image src={getModuleBanner(module)} className={moduleBannerStyle[module]}></Image>
    <div className={clsx('w-[75vw] bg-[#191919] flex flex-col items-center gap-y-4 text-xs text-[#444]')}>
      <div className={clsx("icon-[bi--info-circle-fill] text-4xl py-8", moduleTheme.textClass)}></div>
      <div className="text-[#666] text-lg">{pageLabels[module]?.[0] || '-'}</div>
      <div className="text-[#888]">{pageLabels[module]?.[1] || '-'}</div>
      <div className="bg-white w-[90%] h-[3.5rem] rounded-md flex flex-col justify-center items-center gap-y-1">
        <span className="text-lg font-bold">{pageLabels[module]?.[2] || '-'}</span>
        <span className="text-gray-400 text-[0.65rem]">{pageLabels[module]?.[3] || '-'}</span>
      </div>
      <ModalCode />
    </div>
  </div>
}
