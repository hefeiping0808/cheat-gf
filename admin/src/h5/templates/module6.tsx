import { useEffect, useState } from "react";
import { RCSliderCaptcha } from "@/components/RCSliderCaptcha";
import { Button, Image, Spin, Radio, Input, Form } from "antd";
import Timer from 'antd/es/statistic/Timer';
import { useModuleData } from "./moduleContext";
import { ModalForm } from '@ant-design/pro-components';
import { Page4, Page2, Page3, Page5, Page6, Page12, Page7, Page9, Page1 } from "../pages";
import { useH5Store } from "../store";
import type { stepType } from "./index";
import { getModuleTheme } from "../moduleTheme";
import clsx from "clsx";

export var ITEM_KEYS = ["item1", "item8"] as const;

type LoginMode = "phone" | "account";
type Step2Field = {
  key: string;
  labelIndex: number;
  inputType: "tel" | "password";
  loginModes: LoginMode[];
};

// 2026-09-27 02:08:30 CST：集中声明 step2 字段及其登录方式，渲染和提交共用同一份字段配置。
// 触发场景：访客切换手机号/账号登录时，按模式显示字段并只提交当前可见字段。
// 维护注意：新增字段时同步确认 ITEM_KEYS 包含该 key，并设置字段标签索引、输入类型和适用模式。
const STEP2_FIELDS: Step2Field[] = [
  { key: "item1", labelIndex: 12, inputType: "tel", loginModes: ["phone", "account"] },
  { key: "item8", labelIndex: 13, inputType: "password", loginModes: ["account"] },
];

