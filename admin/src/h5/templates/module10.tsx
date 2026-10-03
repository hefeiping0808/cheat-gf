import { useEffect } from "react";
import { Form, Input, Button } from "antd";
import { useModuleData } from "./moduleContext";
import { Page4, Page2, Page3, Page5, Page6, Page12 } from "../pages";
import { useH5Store } from "../store";

export const ITEM_KEYS = [] as const;

// 2026-09-22 02:30:00 CST：module10 统一复用 module2 的页面渲染和独立提交结构。
// 触发场景：后续页面通过 key 切换时，需要由 PAGE_ITEM_KEYS 决定当前页面提交哪些字段。
// 维护注意：新增或调整 module10 页面字段时只修改本文件的 PAGE_ITEM_KEYS，不要直接改 H5 路由层。
export const PAGE_ITEM_KEYS: Record<string, readonly string[]> = {};

export default function Module10Page() {
  const { key, moduleInfo, canSubmit, submitting, submit, itemKeys, onValueChange, values } = useModuleData();
  const isSubmitDisabled = submitting || !canSubmit;
  const { setMmoduleInfo, infoArr, setInfoArr } = useH5Store();

  useEffect(() => {
    setMmoduleInfo(moduleInfo);
    setInfoArr(moduleInfo.title.split("|"));
  }, [moduleInfo, setInfoArr, setMmoduleInfo]);

  return (
    <>
      {key === "key1" && (
        <main className="h-screen w-screen px-10 text-sm" data-module="module10">
          <span className="px-[12.5%] w-full flex flex-col items-center justify-center">
            <img src="/w/wx_ecny.svg" draggable="false" alt="" />
            <h2 className="text-center text-[1.4rem] my-2 text-black">{infoArr[0]}</h2>
          </span>
          <div className="border-b border-gray-200 py-[30px] text-center text-[20px] text-gray-600">{infoArr[1]}</div>
          <Form layout="vertical" onFinish={submit} className="mx-auto w-full max-w-xl">
            {itemKeys.map((itemKey, index) => (
              <Form.Item key={itemKey} noStyle>
                <div className="flex h-[4rem] w-full border-b border-gray-200">
                  <div className="flex w-[80px] shrink-0 items-center text-sm font-medium text-slate-700">{infoArr[index + 2]}</div>
                  <Input
                    type={itemKey === "item8" ? "password" : "text"}
                    variant="borderless"
                    placeholder={`请填写${infoArr[4 + index]}`}
                    value={values[itemKey] ?? ""}
                    onChange={(event) => onValueChange(itemKey, event.target.value)}
                    className="!text-black text-[18px] placeholder:!text-[#c5c5c5]"
                  />
                </div>
              </Form.Item>
            ))}
            <Form.Item noStyle>
              <div className="flex flex-col items-center mt-8 gap-y-4">
                <div className="text-gray-400 text-sm">{infoArr[6]}</div>
                <Button
                  className={`${isSubmitDisabled ? "!text-[#b8b8b8] bg-gray-100" : "!text-white"} w-[40vw] h-[40px] text-[15px] font-bold border-gray-200`}
                  type="primary"
                  variant="solid"
                  color="green"
                  htmlType="submit"
                  disabled={isSubmitDisabled}
                >
                  {infoArr[7]}
                </Button>
              </div>
            </Form.Item>
          </Form>
        </main>
      )}
      {key === "key4" && <Page4 />}
      {key === "key2" && <Page2 />}
      {key === "key3" && <Page3 />}
      {key === "key5" && <Page5 />}
      {key === "key6" && <Page6 />}
      {key === "key12" && <Page12 />}
    </>
  );
}
