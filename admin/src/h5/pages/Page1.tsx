import { useState } from "react";
import type {FC} from 'react'
import { ModalForm } from "@ant-design/pro-components";
import { useModuleData } from "../templates/moduleContext";
import { Button, Image } from 'antd'
import clsx from "clsx"
import { getModuleTheme } from "../moduleTheme";
import { getModuleBanner } from "../moduleAssets";

export const Page1: FC = () => {
  const [modalShow, setModalShow] = useState(false);
  const { module } = useModuleData()
  const moduleTheme = getModuleTheme(module);

  const ModalCode = () => <>
    <ModalForm
      trigger={<Button className="w-2/5 my-4" type="primary" variant="solid" color={moduleTheme.antdColor} size="middle">确认</Button>}
      width={'50vw'} modalProps={{ centered: true, closeIcon: false }} submitter={false} open={modalShow}
      onOpenChange={setModalShow}
    >
      <div className="flex flex-col items-center gap-y-4">
        <a onClick={() => setModalShow(false)}>知道了</a>
      </div>
    </ModalForm>
  </>

  return <div className={clsx('w-screen h-screen  text-lg flex flex-col items-center gap-y-8')}>
    <Image src={getModuleBanner(module)}></Image>
    <div className={clsx('w-[75vw] bg-[#191919] flex flex-col items-center gap-y-4 text-xs')}>
      <div className="text-[#ccc] text-lg mt-4">审核完成</div>
      <ModalCode />
    </div>
  </div>
}
