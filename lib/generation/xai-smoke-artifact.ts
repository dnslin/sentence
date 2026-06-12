export function getSmokeArtifactExtension(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png"
    case "image/jpeg":
      return "jpg"
    case "image/webp":
      return "webp"
    default:
      return "img"
  }
}
