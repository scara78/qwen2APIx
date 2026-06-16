/**
 * Normalizează credențialele de administrare introduse de utilizator.
 *
 * Browserul nu poate citi direct data/api_keys.json din backend; aici se proceseaza
 * doar valorile pe care utilizatorul le-a lipit deja in consola, evitand salvarea
 * intacta a textelor "Bearer xxx", anteturilor Authorization sau fragmentelor JSON.
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
    // Textul key obisnuit nu este JSON, continua parsarea ca header/text.
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
    // localStorage indisponibil -> returneaza credential gol, serverul va respinge cererile neautorizate.
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
    // Raspuns de eroare non-JSON; se bazeaza doar pe starea HTTP.
  }

  if (res.status === 401) {
    return "Fara Key de sesiune: mergeti la Setari sistem pentru a lipi ADMIN_KEY sau un API Key din data/api_keys.json"
  }
  if (res.status === 403) {
    return "Key de sesiune neconforma: confirmati ca ati lipit key-ul complet din data/api_keys.json, fara prefixul Bearer"
  }
  if (detail) return detail
  return `Cerere esuata (HTTP ${res.status})`
}