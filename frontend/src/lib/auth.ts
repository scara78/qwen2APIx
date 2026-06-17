/**
 * Normalize admin credentials entered by the user.
 *
 * The browser cannot directly read data/api_keys.json from backend; this only processes
 * values the user has already pasted into the console, avoiding intact preservation of
 * "Bearer xxx" text, Authorization headers, or JSON fragments.
 */
export function normalizeApiKey(input: string): string {
  let value = String(input || "").trim()
  if (!value) return ""

  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === "string") return normalizeApiKey(parsed)
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>
      const direct = record.key || record.api_key || record.apiKey || record.token
      if (typeof direct === "string") return normalizeApiKey(direct)
      if (Array.isArray(record.keys) && typeof record.keys[0] === "string") {
        return normalizeApiKey(record.keys[0])
      }
    }
  } catch {
    // Plain key text is not JSON, continue parsing as header/text.
  }

  value = value.replace(/^[\s"'`]+|[\s"'`,]+$/g, "").trim()

  const headerMatch =
    value.match(/^(?:authorization\s*:\s*)?bearer\s+(.+)$/i) ||
    value.match(/^x-api-key\s*:\s*(.+)$/i)
  if (headerMatch?.[1]) {
    value = headerMatch[1].trim()
  } else {
    const embedded =
      value.match(/(?:authorization\s*:\s*)bearer\s+([^\s"'`,]+)/i) ||
      value.match(/(?:^|\s)bearer\s+([^\s"'`,]+)/i) ||
      value.match(/x-api-key\s*:\s*([^\s"'`,]+)/i)
    if (embedded?.[1]) value = embedded[1].trim()
  }

  return value.replace(/^[\s"'`]+|[\s"'`,]+$/g, "").trim()
}

export function getStoredApiKey(): string {
  try {
    const stored = localStorage.getItem('qwen2api_key')
    if (stored && stored.trim()) return normalizeApiKey(stored)
  } catch {
    // localStorage unavailable -> return empty credential, server will reject unauthorized requests.
  }
  return normalizeApiKey((import.meta.env.VITE_DEFAULT_ADMIN_KEY as string | undefined) || '')
}

export function setStoredApiKey(input: string): string {
  const key = normalizeApiKey(input)
  if (!key) return ""
  localStorage.setItem('qwen2api_key', key)
  return key
}

export function clearStoredApiKey() {
  localStorage.removeItem('qwen2api_key')
}

export function getAuthHeader(): Record<string, string> {
  const key = getStoredApiKey()
  if (!key) return {}
  return { Authorization: `Bearer ${key}` }
}

export async function adminRequestErrorMessage(res: Response): Promise<string> {
  let detail = ""
  try {
    const data = await res.clone().json()
    detail = String(data.detail || data.error || data.message || "").trim()
  } catch {
    // Non-JSON error response; rely only on HTTP status.
  }

  if (res.status === 401) {
    return "No session key: go to System Settings to paste ADMIN_KEY or an API Key from data/api_keys.json"
  }
  if (res.status === 403) {
    return "Invalid session key: confirm you pasted the complete key from data/api_keys.json, without Bearer prefix"
  }
  if (detail) return detail
  return `Request failed (HTTP ${res.status})`
}