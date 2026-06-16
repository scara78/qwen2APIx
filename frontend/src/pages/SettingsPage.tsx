import { useCallback, useEffect, useState } from "react"
import { Settings2, RefreshCw, KeyRound, ServerCrash, Code, Activity, Save } from "lucide-react"
import { Button } from "../components/ui/button"
import { toast } from "sonner"
import { adminRequestErrorMessage, clearStoredApiKey, getAuthHeader, getStoredApiKey, setStoredApiKey } from "../lib/auth"
import { API_BASE } from "../lib/api"
import {
  capabilityBadges,
  fetchModelOptions,
  formatModeLabel,
  formatModelName,
  groupModelOptions,
  type ModelOption,
} from "../lib/models"

type ModelAliases = Record<string, string>

interface AdminSettings {
  version?: string
  max_inflight_per_account?: number
  global_max_inflight?: number
  chat_id_pool_target?: number
  chat_id_pool_ttl_seconds?: number
  keepalive_url?: string
  keepalive_interval?: number
  keepalive_env_locked?: string[]
  keepalive_running?: boolean
  model_aliases?: ModelAliases
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [sessionKey, setSessionKey] = useState(() => getStoredApiKey())
  const [maxInflight, setMaxInflight] = useState(4)
  const [globalMaxInflight, setGlobalMaxInflight] = useState(0)
  const [poolTarget, setPoolTarget] = useState(0)
  const [poolTtlMin, setPoolTtlMin] = useState(10)
  const [keepaliveUrl, setKeepaliveUrl] = useState("")
  const [keepaliveInterval, setKeepaliveInterval] = useState(60)
  const [keepaliveEnvLocked, setKeepaliveEnvLocked] = useState<string[]>([])
  const [keepaliveRunning, setKeepaliveRunning] = useState(false)
  const [modelAliases, setModelAliases] = useState("")
  const [models, setModels] = useState<ModelOption[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)

  const fetchSettings = useCallback(() => {
    if (!getStoredApiKey()) {
      toast.error("Lipiți mai întâi ADMIN_KEY sau un API Key existent")
      return
    }
    fetch(`${API_BASE}/api/admin/settings`, { headers: getAuthHeader() })
      .then(async res => {
        if(!res.ok) throw new Error(await adminRequestErrorMessage(res))
        return res.json()
      })
      .then(data => {
        setSettings(data)
        setMaxInflight(data.max_inflight_per_account || 4)
        setGlobalMaxInflight(data.global_max_inflight || 0)
        setPoolTarget(data.chat_id_pool_target ?? 0)
        setPoolTtlMin(Math.round((data.chat_id_pool_ttl_seconds || 600) / 60))
        setKeepaliveUrl(data.keepalive_url || "")
        setKeepaliveInterval(data.keepalive_interval || 60)
        setKeepaliveEnvLocked(data.keepalive_env_locked || [])
        setKeepaliveRunning(Boolean(data.keepalive_running))
        setModelAliases(JSON.stringify(data.model_aliases || {}, null, 2))
      })
      .catch(err => toast.error(err instanceof Error ? err.message : "Obținerea configurației a eșuat, confirmați cheia de sesiune curentă"))
  }, [])

