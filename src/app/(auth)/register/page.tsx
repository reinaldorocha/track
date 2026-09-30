'use client'

import Link from 'next/link'
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react'
import { UtmTrackLogo } from '@/components/brand/logo'

export default function RegisterPage() {
  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center text-center">
        <UtmTrackLogo size="lg" showTagline />
      </div>

      <div className="bg-white dark:bg-[#081A33] rounded-2xl shadow-xl border border-slate-200 dark:border-[#142C52] p-8 text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
          <Lock className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Cadastro Restrito
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            O UTM-Track é uma plataforma privada de inteligência e atribuição de anúncios. Novos acessos são disponibilizados exclusivamente pelo administrador do sistema.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] text-xs text-slate-500 dark:text-slate-400 text-left space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
            <ShieldAlert className="w-4 h-4 text-[#0066FF]" /> Já é cliente autorizado?
          </div>
          <p>
            Utilize suas credenciais enviadas pelo administrador para entrar na plataforma.
          </p>
        </div>

        <Link
          href="/login"
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg shadow-md text-sm font-bold text-white bg-[#0066FF] hover:bg-[#0052CC] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o Login
        </Link>
      </div>
    </div>
  )
}
