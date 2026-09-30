"use client"

import { useState, useEffect } from "react"
import { Plus, Trash, Play, Copy } from "lucide-react"

interface PixelItem {
  id: string
  name: string
  pixelId: string
  status: string
  environment: string
  accessTokenEnc?: string | null
}

export default function PixelPage() {
  const [pixels, setPixels] = useState<PixelItem[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({ name: "", pixelId: "", accessToken: "", environment: "production" })
  const [testResult, setTestResult] = useState<string | null>(null)

  const fetchPixels = async () => {
    const res = await fetch("/api/pixels")
    if (res.ok) {
      const data = await res.json()
      setPixels(data.pixels || [])
    }
  }

  useEffect(() => {
    fetchPixels()
  }, [])

  const handleSave = async () => {
    await fetch("/api/pixels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    })
    setIsModalOpen(false)
    setFormData({ name: "", pixelId: "", accessToken: "", environment: "production" })
    fetchPixels()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja remover este Pixel?")) return
    await fetch(`/api/pixels?id=${id}`, { method: "DELETE" })
    fetchPixels()
  }

  const handleTest = async (id: string) => {
    const res = await fetch("/api/meta/pixel/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pixelId: id,
        eventName: "PageView",
        sourceUrl: window.location.href
      })
    })
    const data = await res.json()
    setTestResult(data.success ? "Evento enviado com sucesso para Meta Conversions API!" : "Erro ao testar evento.")
    setTimeout(() => setTestResult(null), 5000)
  }

  const handleCopy = (pixelId: string) => {
    const code = `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<!-- End Meta Pixel Code -->`
    navigator.clipboard.writeText(code)
    alert("Código do Pixel copiado para a área de transferência!")
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meta Pixel & Conversions API</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure seus Pixels e tokens da API de Conversões do Meta Ads</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/integrations/utm"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold border border-slate-200 dark:border-gray-700 transition-colors"
          >
            Central de Rastreamento →
          </a>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow"
          >
            <Plus className="w-4 h-4" /> Adicionar Pixel
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
              <th className="py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Nome</th>
              <th className="py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Pixel ID</th>
              <th className="py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Ambiente</th>
              <th className="py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Access Token</th>
              <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pixels.map(pixel => (
              <tr key={pixel.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{pixel.name}</td>
                <td className="py-3 px-4 text-gray-700 dark:text-gray-300 font-mono text-xs">{pixel.pixelId}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {pixel.environment}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-mono text-xs">
                  {pixel.accessTokenEnc || "Não configurado"}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleTest(pixel.id)} className="p-1 text-green-600 hover:text-green-700" title="Testar CAPI">
                      <Play className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleCopy(pixel.pixelId)} className="p-1 text-blue-600 hover:text-blue-700" title="Gerar Código">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(pixel.id)} className="p-1 text-red-600 hover:text-red-700" title="Excluir">
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pixels.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500 dark:text-gray-400">
                  Nenhum pixel configurado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {testResult && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white p-4 rounded-lg shadow-lg z-50 text-sm">
          {testResult}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Adicionar Pixel</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Pixel</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Pixel Principal" 
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pixel ID</label>
                <input 
                  type="text" 
                  value={formData.pixelId} 
                  onChange={e => setFormData({ ...formData, pixelId: e.target.value })}
                  placeholder="Ex: 1234567890" 
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Access Token (Conversions API)</label>
                <input 
                  type="password" 
                  value={formData.accessToken} 
                  onChange={e => setFormData({ ...formData, accessToken: e.target.value })}
                  placeholder="EAAB..." 
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Nunca exibido publicamente após salvar.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ambiente</label>
                <select 
                  value={formData.environment} 
                  onChange={e => setFormData({ ...formData, environment: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                  <option value="production">Produção</option>
                  <option value="test">Teste</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancelar
              </button>
              <button onClick={handleSave} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                Salvar Pixel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
