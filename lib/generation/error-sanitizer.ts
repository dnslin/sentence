function redactKnownSecretValues(message: string) {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) return message

  return message.split(apiKey).join("[redacted]")
}

function redactSecretLikeTokens(message: string) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:xai|sk)-[A-Za-z0-9_-]{8,}\b/gi, "[redacted]")
}

export function sanitizeErrorMessage(message: string) {
  const singleLine = redactSecretLikeTokens(redactKnownSecretValues(message))
    .replace(/\s+/g, " ")
    .trim()
  if (singleLine.length === 0) return "Unknown generation error"

  return singleLine.length > 240 ? singleLine.slice(0, 240).trim() : singleLine
}
