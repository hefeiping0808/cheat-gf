let visitorSound: HTMLAudioElement | null = null;

function getVisitorSound() {
  if (!visitorSound) {
    visitorSound = new Audio("/dingdong.mp3");
    visitorSound.preload = "auto";
  }
  return visitorSound;
}

// 2026-09-10 18:50:00 CST：集中管理访客新增提示音，自动播放失败时由调用方引导用户手动解锁。
// 触发场景：访客 WebSocket 推送新记录，或 Header 右上角播放按钮被点击。
// 维护注意：音频文件固定放在 admin/public/dingdong.mp3；不要在这里输出访客数据或 token。
export async function playVisitorSound() {
  const audio = getVisitorSound();
  audio.currentTime = 0;
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
