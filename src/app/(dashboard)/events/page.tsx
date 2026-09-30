"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, Eye, Filter, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type SystemEvent = {
  id: string;
  eventType: string;
  source: string;
  status: string;
  createdAt: string;
  details: string;
};

export default function EventsPage() {
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<{
    events: SystemEvent[];
    total: number;
  }>({
    queryKey: ["events-stream", type, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type !== "all") params.set("type", type);
      if (status) params.set("status", status);
      params.set("limit", "100");

      const res = await fetch(`/api/events?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao buscar eventos");
      return res.json();
    },
    refetchInterval: 10000, // auto polling a cada 10s
  });

  const events = data?.events || [];

  const getStatusBadge = (st: string) => {
    switch (st.toLowerCase()) {
      case "received":
      case "recebido":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Clock className="w-3 h-3" /> Recebido
          </span>
        );
      case "processed":
      case "processado":
      case "sent":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="w-3 h-3" /> Processado
          </span>
        );
      case "failed":
      case "falhou":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle className="w-3 h-3" /> Falhou
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {st}
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Central de Eventos & Logs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Feed em tempo real de eventos recebidos pelo Tracker, Webhooks e Meta CAPI
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-blue-600" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mr-2">
          <Filter className="w-4 h-4" /> Filtros:
        </div>
        <div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
          >
            <option value="all">Todos os Tipos</option>
            <option value="tracking">Tracker / Pixel</option>
            <option value="webhook">Webhooks (Vendas)</option>
          </select>
        </div>
        <div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
          >
            <option value="">Todos os Status</option>
            <option value="received">Recebido</option>
            <option value="processed">Processado</option>
            <option value="failed">Falhou</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400 text-xs">
                <th className="py-3 px-4">Data e Hora</th>
                <th className="py-3 px-4">Evento</th>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Conteúdo / Detalhes</th>
                <th className="py-3 px-4 text-center">Payload</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td colSpan={6} className="py-3.5 px-4">
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 dark:text-gray-400">
                    <Activity className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="font-medium">Nenhum evento registrado ainda</p>
                    <p className="text-xs mt-1">Conecte um webhook ou instale o tracker para começar a receber eventos.</p>
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDateTime(ev.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      {ev.eventType}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                        {ev.source}
                      </span>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(ev.status)}</td>
                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400 max-w-[300px] truncate" title={ev.details}>
                      {ev.details || "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedEvent(ev)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        title="Ver Payload Técnico"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhe Técnico */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Detalhes do Evento: {selectedEvent.eventType}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="text-gray-400">Origem:</span>
                <p className="font-semibold text-gray-800 dark:text-gray-200 uppercase mt-0.5">{selectedEvent.source}</p>
              </div>
              <div className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="text-gray-400">Data / Hora:</span>
                <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{formatDateTime(selectedEvent.createdAt)}</p>
              </div>
              <div className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="text-gray-400">Status:</span>
                <p className="font-semibold text-gray-800 dark:text-gray-200 uppercase mt-0.5">{selectedEvent.status}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Payload Técnico:</label>
              <pre className="bg-gray-950 text-emerald-400 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(selectedEvent.details), null, 2);
                  } catch {
                    return selectedEvent.details || "Nenhum payload adicional gravado.";
                  }
                })()}
              </pre>
            </div>

            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-800 dark:text-gray-200 py-2 rounded-lg text-sm font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
