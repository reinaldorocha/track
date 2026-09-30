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
  const [lastEvent, setLastEvent] = useState<TrackerEvent | null>(null)
  const [copied, setCopied] = useState(false)

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
    fetchData()
  }, [])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  
  const scriptTag = `<script 
  src="${appUrl}/tracker.js" 
  data-api-url="${appUrl}" 
  data-workspace-id="${workspaceId || 'SEU_WORKSPACE_ID'}" 
  async
></script>`

  const thankYouScriptTag = `<script 
  src="${appUrl}/tracker.js" 
  data-api-url="${appUrl}" 
  data-workspace-id="${workspaceId || 'SEU_WORKSPACE_ID'}" 
  data-pixel-id="SEU_PIXEL_ID"
  data-platform="kiwify" 
  async
></script>`

  const [copiedTy, setCopiedTy] = useState(false)

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
        sourceUrl: window.location.href
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Siga os 5 passos para integrar o script de rastreamento no seu site ou landing page</p>
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
          <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">PASSO 1: Configure seu domínio</h2>
          <input 
            type="text" 
            placeholder="Ex: seudominio.com.br" 
            value={domain} 
            onChange={e => setDomain(e.target.value)}
            className="w-full max-w-md px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">PASSO 2: Script para Página de Vendas (Landing Page)</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Captura PageView, UTMs, fbclid, cookies primários (_fbp/_fbc) e InitiateCheckout automaticamente.</p>
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
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-blue-200 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded">Deduplicação CAPI</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">PASSO 3: Script para Página de Obrigado / Confirmação</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
            Para garantir deduplicação determinística absoluta (100% de paridade browser ↔ webhook no Meta Events Manager), configure <code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded text-blue-800 dark:text-blue-200">data-platform</code> e <code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded text-blue-800 dark:text-blue-200">data-pixel-id</code> explicitamente:
          </p>
          <div className="relative">
            <pre className="bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono">
              {thankYouScriptTag}
            </pre>
            <button 
              onClick={handleCopyTy}
              className="absolute top-3 right-3 flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 shadow"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedTy ? "Copiado!" : "Copiar Código"}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
            Substitua <code className="font-mono">SEU_PIXEL_ID</code> pelo ID numérico do Meta Pixel vinculado ao produto e <code className="font-mono">data-platform</code> pela plataforma correspondente (ex: <code className="font-mono">kiwify</code>, <code className="font-mono">hotmart</code>, <code className="font-mono">cakto</code>, <code className="font-mono">yampi</code>, <code className="font-mono">getfy</code>, <code className="font-mono">shopify</code>).
          </p>
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
