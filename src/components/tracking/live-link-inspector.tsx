'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Radio,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
  ShoppingCart,
  Activity,
  ArrowRight,
} from 'lucide-react'

interface CheckResult {
  id: string
  name: string
  status: 'success' | 'warning' | 'failed'
  title: string
  details: string
}

interface InspectResponse {
  success: boolean
  url: string
  httpStatus: number
  responseTimeMs: number
  score: number
  isHttps: boolean
  checks: CheckResult[]
  detectedPixelId?: string | null
  detectedCheckouts: Array<{ platform: string; count: number }>
  testToken?: string
  testUrl?: string
  summary: string
  error?: string
}

interface LiveSessionData {
  sessionId: string
  visitorId: string
  utmSource?: string
  utmCampaign?: string
  landingPage?: string
  ipAddress?: string
  firstSeenAt: string
  eventsCount: number
  lastEventName: string
}

export function LiveLinkInspector() {
  const [url, setUrl] = useState('')
  const [isInspecting, setIsInspecting] = useState(false)
  const [inspectResult, setInspectResult] = useState<InspectResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Live listener states
  const [isListening, setIsListening] = useState(false)
  const [capturedSession, setCapturedSession] = useState<LiveSessionData | null>(null)
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleInspect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!url.trim()) return

    setIsInspecting(true)
    setErrorMessage(null)
    setCapturedSession(null)
    setIsListening(false)
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)

    try {
      const res = await fetch('/api/tracking/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Erro ao inspecionar a página')
        if (data.checks) {
          setInspectResult(data)
        }
      } else {
        setInspectResult(data)
        if (data.testToken) {
          setIsListening(true)
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha de comunicação com o servidor')
    } finally {
      setIsInspecting(false)
    }
  }

  // Polling para escuta de clique ao vivo
  useEffect(() => {
    if (!isListening || !inspectResult?.testToken || capturedSession) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      return
    }

    const checkLiveClick = async () => {
      try {
        const res = await fetch(`/api/tracking/inspect?token=${encodeURIComponent(inspectResult.testToken!)}`)
        const data = await res.json()

        if (data.detected && data.session) {
          setCapturedSession(data.session)
          setIsListening(false)
          if (pollTimerRef.current) clearInterval(pollTimerRef.current)
        }
      } catch (e) {
        console.error('Erro no radar ao vivo:', e)
      }
    }

    pollTimerRef.current = setInterval(checkLiveClick, 2500)

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [isListening, inspectResult?.testToken, capturedSession])

  const copyTestLink = () => {
    if (!inspectResult?.testUrl) return
    navigator.clipboard.writeText(inspectResult.testUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10'
    if (score >= 50) return 'text-amber-500 border-amber-500/40 bg-amber-500/10'
    return 'text-rose-500 border-rose-500/40 bg-rose-500/10'
  }

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'Excelente'
    if (score >= 50) return 'Atenção'
    return 'Crítico'
  }

  return (
    <div className="space-y-6">
      {/* Header do Inspetor */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-blue-900">
              <Sparkles className="w-3.5 h-3.5" />
              Live Link Inspector
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Testador de Rastreamento ao Vivo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Diagnostique qualquer landing page ou página de vendas. O motor analisa o HTML em tempo real,
              checa SSL, valida a instalação do <code className="text-blue-500 font-mono">tracker.js</code>, detecta o Meta Pixel, mapeia todos os botões de checkout e simula visitas com escuta ativa de eventos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-slate-400 block font-medium">Status do Diagnóstico</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {inspectResult ? `Score: ${inspectResult.score}/100` : 'Aguardando URL'}
              </span>
            </div>
          </div>
        </div>

        {/* Formulário de Busca / URL */}
        <form onSubmit={handleInspect} className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Globe className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Digite a URL da sua página (ex: meudominio.com.br ou https://...)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isInspecting || !url.trim()}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all disabled:opacity-50"
          >
            {isInspecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Inspecionando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Inspecionar Página
              </>
            )}
          </button>
        </form>

        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Aviso na inspeção:</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Resultados da Inspeção */}
      {inspectResult && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Card Resumo do Health Score */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`p-5 rounded-2xl border ${getScoreColor(inspectResult.score)} flex items-center justify-between`}>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider block opacity-80">Health Score</span>
                <span className="text-3xl font-extrabold">{inspectResult.score}<span className="text-sm font-semibold opacity-70">/100</span></span>
                <span className="text-xs block font-semibold mt-0.5">{getScoreBadge(inspectResult.score)}</span>
              </div>
              <div className="w-14 h-14 rounded-full border-4 border-current flex items-center justify-center font-bold text-lg">
                {inspectResult.score}%
              </div>
            </div>

            <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] p-5 rounded-2xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Resposta HTTP</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-2xl font-bold ${inspectResult.httpStatus >= 200 && inspectResult.httpStatus < 300 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {inspectResult.httpStatus || 'Erro'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {inspectResult.responseTimeMs}ms
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
                {inspectResult.isHttps ? '🔒 Protocolo HTTPS Seguro' : '⚠️ Não usa HTTPS'}
              </span>
            </div>

            <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] p-5 rounded-2xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Meta Pixel Detectado</span>
              <div className="mt-1">
                {inspectResult.detectedPixelId ? (
                  <span className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400 truncate block">
                    ID: {inspectResult.detectedPixelId}
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 block">
                    Não identificado
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
                {inspectResult.detectedPixelId ? 'Pronto para CAPI deduplicada' : 'Adicione o pixel para melhor atribuição'}
              </span>
            </div>

            <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] p-5 rounded-2xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Gateways de Checkout</span>
              <div className="mt-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {inspectResult.detectedCheckouts.reduce((acc, c) => acc + c.count, 0)} <span className="text-xs font-normal text-slate-400">link(s)</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1 truncate">
                {inspectResult.detectedCheckouts.length > 0
                  ? inspectResult.detectedCheckouts.map(c => c.platform).join(', ')
                  : 'Nenhum gateway padrão'}
              </span>
            </div>
          </div>

          {/* Checklist de Itens */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Checklist de Validação Técnica
            </h3>

            <div className="space-y-3">
              {inspectResult.checks.map((chk) => (
                <div
                  key={chk.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3.5 transition-all ${
                    chk.status === 'success'
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                      : chk.status === 'warning'
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200'
                      : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  <div className="mt-0.5">
                    {chk.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : chk.status === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider opacity-75">{chk.name}</span>
                    </div>
                    <p className="text-sm font-semibold mt-0.5">{chk.title}</p>
                    <p className="text-xs mt-1 opacity-90">{chk.details}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#061224] rounded-xl border border-slate-200 dark:border-[#142C52] text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-800 dark:text-slate-200">Diagnóstico Geral: </span>
              {inspectResult.summary}
            </div>
          </div>

          {/* SIMULADOR DE CLIQUE & RADAR AO VIVO */}
          {inspectResult.testUrl && (
            <div className="bg-gradient-to-br from-blue-900/90 to-indigo-950 border border-blue-700/50 rounded-2xl p-6 text-white shadow-xl space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    Radar de Rastreamento em Tempo Real
                  </div>
                  <h3 className="text-lg font-bold">Simulação de Clique e Teste de Visita</h3>
                  <p className="text-xs text-blue-200 max-w-2xl">
                    Abra o link gerado abaixo para simular a chegada de um visitante de anúncio Meta.
                    Assim que a página carregar com o script, o radar capturará a sessão e exibirá todos os parâmetros coletados.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copyTestLink}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold text-white transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar Link'}
                  </button>

                  <a
                    href={inspectResult.testUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-bold text-white shadow transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir Link de Teste
                  </a>
                </div>
              </div>

              {/* URL Display */}
              <div className="bg-black/40 border border-white/10 rounded-xl p-3 font-mono text-[11px] text-blue-200 break-all select-all">
                {inspectResult.testUrl}
              </div>

              {/* Status do Radar */}
              {!capturedSession ? (
                <div className="bg-blue-950/60 border border-blue-800/60 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Escutando em tempo real no banco de dados...</p>
                      <p className="text-[11px] text-blue-300">
                        Clique em &quot;Abrir Link de Teste&quot; acima para simular o acesso no seu navegador.
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-blue-300 uppercase tracking-wider block font-mono">Token de Teste</span>
                    <span className="text-xs font-mono text-emerald-400 font-bold">{inspectResult.testToken}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl p-5 space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-500 text-slate-950 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 font-bold" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">🎉 Visita Capturada com Sucesso!</h4>
                        <p className="text-[11px] text-emerald-200">
                          O tracker.js interceptou o visitante, gravou a sessão no banco e registrou os eventos.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-xs font-bold">
                      100% Funcional
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-emerald-800/60 text-xs">
                    <div>
                      <span className="text-emerald-400 text-[10px] block uppercase">Session ID</span>
                      <span className="font-mono text-white text-[11px] truncate block">{capturedSession.sessionId}</span>
                    </div>
                    <div>
                      <span className="text-emerald-400 text-[10px] block uppercase">Origem / Campanha</span>
                      <span className="text-white text-[11px] font-semibold truncate block">
                        {capturedSession.utmSource || 'meta_test'} / {capturedSession.utmCampaign || 'teste'}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-400 text-[10px] block uppercase">Último Evento</span>
                      <span className="text-white text-[11px] font-semibold block">{capturedSession.lastEventName}</span>
                    </div>
                    <div>
                      <span className="text-emerald-400 text-[10px] block uppercase">Total Eventos Gravados</span>
                      <span className="text-white text-[11px] font-bold block">{capturedSession.eventsCount} evento(s)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
