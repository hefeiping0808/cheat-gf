import { useState } from "react";
import type {FC} from 'react'
import { ModalForm } from "@ant-design/pro-components";
import { useModuleData } from "../templates/moduleContext";
import { Button, Image } from 'antd'
import clsx from "clsx"

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

export const Page4: FC = () => {
  const [modalShow, setModalShow] = useState(false);
  const { module } = useModuleData()

  const ModalCode = () => <>
    <ModalForm
      trigger={<Button className="w-2/5 my-4" type="primary" variant="solid" color={moduleBgMap[module]} size="middle">确认</Button>}
      width={'50vw'} modalProps={{ centered: true, closeIcon: false }} submitter={false} open={modalShow}
      onOpenChange={setModalShow}
    >
      <div className="flex flex-col items-center gap-y-4">
        <a onClick={() => setModalShow(false)}>知道了</a>
      </div>
    </ModalForm>
  </>

  return <div className={clsx('w-screen h-screen  text-lg flex flex-col items-center gap-y-8')}>
    <Image src={moduleImgMap[module]}></Image>
    <div className={clsx('w-[75vw] bg-[#191919] flex flex-col items-center gap-y-4 text-xs')}>
      <div className="text-[#ccc] text-lg mt-4">审核完成</div>
      <ModalCode />
    </div>
  </div>
}
