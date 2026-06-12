export const xaiPromptRewriteModel = "grok-4.3"
export const xaiImageGenerationModel = "grok-imagine-image-quality"
export const xaiImageAspectRatio = "1:1"
export const xaiImageResolution = "1k"

const promptMaxLength = 1200

export class IllustrationPromptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IllustrationPromptError"
  }
}

export function buildIllustrationPromptMessages(sentence: string) {
  return {
    systemPrompt:
      "你为句画生成非署名绘本风插画提示词。只描述画面，不写标题、文字排版、Logo 或 UI。不要提及、模仿或命名任何在世艺术家。保持温柔水彩绘本感、低饱和、留白、小人物、城市或自然意象、细线条、孤独但治愈的氛围。",
    userPrompt: `随机短句：${sentence}\n请把这句随机短句转成一个具体、可直接用于图像生成的单幅插画英文提示词。保留短句的情绪来源，但不要把它描述成用户输入或人工精选文案。`,
  }
}

export function normalizeRewrittenIllustrationPrompt(value: string | null) {
  if (typeof value !== "string") {
    throw new IllustrationPromptError("Rewritten prompt must be a string")
  }

  const normalized = value.trim().replace(/\s+/g, " ")
  if (normalized.length === 0) {
    throw new IllustrationPromptError("Rewritten prompt must not be empty")
  }

  return normalized.length > promptMaxLength
    ? normalized.slice(0, promptMaxLength).trim()
    : normalized
}

export function buildFallbackIllustrationPrompt(sentence: string) {
  return [
    `Create one concrete picture-book illustration inspired by this Chinese random sentence: "${sentence}".`,
    "Use a gentle watercolor picture-book feeling, low saturation, generous whitespace, fine lines, one or two small human figures, and quiet city or nature motifs.",
    "The mood should feel lonely but healing.",
    "Do not include text, typography, logos, UI, posters, or references to any named artist.",
  ].join(" ")
}
