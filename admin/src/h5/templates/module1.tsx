import { useEffect } from "react";
import { Form, Input, Button } from "antd";
import { useModuleData } from "./moduleContext";
import { Page2, Page3, Page4, Page5, Page6, Page7, Page9, Page10, Page12  } from "../pages";
import { useH5Store } from '../store';


// 2026-09-21 15:20:00 CST：为 module1 增加按 key 配置页面字段的示例。
// 触发场景：key1 和 key6 属于同一个 module，但分别提交不同的 item；后续新增页面只需在这里补充 key 与字段映射。
// 维护注意：每个页面提交时会自动携带 Zustand 中的 item1，因此其他页面可以不重复渲染 item1 输入框。
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

export const ITEM_KEYS = ["item1", "item2", "item8"] as const;

export default function Module1Page() {
  const { setMmoduleInfo, infoArr, setInfoArr } = useH5Store()
  const { key } = useModuleData();
  const moduleData = useModuleData();
  const isSubmitDisabled = moduleData.submitting || !moduleData.canSubmit;
  console.log(moduleData)

  useEffect(() => {
    setMmoduleInfo(moduleData.moduleInfo)
    setInfoArr(moduleData.moduleInfo.title.split('|') || ''); // 获取信息列表
  }, [moduleData.moduleInfo.siteTitle, key]);

  return <>
    {
      key === 'key1'  &&  <main className="h-screen w-screen px-10 text-sm" data-module="module1">
        <div className="border-b border-gray-200 py-[30px] text-center text-[20px] text-gray-600">{infoArr[16]}</div>
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
                  <div className="flex w-[80px] shrink-0 items-center text-sm font-medium text-slate-700">{infoArr[i+18]}</div>
                  <Input
                    type={key=='item8'?"password":"text"}
                    variant="borderless"
                    placeholder={`请填写${infoArr[20+i]}`}
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
              <div className="text-gray-400 text-sm">{infoArr[22]}</div>
              <Button
                className={`${isSubmitDisabled ? "!text-[#b8b8b8] bg-gray-100" : "!text-white"} w-[40vw] h-[40px] text-[15px] font-bold border-gray-200`}
                type="primary" variant="solid" color="green"
                htmlType="submit"
                disabled={isSubmitDisabled}
              >
                {infoArr[23]}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </main>
    }
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
}
