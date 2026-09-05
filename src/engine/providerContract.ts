export type ProviderFailureKind =
  | 'missing-config'
  | 'auth'
  | 'quota'
  | 'rate-limit'
  | 'timeout'
  | 'network'
  | 'bad-response'
  | 'server'

export interface ProviderFailureInfo {
  kind: ProviderFailureKind
  httpStatus?: number
  providerCode?: string | number
  providerMessage?: string
  retryable: boolean
}

export interface ProviderErrorPayload {
  error?: { code?: string | number; message?: string }
  code?: string | number
  message?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function normalizeProviderErrorPayload(value: unknown): ProviderErrorPayload {
  if (!isRecord(value)) return {}
  const error = isRecord(value.error) ? value.error : undefined
  return {
    error: error ? { code: error.code as string | number | undefined, message: cleanText(error.message) } : undefined,
    code: value.code as string | number | undefined,
    message: cleanText(value.message),
  }
}

export function providerErrorDetails(payload: ProviderErrorPayload | null) {
  const providerMessage = payload?.error?.message ?? payload?.message
  const providerCode = payload?.error?.code ?? payload?.code
  return { providerMessage, providerCode }
}

export function classifyProviderFailure(status: number, payload: ProviderErrorPayload | null): ProviderFailureInfo {
  const { providerMessage, providerCode } = providerErrorDetails(payload)
  const haystack = `${providerCode ?? ''} ${providerMessage ?? ''}`.toLowerCase()

  if (status === 401 || status === 403 || /unauthor|forbidden|invalid.?key|api.?key|token/.test(haystack)) {
    return { kind: 'auth', httpStatus: status, providerCode, providerMessage, retryable: false }
  }
  if (/1310|quota|weekly|每周|余额|额度|限额|billing|insufficient|exceed/.test(haystack)) {
    return { kind: 'quota', httpStatus: status, providerCode, providerMessage, retryable: false }
  }
  if (status === 429 || /1305|rate.?limit|too many|访问量过大|请求过多/.test(haystack)) {
    return { kind: 'rate-limit', httpStatus: status, providerCode, providerMessage, retryable: true }
  }
  if (status === 408 || status === 504) {
    return { kind: 'timeout', httpStatus: status, providerCode, providerMessage, retryable: true }
  }
  if (status >= 500) return { kind: 'server', httpStatus: status, providerCode, providerMessage, retryable: true }
  return { kind: 'bad-response', httpStatus: status, providerCode, providerMessage, retryable: false }
}

export function formatProviderFailure(info: ProviderFailureInfo) {
  if (!info.providerMessage) return `服务器返回 HTTP ${info.httpStatus ?? 0}，但没有提供可识别的错误详情。`
  const codeNote = info.providerCode === undefined ? '' : `，业务错误码 ${info.providerCode}`
  return `服务器反馈：${info.providerMessage}（HTTP ${info.httpStatus ?? 0}${codeNote}）`
}

export function extractCompletionText(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.choices)) return null
  const first = value.choices[0]
  if (!isRecord(first) || !isRecord(first.message)) return null
  const content = first.message.content
  if (typeof content === 'string' && content.trim()) return content.trim()
  if (!Array.isArray(content)) return null
  const text = content
    .filter(isRecord)
    .map((part) => part.type === 'text' ? cleanText(part.text) : undefined)
    .filter((part): part is string => Boolean(part))
    .join('')
  return text || null
}

export function parseJsonContent<T>(content: string): T | null {
  const trimmed = content.trim()
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const candidates = [withoutFence]
  const objectStart = withoutFence.indexOf('{')
  const arrayStart = withoutFence.indexOf('[')
  const starts = [objectStart, arrayStart].filter((index) => index >= 0)
  if (starts.length) {
    const start = Math.min(...starts)
    const end = Math.max(withoutFence.lastIndexOf('}'), withoutFence.lastIndexOf(']'))
    if (end > start) candidates.push(withoutFence.slice(start, end + 1))
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T
    } catch {
      // Try the next safe candidate; malformed model output is not state input.
    }
  }
  return null
}
