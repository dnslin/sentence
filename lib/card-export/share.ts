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
      // Derive the File MIME from the exported blob so a future export-format
      // change keeps the declared type aligned with the actual bytes.
      type: exportedCard.blob.type || "image/png",
    }),
    title: readyCardShareTitle,
    text: readyCardShareText,
  }
}

// Build the exact ShareData object once so the capability probe and the real
// share() call can never drift. The W3C Web Share spec requires canShare() to
// be called with the same data that will be passed to share(); probing only
// `{ files }` would miss browsers that reject the combined files+title+text
// payload and route them past the download fallback into a failing share().
function buildReadyCardShareData(payload: ReadyCardSharePayload): ShareData {
  return {
    files: [payload.file],
    title: payload.title,
    text: payload.text,
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
    return navigator.canShare(buildReadyCardShareData(payload))
  } catch {
    // A throwing canShare is treated as unsupported, routing to download.
    return false
  }
}

export function shareReadyCardFile(payload: ReadyCardSharePayload) {
  return navigator.share(buildReadyCardShareData(payload))
}

// A user dismissing the native share sheet rejects share() with AbortError.
// That is a deliberate cancellation, not a failure, so it must not surface
// retry-oriented copy. NotAllowedError and other rejections remain real
// failures.
export function isShareCancellation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  )
}
