import type { ReadyCardPngExport } from "./png"

export const readyCardShareTitle = "句画图文卡片"
export const readyCardShareText =
  "分享当前这张随机短句与非署名绘本风插画组成的图文卡片。"

export type ReadyCardSharePayload = {
  file: File
  title: typeof readyCardShareTitle
  text: typeof readyCardShareText
}

export function createReadyCardSharePayload(
  exportedCard: ReadyCardPngExport
): ReadyCardSharePayload {
  return {
    file: new File([exportedCard.blob], exportedCard.fileName, {
      type: "image/png",
    }),
    title: readyCardShareTitle,
    text: readyCardShareText,
  }
}

export function canShareReadyCardFile(payload: ReadyCardSharePayload) {
  if (
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function"
  ) {
    return false
  }

  try {
    return navigator.canShare({ files: [payload.file] })
  } catch {
    return false
  }
}

export function shareReadyCardFile(payload: ReadyCardSharePayload) {
  return navigator.share({
    files: [payload.file],
    title: payload.title,
    text: payload.text,
  })
}
