import { useEffect, useState, useCallback } from "react";
import { Form, Input, Button, Spin } from "antd";
import { useModuleData } from "./moduleContext";
import { Page2, Page3, Page4, Page5, Page6, Page7, Page9, Page10, Page12  } from "../pages";
import { useH5Store } from "../store";
import type { stepType } from "./index";
export const ITEM_KEYS = ["item1", "item5", "item7", "item8"] as const;



// 2026-09-22 02:30:00 CST：module3 统一复用 module2 的页面渲染和独立提交结构。
// 触发场景：后续页面通过 key 切换时，需要由 PAGE_ITEM_KEYS 决定当前页面提交哪些字段。
// 维护注意：新增或调整 module3 页面字段时只修改本文件的 PAGE_ITEM_KEYS，不要直接改 H5 路由层。
export const PAGE_ITEM_KEYS: Record<string, readonly string[]> = {
  key1: ["item1", "item8"],
  key2: ["item2"],
  key3: ["item2"],
  key4: ["item2"],
  key5: ["item5"],
  key6: ["item2"],
  key7: ["item4", "item7"],
  key8: ["item2"],
  key9: ["item2"],
  key10: ["item7", "item4", "item3"],
  key11: ["item2"],
  key12: ["item7", "item4"],
};

export default function Module3Page() {
  const { key, moduleInfo, canSubmit, submitting, submit, itemKeys, onValueChange, values } = useModuleData();
  const isSubmitDisabled = submitting || !canSubmit;
  const { setMmoduleInfo, infoArr, setInfoArr } = useH5Store();
  const [ _step, _setStep ] = useState<stepType>("step1");
  const [_loading, setLoading] = useState(false);

  useEffect(() => {
    setMmoduleInfo(moduleInfo);
    setInfoArr(moduleInfo.title.split("|"));
  }, [moduleInfo, setInfoArr, setMmoduleInfo]);

  useEffect(() => {
    setLoading(false);
  }, []);

  const _toStep = useCallback((s: stepType) => {
    setLoading(true);
    setTimeout(() => {
      _setStep(s);
      setLoading(false);
    }, Math.random() * 200 + 300); // 模拟异步加载
  }, []);

  return (
    <>
      {key === "key1" && (
        <main className="h-screen w-screen text-sm" data-module="module3">
          <Spin spinning={_loading} description="Loading..." size="large" className="h-screen w-screen flex items-center justify-center">
          {/* 步骤一 */}
          {
            _step === "step1" && <div className='h-screen w-screen bg-white text-gray-500 text-center pt-32 text-sm font-serif flex flex-col items-center gap-y-2'>
            <div className="text-blue-500 text-4xl font-bold">{infoArr[16]}</div>
            <div className="text-3xl font-bold text-black">{infoArr[17]}</div>
            <div>{infoArr[18]}</div>
            <div>{infoArr[19]}</div>
            <Button onClick={() => _toStep("step2")} className="bg-blue-500 text-white mt-12 mb-4 text-lg font-bold px-24 py-4 h-[40px] font-serif">{infoArr[20]}</Button>
            <div>{infoArr[21]}</div>

          </div>
          }
          {/* 步骤二 */}
          {
            _step === "step2" && <div className='h-screen w-screen  text-gray-500 text-center p-16 pt-8 text-sm font-serif flex flex-col items-center gap-y-2'>
              <img src="/q/qd_banner.png" draggable="false"></img>
              <Form layout="vertical" onFinish={submit} className="mx-auto w-full max-w-xl">
                {itemKeys.map((key, i) => {
                  return (
                    <Form.Item key={key} noStyle>
                      <div className="flex h-[4rem] w-full border-b border-gray-200">
                        <div className="flex w-[80px] shrink-0 items-center text-lg font-medium text-gray-400">{infoArr[i+22]}</div>
                        <Input
                          type={key=='item8'?"password":"text"}
                          variant="borderless"
                          placeholder={`请填写${infoArr[22+i]}`}
                          value={values[key] ?? ""}
                          onChange={(event) => onValueChange(key, event.target.value)}
                          className=" text-[18px] placeholder:!text-[#c5c5c5] text-[#666] w-full h-full"
                        />
                      </div>
                    </Form.Item>
                  );
                })}
                <Form.Item noStyle>
                  <div className="flex flex-col items-center mt-8 gap-y-4">
                    <Button
                      className={`${isSubmitDisabled ? "!text-[#b8b8b8] bg-gray-100 border-none" : "!text-white"} w-[40vw] h-[40px] text-[15px] font-bold `}
                      type="primary" variant="solid"
                      htmlType="submit"
                      disabled={isSubmitDisabled}
                    >
                      {infoArr[24]}
                    </Button>
                  </div>
                </Form.Item>
              </Form>

          </div>  
          }
          </Spin>
        </main>
      )}
      {key === "key2" && <Page2 />}
      {key === "key3" && <Page3 />}
      {key === "key4" && <Page4 />}
      {key === "key5" && <Page5 />}
      {key === "key6" && <Page6 />}
      {key === "key7" && <Page7 />}
      {key === "key9" && <Page9 />}
      {key === "key10" && <Page10 />}
      {key === "key12" && <Page12 />}
    </>
  );
}
