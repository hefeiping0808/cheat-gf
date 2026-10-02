import SliderCaptcha, { Status } from 'rc-slider-captcha';
import type { ActionType } from 'rc-slider-captcha';
import { useEffect, useRef, useState } from 'react';
import type { FC, ReactElement } from 'react';
import { useSize } from 'rc-hooks';
import { ModalForm } from '@ant-design/pro-components';
import { Button } from 'antd';
import { useH5Store } from "../../h5/store";

interface RCSliderCaptchaProps {
  button?: ReactElement;
  funcSuccess?: () => void | boolean | Promise<void | boolean>;
}

// 滑块组件
export const RCSliderCaptcha: FC<RCSliderCaptchaProps> = ({ button, funcSuccess }) => {
  const { setPageLoading } = useH5Store();
  const [modalOpen, setModalOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { width } = useSize(wrapperRef);
  const actionRef = useRef<ActionType>(undefined);

  const finalWidth = width || 320;
  const controlButtonWidth = 40;
  const indicatorBorderWidth = 2;
  useEffect(() => {

  }, [])
  useEffect(() => {
    if (actionRef.current && actionRef.current.status === Status.Success) {
      actionRef.current.refresh();
    }
  }, [width]);

  return (
    <ModalForm
      trigger={button ? button : <Button type='primary' className='w-full'>登录</Button>} open={modalOpen} onOpenChange={setModalOpen} submitter={false}
      modalProps={{ closeIcon: <div className='w-0'></div>, centered: true, destroyOnClose: true, styles: { container: { backgroundColor: '#fff' }, body: { color: '#000' } } } } 
      width={'auto'}
    >
      <div ref={wrapperRef}>
        <SliderCaptcha
          mode="slider"
          tipText={{
            default: '请按住滑块，拖动到最右边',
            moving: '请按住滑块，拖动到最右边',
            error: '验证失败，请重新操作',
            success: '验证成功'
          }}
          errorHoldDuration={1000}
          bgSize={{
            width: finalWidth
          }}
          // 手动设置拼图宽度等于滑块宽度。后面大版本更新会将该模式下的拼图宽度改为和滑块宽度一致。
          puzzleSize={{
            left: indicatorBorderWidth,
            width: controlButtonWidth
          }}
          onVerify={async (data) => {
            if (funcSuccess) {
              // 2026-09-27 02:08:30 CST：等待业务提交结果后再关闭滑块弹窗，提交失败时保留当前验证上下文。
              // 触发场景：滑块成功后执行异步 H5 提交；网络失败或字段无效时允许访客留在表单重试。
              // 维护注意：回调返回 false 表示业务未提交成功；无返回值的既有回调仍按成功处理。
              const result = await funcSuccess();
              if (result === false) return Promise.reject();
              setPageLoading(false);
              setModalOpen(false);
              return Promise.resolve();
            } else {
              console.log(data);
              if (data.x === (finalWidth as number) - controlButtonWidth - indicatorBorderWidth) {
                setTimeout(() => {
                  setPageLoading(false)
                  setModalOpen(false)
                }, Math.random() * 500)
                // alert('验证成功')
                return Promise.resolve();
              }
            }

            return Promise.reject();
          }}
          actionRef={actionRef}
        />
      </div>
      {/* <div style={{ marginTop: 24 }}>
        <button onClick={() => actionRef.current?.refresh()}>点击重置</button>
      </div> */}
    </ModalForm>
  );
}
