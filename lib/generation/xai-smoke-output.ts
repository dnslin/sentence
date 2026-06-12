import { sanitizeErrorMessage } from "./error-sanitizer"

export type SafeSmokeSummaryInput = {
  attemptId: string
  sentenceId: string
  status: "image_generated" | "failed"
  promptSource: "rewrite" | "fallback"
  imageMimeType?: string
  imageByteLength?: number
  imageSha256?: string
  artifactPath?: string
  errorStage?: string
  errorMessage?: string
}

export function buildSafeSmokeSummary(input: SafeSmokeSummaryInput) {
  const lines = [
    "xAI generation smoke summary",
    "XAI_API_KEY is required in the server environment, but its value is never printed.",
    `attempt_id=${input.attemptId}`,
    `sentence_id=${input.sentenceId}`,
    `status=${input.status}`,
    `prompt_source=${input.promptSource}`,
  ]

  if (input.status === "image_generated") {
    lines.push(`image_mime_type=${input.imageMimeType ?? "unknown"}`)
    lines.push(`image_byte_length=${input.imageByteLength ?? 0}`)
    lines.push(`digest_sha256=${input.imageSha256 ?? "unknown"}`)
    if (input.artifactPath) lines.push(`artifact_path=${input.artifactPath}`)
  } else {
    lines.push(`error_stage=${input.errorStage ?? "unknown"}`)
    lines.push(
      `error_message=${sanitizeErrorMessage(
        input.errorMessage ?? "Unknown generation error"
      )}`
    )
  }

  return lines
}
