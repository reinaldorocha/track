"use client"

import { useState, useEffect } from "react"
import { Copy, CheckCircle } from "lucide-react"

interface TrackerEvent {
  id: string
  eventType: string
  source: string
  status: string
  createdAt: string
  details?: string
  workspaceId?: string
}

export default function TrackerPage() {
  const [domain, setDomain] = useState("")
  const [workspaceId, setWorkspaceId] = useState("")
  const [pixelId, setPixelId] = useState("")
  const [autoPixel, setAutoPixel] = useState(true)
  const [lastEvent, setLastEvent] = useState<TrackerEvent | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedTy, setCopiedTy] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/events?limit=1&type=tracking")
      if (res.ok) {
        const data = await res.json()
        if (data.events && data.events.length > 0) {
          setLastEvent(data.events[0])
          if (data.events[0].workspaceId) {
            setWorkspaceId(data.events[0].workspaceId)
          }
        }
      }
    }
    const fetchPixels = async () => {
      try {
        const res = await fetch("/api/pixels")
        if (res.ok) {
          const data = await res.json()
          if (data.pixels && data.pixels.length > 0) {
            const active = data.pixels.find((p: any) => p.status === 'active') || data.pixels[0]
            if (active?.pixelId) {
              setPixelId(active.pixelId)
            }
          }
        }
      } catch {}
    }
    fetchData()
    fetchPixels()
  }, [])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  
  const scriptTag = `<script 
  src="${appUrl}/tracker.js" 
  data-api-url="${appUrl}" 
  data-workspace-id="${workspaceId || 'SEU_WORKSPACE_ID'}"${pixelId ? `\n  data-pixel-id="${pixelId}"` : ''}${!autoPixel ? '\n  data-auto-pixel="false"' : ''} 
  async
></script>`

  const thankYouScriptTag = `<script 
  src="${appUrl}/tracker.js" 
  data-api-url="${appUrl}" 
  data-workspace-id="${workspaceId || 'SEU_WORKSPACE_ID'}" 
  data-pixel-id="${pixelId || 'SEU_PIXEL_ID'}" 
  data-platform="kiwify" 
  async
></script>`

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptTag)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const handleCopyTy = () => {
    navigator.clipboard.writeText(thankYouScriptTag)
    setCopiedTy(true)
    setTimeout(() => setCopiedTy(false), 3000)
  }

  const handleTest = async () => {
    await fetch("/api/tracking/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: workspaceId || "test_workspace",
        sessionId: "test_session_" + Date.now(),
        eventId: "test_event_" + Date.now(),
        eventName: "TestEvent",
        sourceUrl: window.location.href,
        pixelId: pixelId || undefined
      })
    })
    
    // Refresh events
    const res = await fetch("/api/events?limit=1&type=tracking")
    if (res.ok) {
      const data = await res.json()
      if (data.events && data.events.length > 0) {
        setLastEvent(data.events[0])
      }
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Instalação do Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Script unificado de rastreamento com integração automática ao Meta Pixel e CAPI</p>
        </div>
        <a
          href="/integrations/utm"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 self-start sm:self-auto"
        >
          Central de Rastreamento Completa →
        </a>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">PASSO 1: Configuração do Domínio e Pixel Meta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Domínio da Página de Vendas</label>
              <input 
                type="text" 
                placeholder="Ex: seudominio.com.br" 
                value={domain} 
                onChange={e => setDomain(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">ID Numérico do Meta Pixel (data-pixel-id)</label>
              <input 
                type="text" 
                placeholder="Ex: 123456789012345" 
                value={pixelId} 
                onChange={e => setPixelId(e.target.value.trim())}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input 
              type="checkbox" 
              id="autoPixelCheck" 
              checked={autoPixel} 
              onChange={e => setAutoPixel(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="autoPixelCheck" className="text-xs text-gray-600 dark:text-gray-400">
              Carregar SDK oficial da Meta (<code className="font-mono">fbevents.js</code>) automaticamente e gerenciar disparos com <code className="font-mono">trackSingle</code>
            </label>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-emerald-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded">Recomendado (Snippet Único)</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">PASSO 2: Script Unificado para Página de Vendas (Landing Page)</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
            Cole apenas este código no <code className="font-mono">&lt;head&gt;</code> da sua página. Ele carrega o SDK da Meta, sincroniza <code className="font-mono">PageView</code> e <code className="font-mono">InitiateCheckout</code> entre o navegador e a CAPI com o mesmo <code className="font-mono">event_id</code>, persiste UTMs por 30 dias e decora os links de checkout automaticamente.
          </p>
          <div className="relative">
            <pre className="bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono">
              {scriptTag}
            </pre>
            <button 
              onClick={handleCopy}
              className="absolute top-3 right-3 flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 shadow"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? "Copiado!" : "Copiar Código"}
            </button>
          </div>
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <p className="font-semibold">💡 Fluxo sem página de obrigado (Anúncio → LP → Checkout → Fim):</p>
            <p>Você só precisa instalar o script acima na Landing Page! A confirmação da compra (<code className="font-mono">Purchase</code>) é recebida diretamente pelo Webhook da Kiwify/Hotmart e enviada à Meta via CAPI pelo servidor com 100% de segurança e token criptografado.</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              * Nota para quem já usa GTM ou construtor com Pixel ativo: use <code className="font-mono">data-auto-pixel="false"</code> e desative o disparo padrão do construtor para evitar duplicidade de PageView.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-gray-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded">Opcional</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">PASSO 3: Script para Página de Obrigado / Confirmação</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
            Apenas para quem redireciona o cliente para uma página de obrigado própria no seu domínio. Se o seu checkout finaliza na própria plataforma (Kiwify/Hotmart), **ignore este passo**.
          </p>
          <div className="relative">
            <pre className="bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono">
              {thankYouScriptTag}
            </pre>
            <button 
              onClick={handleCopyTy}
              className="absolute top-3 right-3 flex items-center gap-1.5 bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-600 shadow"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedTy ? "Copiado!" : "Copiar Código"}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">PASSO 4: Teste a Conexão</h2>
          <button 
            onClick={handleTest} 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Enviar Evento de Teste
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">PASSO 5: Confirme o recebimento</h2>
          {lastEvent ? (
            <div className="flex items-start bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800/30">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-300 text-sm">Tracker instalado e ativo</h3>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                  Último evento recebido: <span className="font-semibold">{lastEvent.eventType}</span> ({new Date(lastEvent.createdAt).toLocaleString("pt-BR")})
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800/30">
              <h3 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Aguardando eventos...</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Sem eventos recebidos recentemente. Instale o script e acesse sua página para verificar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
