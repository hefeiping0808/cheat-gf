import { useState } from "react";
import type { FC } from 'react';
import { ModalForm } from "@ant-design/pro-components";
import { useModuleData } from "../templates/moduleContext";
import { Button, Image, Input } from 'antd';
import type { GetProps } from 'antd';
import clsx from "clsx";
import { useH5Store } from '../store';

type OTPProps = GetProps<typeof Input.OTP>;

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



export const Page5: FC = () => {
  const [modalShow, setModalShow] = useState(false);
  const { module } = useModuleData()
  const { infoArr } = useH5Store();

  const onChange: OTPProps['onChange'] = async (text: string) => {
    if (text.length === 6) {

    }
  };
  const onInput: OTPProps['onInput'] = (value: any) => {
    console.log('onInput:', value);
  };
  const sharedProps: OTPProps = {
    onChange,
    onInput,
  };

  const ModalCode = () => <>
    <ModalForm
      trigger={<Button className="w-[85%] my-4" type="primary" variant="solid" color={moduleBgMap[module]} size="large">{infoArr[12]}</Button>}
      width={'70vw'} modalProps={{ centered: true, closeIcon: false }} submitter={false} open={modalShow}
      onOpenChange={setModalShow}
    >
      <div className="flex flex-col items-center gap-y-4">
        <div>{infoArr[13]}</div>
        <Input.OTP length={6} variant="filled" {...sharedProps} type="number" />
        <div onClick={() => setModalShow(false)}>取消</div>
      </div>
    </ModalForm>
  </>


  return <div className={clsx('w-screen h-screen  text-lg flex flex-col items-center gap-y-8')}>
    <Image src={moduleImgMap[module]}></Image>
    <div className={clsx('w-[75vw] bg-[#191919] flex flex-col items-center gap-y-4 text-xs')}>
      <div className={clsx("icon-[bi--info-circle-fill] text-4xl py-8", `text-${moduleBgMap[module]}-500`)}></div>
      <div className="text-[#444] text-lg">{infoArr[14]}</div>
      <div className="text-[#888]">{infoArr[15]}</div>
      <div className="bg-white w-[90%] h-[3.5rem] rounded-md flex flex-col justify-center items-center gap-y-1">
        <span>{infoArr[16]}</span>
        <span className="text-gray-400 text-[0.65rem]">{infoArr[17]}</span>
      </div>
      <ModalCode />
    </div>
  </div>
}
