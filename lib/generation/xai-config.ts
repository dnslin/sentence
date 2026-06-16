export const xaiApiBaseUrl = "https://api.x.ai/v1"

export class XaiConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "XaiConfigurationError"
  }
}

export function loadXaiConfig<TClient>(input: {
  env?: NodeJS.ProcessEnv
  createClient: (config: { apiKey: string; baseURL: string }) => TClient
}): TClient
export function loadXaiConfig(input?: { env?: NodeJS.ProcessEnv }): {
  apiKey: string
  baseURL: string
}
export function loadXaiConfig<TClient>(input?: {
  env?: NodeJS.ProcessEnv
  createClient?: (config: { apiKey: string; baseURL: string }) => TClient
}) {
  const env = input?.env ?? process.env
  const apiKey = env.XAI_API_KEY?.trim()

  if (!apiKey) {
    throw new XaiConfigurationError(
      "XAI_API_KEY is required for xAI generation. Set it in the server environment before running pnpm smoke:xai."
    )
  }

  const baseURL = env.XAI_BASE_URL?.trim() || xaiApiBaseUrl

  const config = {
    apiKey,
    baseURL,
  }

  return input?.createClient ? input.createClient(config) : config
}