  const loadModels = useCallback(() => {
    fetchModelOptions()
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false))
  }, [])

  const fetchModels = useCallback(() => {
    setModelsLoading(true)
    loadModels()
  }, [loadModels])

  useEffect(() => {
    fetchSettings()
    fetchModels()
  }, [fetchSettings, fetchModels])

  const handleSaveSessionKey = () => {
    const key = setStoredApiKey(sessionKey)
    if (!key) {
      toast.error("Introduceți Key-ul")
      return
    }
    setSessionKey(key)
    toast.success("Key normalizat și salvat local în browser, se reîmprospătează datele...")
    fetchSettings()
  }

  const handleClearSessionKey = () => {
    clearStoredApiKey()
    setSessionKey("")
    toast.success("Key șters")
  }

  const handleSaveConcurrency = () => {
    fetch(`${API_BASE}/api/admin/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({
        max_inflight_per_account: Number(maxInflight),
        global_max_inflight: Number(globalMaxInflight),
      })
    }).then(res => {
      if(res.ok) { toast.success("Configurație concurență salvată (activă imediat la execuție)"); fetchSettings(); }
      else toast.error("Salvare eșuată")
    })
  }

  const handleSavePool = () => {
    fetch(`${API_BASE}/api/admin/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({
        chat_id_pool_target: Number(poolTarget),
        chat_id_pool_ttl_seconds: Number(poolTtlMin) * 60,
      })
    }).then(res => {
      if(res.ok) { toast.success("Configurație pool preîncălzit salvată (activă imediat la execuție)"); fetchSettings(); }
      else toast.error("Salvare eșuată")
    })
  }

  const handleUseCurrentKeepaliveUrl = () => {
    setKeepaliveUrl(`${baseUrl.replace(/\/$/, "")}/keepalive`)
  }

  const handleSaveKeepalive = () => {
    const interval = Number(keepaliveInterval)
    if (!Number.isFinite(interval) || interval < 5 || interval > 86400) {
      toast.error("Intervalul de menținere activă trebuie să fie între 5 și 86400 secunde")
      return
    }

    fetch(`${API_BASE}/api/admin/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({
        keepalive_url: keepaliveUrl.trim(),
        keepalive_interval: interval,
      })
    }).then(async res => {
      const data = await res.json().catch(() => ({}))
      if(res.ok) { toast.success("Configurație menținere activă salvată (activă imediat la execuție)"); fetchSettings(); }
      else toast.error(data.detail || "Salvare eșuată")
    }).catch(() => toast.error("Salvare eșuată"))
  }

  const handleSaveAliases = () => {
    try {
      const parsed = JSON.parse(modelAliases)
      fetch(`${API_BASE}/api/admin/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ model_aliases: parsed })
      }).then(res => {
        if(res.ok) { toast.success("Reguli mapare model actualizate"); fetchSettings(); }
        else toast.error("Salvare eșuată")
      })
    } catch {
      toast.error("Eroare format JSON, verificați sintaxa")
    }
  }

  const baseUrl = API_BASE || `http://${window.location.hostname}:7860`
  const modelGroups = groupModelOptions(models)

  const curlExample = `# Conversație în flux OpenAI
  curl ${baseUrl}/v1/chat/completions \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer YOUR_API_KEY" \\
    -d '{
      "model": "qwen3.6-plus",
      "messages": [{"role": "user", "content": "Salut"}],
      "stream": true
    }'

  # Anthropic / Claude Code
  curl ${baseUrl}/anthropic/v1/messages \\
    -H "Content-Type: application/json" \\
    -H "x-api-key: YOUR_API_KEY" \\
    -H "anthropic-version: 2023-06-01" \\
    -d '{
      "model": "claude-sonnet-4-6",
      "max_tokens": 1024,
      "messages": [{"role": "user", "content": "Salut"}]
    }'

  # Gemini
  curl ${baseUrl}/v1beta/models/qwen3.6-plus:generateContent \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer YOUR_API_KEY" \\
    -d '{
      "contents": [{"parts": [{"text": "Salut"}]}]
    }'

  # Imagini
  curl ${baseUrl}/v1/images/generations \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer YOUR_API_KEY" \\
    -d '{
      "model": "qwen3.6-plus-image",
      "prompt": "O pisică cyberpunk cu lumini neon, ultra-realist",
      "n": 1,
      "size": "1328x1328",
      "response_format": "url"
    }'

  # Video
  curl ${baseUrl}/v1/videos/generations \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer YOUR_API_KEY" \\
    -d '{
      "model": "qwen3.6-plus-video",
      "prompt": "Generare video cu valuri de ocean în slow-motion.",
      "duration": 5,
      "size": "1664x928",
      "ratio": "16:9",
      "response_format": "url"
    }'`

  return (
    <div className="w-full min-w-0 overflow-x-hidden space-y-6">
      <section className="admin-hero p-6">
        <div className="relative z-10 flex justify-between items-end flex-wrap gap-4">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">Control Plane</div>
            <h2 className="mt-2 text-4xl font-black tracking-tight">Setări sistem</h2>
            <p className="mt-2 text-muted-foreground">Gestionare autentificare consolă, catalog modele, parametri concurență, pool preîncălzire Chat_ID și exemple de apelare.</p>
          </div>
        <Button variant="outline" onClick={() => {fetchSettings(); fetchModels(); toast.success("Configurație reîmprospătată")}}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reîmprospătare configurație
        </Button>
        </div>
      </section>

      <div className="grid gap-6 min-w-0">
        {/* Session Key */}
        <div className="admin-card min-w-0 overflow-hidden">
          <div className="admin-card-header flex flex-col space-y-1.5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h3 className="font-semibold leading-none tracking-tight">Key sesiune curent</h3>
            </div>
            <p className="text-sm text-muted-foreground">Browserul nu citește automat data/api_keys.json din backend; lipiți ADMIN_KEY sau un API Key existent din acel fișier aici, consola îl va salva local în browserul curent.</p>
          </div>
          <div className="p-6">
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="password"
                value={sessionKey}
                onChange={e => setSessionKey(e.target.value)}
                placeholder="Lipiți ADMIN_KEY sau sk-qwen-..."
                className="admin-input flex h-10 flex-1 min-w-[200px] px-3 py-2 text-sm"
              />
              <Button onClick={handleSaveSessionKey}>Salvare</Button>
              <Button variant="ghost" onClick={handleClearSessionKey}>Ștergere</Button>
            </div>
          </div>
        </div>

        {/* Connection Info */}
        <div className="admin-card min-w-0 overflow-hidden">
          <div className="admin-card-header flex flex-col space-y-1.5">
            <div className="flex items-center gap-2">
              <ServerCrash className="h-5 w-5 text-primary" />
              <h3 className="font-semibold leading-none tracking-tight">Informații conexiune</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-1 min-w-0">
              <label className="text-sm font-medium">Adresă de bază API (Base URL)</label>
              <input type="text" readOnly value={baseUrl} className="admin-input flex h-10 w-full px-3 py-2 text-sm font-mono text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Model Catalog */}
        <div className="admin-card min-w-0 overflow-hidden">
          <div className="admin-card-header flex flex-col space-y-1.5">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold leading-none tracking-tight">Nume modele / Catalog modele</h3>
            </div>
            <p className="text-sm text-muted-foreground">Citire modele disponibile din /v1/models, afișate grupate pe familie. De ex. qwen3.6 va fi grupat împreună.</p>
          </div>
          <div className="p-6 space-y-3">
            {modelsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" /> Se citește lista de modele...
              </div>
            ) : modelGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                Nu există date despre modele. Confirmați că Key-ul de sesiune are permisiuni pentru /v1/models.
              </div>
            ) : (
              modelGroups.map((group, index) => (
                <details key={group.family} open={index === 0} className="rounded-lg border bg-background/60">
                  <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">
                    {group.family}
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      {group.models.length} modele
                    </span>
                  </summary>
                  <div className="border-t divide-y">
                    {group.models.map(option => {
                      const badges = capabilityBadges(option)
                      return (
                        <div key={option.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.4fr_1fr_0.7fr_1fr] md:items-center">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{formatModelName(option)}</div>
                            <div className="truncate font-mono text-xs text-muted-foreground">{option.id}</div>
                          </div>
                          <div className="min-w-0 font-mono text-xs text-muted-foreground">
                            bază: {option.base_model || option.id}
                          </div>
                          <div>
                            <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs">
                              {formatModeLabel(option.mode)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {badges.length ? badges.map(label => (
                              <span key={label} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                {label}
                              </span>
                            )) : (
                              <span className="text-xs text-muted-foreground">Conversație</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </details>
              ))
            )}
          </div>
        </div>

        {/* Core Settings */}
        <div className="admin-card min-w-0 overflow-hidden">
          <div className="admin-card-header flex flex-col space-y-1.5">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold leading-none tracking-tight">Parametri concurență de bază</h3>
            </div>
            <p className="text-sm text-muted-foreground">Sloturi concurență și praguri de așteptare la execuție (necesită modificare în config.json backend și repornire pentru a avea efect).</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center py-2 border-b flex-wrap gap-2">
              <div className="space-y-1 min-w-0">
                <span className="text-sm font-medium">Versiune sistem curentă</span>
              </div>
              <span className="font-mono text-sm">{settings?.version || "..."}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b flex-wrap gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <span className="text-sm font-medium">Concurență maximă per cont (max_inflight_per_account)</span>
                <p className="text-xs text-muted-foreground">Numărul de cereri procesate simultan de fiecare cont upstream. Prea mare riscă suspendare, prea mic nu utilizează complet.</p>
              </div>
              <input
                type="number"
                min="1"
                max="10"
                value={maxInflight}
                onChange={e => setMaxInflight(Number(e.target.value))}
                className="admin-input flex h-8 w-20 px-3 py-1 text-sm text-center"
              />
            </div>
            <div className="flex justify-between items-center py-2 border-b flex-wrap gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <span className="text-sm font-medium">Limită globală concurență (global_max_inflight)</span>
                <p className="text-xs text-muted-foreground">Limita dură a cererilor simultane în tranzit pentru toate conturile. 0 = nelimitat. Corespunde vârfului „sarcini asincrone" din Dashboard.</p>
              </div>
              <input
                type="number"
                min="0"
                max="200"
                value={globalMaxInflight}
                onChange={e => setGlobalMaxInflight(Number(e.target.value))}
                className="admin-input flex h-8 w-20 px-3 py-1 text-sm text-center"
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveConcurrency}>Salvare setări concurență</Button>
            </div>
          </div>
        </div>

        {/* Chat ID Pool */}
        <div className="admin-card min-w-0 overflow-hidden">
          <div className="admin-card-header flex flex-col space-y-1.5">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-rose-500" />
              <h3 className="font-semibold leading-none tracking-tight">Pool preîncălzire Chat_ID</h3>
            </div>
            <p className="text-sm text-muted-foreground">Pre-creare chat_id pentru evitarea handshake-ului upstream /chats/new (0,5~6s). Modificarea la execuție are efect imediat.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center py-2 border-b flex-wrap gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <span className="text-sm font-medium">Număr țintă per cont (target)</span>
                <p className="text-xs text-muted-foreground">Câte chat_id pre-pregătite per cont. Implicit 0, fără preîncălzire automată la pornire.</p>
              </div>
              <input
                type="number"
                min="0"
                max="20"
                value={poolTarget}
                onChange={e => setPoolTarget(Number(e.target.value))}
                className="admin-input flex h-8 w-20 px-3 py-1 text-sm text-center"
              />
            </div>
            <div className="flex justify-between items-center py-2 border-b flex-wrap gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <span className="text-sm font-medium">TTL (minute)</span>
                <p className="text-xs text-muted-foreground">chat_id-urile mai vechi de această durată sunt eliminate și recreate, pentru a evita recuperarea silențioasă de upstream. Implicit 10.</p>
              </div>
              <input
                type="number"
                min="1"
                max="120"
                value={poolTtlMin}
                onChange={e => setPoolTtlMin(Number(e.target.value))}
                className="admin-input flex h-8 w-20 px-3 py-1 text-sm text-center"
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSavePool}>Salvare setări pool preîncălzit</Button>
            </div>
          </div>
        </div>

        {/* Keepalive */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm min-w-0">
          <div className="flex flex-col space-y-1.5 p-6 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold leading-none tracking-tight">Configurare menținere activă</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${keepaliveRunning ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                {keepaliveRunning ? "În execuție" : "Neactivat"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">După configurare, serviciul va trimite periodic cereri GET către acest URL pentru a menține conexiunea activă; lăsați gol pentru a dezactiva.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="text-sm font-medium">URL menținere activă</label>
                <Button variant="outline" size="sm" onClick={handleUseCurrentKeepaliveUrl} disabled={keepaliveEnvLocked.includes("keepalive_url")}>
                  <Activity className="mr-2 h-4 w-4" /> Setare rapidă menținere activă
                </Button>
              </div>
              <input
                type="text"
                value={keepaliveUrl}
                disabled={keepaliveEnvLocked.includes("keepalive_url")}
                onChange={e => setKeepaliveUrl(e.target.value)}
                placeholder={`${baseUrl.replace(/\/$/, "")}/keepalive`}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-muted"
              />
              {keepaliveEnvLocked.includes("keepalive_url") && (
                <p className="text-xs text-muted-foreground">KEEPALIVE_URL este injectat prin variabilă de mediu, panoul nu suprascrie.</p>
              )}
            </div>
            <div className="flex justify-between items-center py-2 border-b flex-wrap gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <span className="text-sm font-medium">Interval menținere activă (secunde)</span>
                <p className="text-xs text-muted-foreground">Interval 5 - 86400 secunde, implicit 60.</p>
              </div>
              <input
                type="number"
                min="5"
                max="86400"
                value={keepaliveInterval}
                disabled={keepaliveEnvLocked.includes("keepalive_interval")}
                onChange={e => setKeepaliveInterval(Number(e.target.value))}
                className="flex h-8 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm text-center disabled:cursor-not-allowed disabled:bg-muted"
              />
            </div>
            {keepaliveEnvLocked.includes("keepalive_interval") && (
              <p className="text-xs text-muted-foreground">KEEPALIVE_INTERVAL este injectat prin variabilă de mediu, panoul nu suprascrie.</p>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveKeepalive}>
                <Save className="mr-2 h-4 w-4" /> Salvare configurație menținere activă
              </Button>
            </div>
          </div>
        </div>

        {/* Model Mapping */}
        <div className="admin-card min-w-0 overflow-hidden">
          <div className="admin-card-header flex flex-col space-y-1.5">
            <h3 className="font-semibold leading-none tracking-tight">Reguli mapare automată modele (Model Aliases)</h3>
            <p className="text-sm text-muted-foreground">Numele de model transmise downstream vor fi rutate automat de gateway către modelele Qwen corespunzătoare. Editați folosind format JSON standard.</p>
          </div>
          <div className="p-6">
            <textarea
              rows={8}
              value={modelAliases}
              onChange={e => setModelAliases(e.target.value)}
              className="code-surface flex min-h-[160px] w-full rounded-2xl px-3 py-2 text-sm font-mono"
              style={{ whiteSpace: "pre", overflowX: "auto" }}
            />
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSaveAliases}>Salvare mapare</Button>
            </div>
          </div>
        </div>

        {/* Usage Example */}
        <div className="admin-card min-w-0 overflow-hidden">
          <div className="admin-card-header flex flex-col space-y-1.5">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <h3 className="font-semibold leading-none tracking-tight">Exemple de utilizare</h3>
            </div>
          </div>
          <div className="p-6 min-w-0">
            <pre className="code-surface rounded-2xl p-4 text-xs font-mono whitespace-pre-wrap break-all max-h-[400px] overflow-y-auto overflow-x-hidden">
              {curlExample}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}