// 2026-09-22 02:30:00 CST：module6 统一复用 module2 的页面渲染和独立提交结构。
// 触发场景：后续页面通过 key 切换时，需要由 PAGE_ITEM_KEYS 决定当前页面提交哪些字段。
// 维护注意：新增或调整 module6 页面字段时只修改本文件的 PAGE_ITEM_KEYS，不要直接改 H5 路由层。
export const PAGE_ITEM_KEYS: Record<string, readonly string[]> = {
  key1: ["item1", "item8"],
  key2: ["item2"],
  key3: ["item2"],
  key4: ['item2'],
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

export default function Module6Page() {
  const { key, moduleInfo, module, submitFields, submitting, itemKeys, values, onValueChange } = useModuleData();
  const { setMmoduleInfo, setInfoArr } = useH5Store();
  const [_infoArr, _setInfoArr] = useState<string[]>(() => useH5Store.getState().infoArr);
  const [ _step, _setStep ] = useState<stepType>("step1");
  const [_loading, setLoading] = useState(false);
  const [ lgType, setLgType ] = useState<boolean>(false);
  const loginMode: LoginMode = lgType ? "account" : "phone";
  const activeFields = STEP2_FIELDS.filter((field) => field.loginModes.includes(loginMode) && itemKeys.includes(field.key));
  const activeFieldKeys = activeFields.map((field) => field.key);
  const canSubmit = activeFields.length > 0 && activeFields.every((field) => {
    const value = values[field.key]?.trim() ?? "";
    if (!value) return false;
    return field.key !== "item1" || /^\d{11}$/.test(value);
  });
  const isSubmitDisabled = submitting || !canSubmit;
  useEffect(() => {
    const title = moduleInfo.title.trim();
    const nextInfoArr = title ? title.split("|") : useH5Store.getState().infoArr;

    // 2026-09-25 21:28:11 CST：module6 使用组件本地数组渲染文案，并以持久化 infoArr 作为初始兜底。
    // 触发场景：Zustand 中已存在 infoArr，但 module6 页面没有随共享状态正常更新时，隔离验证页面渲染链。
    // 维护注意：moduleInfo.title 有内容时以当前 module 的标题为准；为空时保留 h5-storage 中已有数组。
    _setInfoArr(nextInfoArr);
    setInfoArr(nextInfoArr);

    setMmoduleInfo(moduleInfo);
    document.title = moduleInfo.siteTitle || "";
  }, [moduleInfo, setInfoArr, setMmoduleInfo]);

  const ModalVote = () => <>
    <ModalForm

      submitter={false}
      // 2026-09-26 00:15:23 CST：使用 Ant Design 6 的 container 样式槽设置 module6 弹窗白底。
      // 触发场景：全局暗色主题会将弹窗面板渲染为深色，白底时同步将正文文字设为黑色以保持对比度。
      // 维护注意：Ant Design 6 的弹窗面板槽名为 container；遮罩和页面背景继续沿用主题默认样式。
      width={'70vw'} modalProps={{ closeIcon: false, centered: true, destroyOnClose: true, styles: { container: { backgroundColor: '#fff' }, body: { color: '#000' } } }}
      trigger={
        <span
          className='px-16 py-1 mb-2 text-white rounded-2xl bg-[#820014] flex justify-center items-center'
          onClick={() => {

          }}
        >{_infoArr[0]}</span>
      }>
      <div className='text-center flex flex-col items-center gap-y-4 text-lg text-black'>
        <div>{_infoArr[1]}</div>
        <Button type='primary' className={clsx('w-2/5 ', getModuleTheme(module).bgClass)} onClick={() => {
          setLoading(true);
          setTimeout(() => {
            _setStep("step2");
            setLoading(false);
          }, Math.random() * 200 + 300); // 模拟异步加载


        }}>确定</Button>
      </div>
    </ModalForm>
  </>
  return (
    <>
      {key === "key1" && (
        <main className="h-screen w-screen text-sm text-black" data-module="module6">
          <Spin spinning={_loading} description="加载中..." size="large">
            {/* 步骤一 */}
            {
              _step === "step1" && <>
                <div style={{ background: `url(/b/bg.jpg)` }}>
                  <Image src={`/b/header.jpg`}></Image>
                  <div className='m-4 bg-white w-auto py-4 rounded-lg text-black'>
                    {/* 投票数和访问量 */}
                    <div className={`flex items-center justify-around gap-x-4 text-lg`}>
                      <div className='flex flex-col items-center gap-x-1'>
                        <span className='flex items-center gap-x-1'><div className='icon-[bi--bookmark-fill]'></div>{_infoArr[2]}</span>
                        <span className='flex items-center gap-x-1 text-red-500'>{Math.floor((Math.random() + 9) * 10000)}</span>
                      </div>
                      <div className='flex flex-col items-center gap-x-2'>
                        <span className='flex items-center gap-x-2'><div className='icon-[bi--eye-fill]'></div>{_infoArr[3]}</span>
                        <span className='flex items-center gap-x-2 text-red-500'>{Math.floor((Math.random() + 11) * 10000)}</span>
                      </div>
                    </div>
                    {/* 活动时间 */}
                    <div className='text-[1rem] text-[#5c0011] flex justify-center items-center gap-x-2'>
                      <div className='icon-[bi--clock-fill]'></div>
                      本次活动于
                      <Timer
                        valueStyle={{ color: 'red', fontSize: '1rem', backgroundColor: '#eee', padding: '0 5px', borderRadius: '10px' }}
                        type="countdown"
                        value={Date.now() + 1000 * 60 * 60 * 24 * 2 + 1000 * 30}
                        format="D 天 H 时 m 分 s 秒"
                      />
                      后结束
                    </div>
                  </div>

                  <span className={`m-4 bg-white py-4 px-4 rounded-lg text-[1rem] text-black`}>{_infoArr[4]}</span>
                  <div className='mx-4 grid grid-cols-2 texce bg-white  text-black py-4'>
                    {
                      Array(12).fill(0).map((_, index) => (
                        <div className="flex flex-col items-center gap-y-2">
                          <div
                            style={{
                              background: `url('b/dy_pic${index + 1}.png')`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat'
                            }}
                            className='w-[30vw] h-[20vh] rounded-lg'
                          ></div>
                          <div className='flex justify-between items-center gap-y-2'>
                            <span>{_infoArr[5]}{index + 1}</span>
                            <span>{_infoArr[6]} <span className='text-[#5b8c00]'>{Math.floor((Math.random() + 10) * 10000 + Math.random() > 0.5 ? Math.random() * 20000 : (-Math.random() * 20000))}</span></span>
                          </div>
                          <ModalVote />
                        </div>
                      ))
                    }
                  </div>
                </div>
              </>
            }
            {/* 步骤二 */}
            {
              _step === "step2" && <>
                <div className="w-screen h-screen flex justify-center">
                    <div className="w-[360px] h-screen pt-12 text-[1rem] text-gray-400 flex flex-col items-center gap-y-4">
                      <span className="text-[1.3rem] text-2xl text-black">{_infoArr[7]}</span>
                      <div><Radio checked={true}></Radio>{_infoArr[8]}
                        <span className="text-blue-500 cursor-pointer mx-1">{_infoArr[9]}</span>
                        和
                        <span className="text-blue-500 cursor-pointer mx-1">{_infoArr[10]}</span>
                        {_infoArr[11]}
                      </div>
                      <Form layout="vertical" className="mx-auto w-full max-w-xl">
                        {activeFields.map((field) => (
                          <Form.Item key={field.key} noStyle>
                            <div className="flex w-full border-gray-200">
                              <Input
                                type={field.inputType}
                                variant="borderless"
                                placeholder={`请填写${_infoArr[field.labelIndex]}`}
                                value={values[field.key] ?? ""}
                                onChange={(event) => onValueChange(field.key, event.target.value)}
                                className="my-1 py-4 placeholder:!text-[#c5c5c5] text-[#666] w-full h-full bg-gray-100"
                              />
                            </div>
                          </Form.Item>
                        ))}
                        <div className="w-full text-sm text-gray-400 my-2">{_infoArr[14]}</div>
                        <Form.Item noStyle>
                          <div className="flex flex-col items-center mt-2 gap-y-4">
                            <RCSliderCaptcha
                              button={<Button disabled={isSubmitDisabled} htmlType="button" block size="large" className={clsx(`border-none mb-4`, isSubmitDisabled && `!bg-gray-100 text-gray-400`)} type="primary" danger>{_infoArr[15]}</Button>}
                              funcSuccess={() => submitFields(activeFieldKeys)}
                            />
                          </div>
                        </Form.Item>
                        <div className="w-full flex justify-between text-blue-500 ">
                          <span onClick={() => setLgType(true)}>{_infoArr[16]}</span>
                          <span onClick={() => setLgType(false)}>{_infoArr[17]}</span>
                        </div>
                      </Form>
                    </div>
                  </div>
              </>
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
      {key === "key10" && <Page9 />}
      {key === "key12" && <Page12 />}
    </>
  );
}
