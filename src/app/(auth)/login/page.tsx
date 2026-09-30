'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Eye, EyeOff, Fingerprint } from 'lucide-react'
import { UtmTrackLogo } from '@/components/brand/logo'

// ——————————————————————————————————————
// Local storage key to track whether this device has a registered passkey
// ——————————————————————————————————————
const PASSKEY_REGISTERED_KEY = 'utm_passkey_registered'

function isWebAuthnSupported(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function'
  )
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
  return buffer.buffer as ArrayBuffer
}

function bufferToBase64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ——————————————————————————————————————
// Main login form
// ——————————————————————————————————————
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [webAuthnSupported, setWebAuthnSupported] = useState(false)
  const [passkeyAvailable, setPasskeyAvailable] = useState(false)
  const [showRegisterBiometric, setShowRegisterBiometric] = useState(false)
  const [biometricMsg, setBiometricMsg] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const errParam = searchParams.get('error')
    if (errParam) {
      if (errParam === 'USER_SUSPENDED') {
        setError('Acesso temporariamente bloqueado. Entre em contato com o administrador do sistema.')
      } else if (errParam === 'CredentialsSignin') {
        setError('E-mail ou senha incorretos.')
      } else if (errParam === 'Configuration') {
        setError('Erro de configuração no servidor de autenticação.')
      } else if (errParam === 'AccessDenied') {
        setError('Acesso negado. Sua conta não possui permissão.')
      } else {
        setError(`Erro na autenticação: ${errParam}`)
      }
    }
  }, [searchParams])

  useEffect(() => {
    const supported = isWebAuthnSupported()
    setWebAuthnSupported(supported)
    if (supported) {
      const registered = localStorage.getItem(PASSKEY_REGISTERED_KEY) === 'true'
      setPasskeyAvailable(registered)
    }
  }, [])

  // ——————————————————————————————————————
  // Standard credentials login
  // ——————————————————————————————————————
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const cleanEmail = email.trim().toLowerCase()

    try {
      const res = await signIn('credentials', {
        email: cleanEmail,
        password,
        redirect: false,
      })

      if (res?.error) {
        if (res.error.includes('USER_SUSPENDED')) {
          setError('Acesso temporariamente bloqueado. Entre em contato com o administrador do sistema.')
        } else if (res.error === 'CredentialsSignin' || res.code === 'credentials') {
          setError('E-mail ou senha incorretos.')
        } else if (res.error === 'Configuration') {
          setError('Erro de configuração de autenticação no servidor.')
        } else {
          setError('Não foi possível entrar. Verifique suas credenciais de acesso.')
        }
      } else if (res?.ok) {
        // Show biometric registration prompt after successful login
        if (webAuthnSupported && localStorage.getItem(PASSKEY_REGISTERED_KEY) !== 'true') {
          setShowRegisterBiometric(true)
        } else {
          window.location.href = '/dashboard'
        }
      } else {
        setError('E-mail ou senha incorretos.')
      }
    } catch (err: unknown) {
      console.error('[login error]', err)
      setError('Ocorreu um erro ao conectar com o servidor. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // ——————————————————————————————————————
  // Biometric login (WebAuthn authentication)
  // ——————————————————————————————————————
  const handleBiometricLogin = useCallback(async () => {
    if (!isWebAuthnSupported()) return
    setBiometricLoading(true)
    setError('')

    try {
      // 1. Get challenge from server
      const challengeRes = await fetch('/api/auth/webauthn/authenticate')
      if (!challengeRes.ok) throw new Error('Erro ao iniciar autenticação biométrica')
      const { options } = await challengeRes.json()

      // 2. Start biometric flow on the device
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: base64urlToBuffer(options.challenge),
          rpId: options.rpId,
          timeout: options.timeout,
          userVerification: 'required',
          allowCredentials: [],
        },
      }) as PublicKeyCredential | null

      if (!assertion) throw new Error('Autenticação cancelada pelo usuário')

      const assertionResponse = assertion.response as AuthenticatorAssertionResponse

      // 3. Send assertion to server for verification
      const verifyRes = await fetch('/api/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawId: bufferToBase64url(assertion.rawId),
          clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
          authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
          signature: bufferToBase64url(assertionResponse.signature),
          userHandle: assertionResponse.userHandle ? bufferToBase64url(assertionResponse.userHandle) : undefined,
          challenge: options.challenge,
        }),
      })

      const verifyData = await verifyRes.json()

      if (verifyData.success) {
        window.location.href = verifyData.redirectTo || '/dashboard'
      } else {
        setError(verifyData.error || 'Autenticação biométrica falhou. Tente com e-mail e senha.')
        // Remove local flag if credential was not found
        if (verifyData.error?.includes('não encontrada') || verifyData.error?.includes('not found')) {
          localStorage.removeItem(PASSKEY_REGISTERED_KEY)
          setPasskeyAvailable(false)
        }
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('Biometria cancelada ou não permitida pelo dispositivo.')
      } else if (err?.name === 'SecurityError') {
        setError('Erro de segurança. Verifique se o domínio está correto.')
      } else {
        console.error('[biometric login error]', err)
        setError('Autenticação biométrica falhou. Use e-mail e senha.')
      }
    } finally {
      setBiometricLoading(false)
    }
  }, [])

  // ——————————————————————————————————————
  // Register biometric (after successful password login)
  // ——————————————————————————————————————
  const handleRegisterBiometric = useCallback(async () => {
    setBiometricLoading(true)
    setBiometricMsg('')

    try {
      // 1. Get registration options
      const optionsRes = await fetch('/api/auth/webauthn/register')
      if (!optionsRes.ok) throw new Error('Erro ao iniciar registro biométrico')
      const { options } = await optionsRes.json()

      // 2. Create credential on device (triggers biometric prompt)
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: base64urlToBuffer(options.challenge),
          rp: options.rp,
          user: {
            id: base64urlToBuffer(options.user.id),
            name: options.user.name,
            displayName: options.user.displayName,
          },
          pubKeyCredParams: options.pubKeyCredParams,
          timeout: options.timeout,
          attestation: 'none',
          authenticatorSelection: options.authenticatorSelection,
          excludeCredentials: (options.excludeCredentials || []).map((c: { id: string; type: string; transports: string[] }) => ({
            ...c,
            id: base64urlToBuffer(c.id),
          })),
        },
      }) as PublicKeyCredential | null

      if (!credential) throw new Error('Cadastro cancelado')

      const credResponse = credential.response as AuthenticatorAttestationResponse
      const transports = typeof credResponse.getTransports === 'function'
        ? credResponse.getTransports()
        : []

      // 3. Verify with server
      const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawId: bufferToBase64url(credential.rawId),
          clientDataJSON: bufferToBase64url(credResponse.clientDataJSON),
          attestationObject: bufferToBase64url(credResponse.attestationObject),
          transports,
          deviceName: navigator.userAgent.includes('Android')
            ? 'Android'
            : navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')
            ? 'iPhone / iPad'
            : 'Dispositivo',
          challenge: options.challenge,
        }),
      })

      const verifyData = await verifyRes.json()

      if (verifyData.success) {
        localStorage.setItem(PASSKEY_REGISTERED_KEY, 'true')
        setBiometricMsg('✓ Biometria ativada! Nos próximos acessos você pode usar impressão digital ou Face ID.')
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 2000)
      } else {
        setBiometricMsg('Não foi possível registrar a biometria: ' + (verifyData.error || 'Tente novamente.'))
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setBiometricMsg('Registro de biometria cancelado ou não permitido.')
      } else {
        console.error('[biometric register error]', err)
        setBiometricMsg('Erro ao registrar biometria. Você pode ativar mais tarde em Conta → Segurança.')
      }
    } finally {
      setBiometricLoading(false)
    }
  }, [])

  // ——————————————————————————————————————
  // Render — biometric registration prompt
  // ——————————————————————————————————————
  if (showRegisterBiometric) {
    return (
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <UtmTrackLogo size="lg" showTagline />
        </div>

        <div className="bg-white dark:bg-[#081A33] rounded-2xl shadow-xl border border-slate-200 dark:border-[#142C52] p-8 space-y-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[#0066FF]/10 flex items-center justify-center">
              <Fingerprint className="w-8 h-8 text-[#0066FF]" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ativar biometria</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Quer acessar o UTM-Track na próxima vez usando impressão digital ou Face ID?
            </p>
          </div>

          {biometricMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
              {biometricMsg}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRegisterBiometric}
              disabled={biometricLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-lg font-bold text-sm disabled:opacity-50 transition-colors"
            >
              {biometricLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Fingerprint className="w-5 h-5" />
                  Sim, ativar biometria
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => { window.location.href = '/dashboard' }}
              className="w-full py-2.5 px-4 border border-slate-200 dark:border-[#142C52] text-slate-600 dark:text-slate-300 rounded-lg font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Não, ir para o dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ——————————————————————————————————————
  // Render — main login form
  // ——————————————————————————————————————
  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center text-center">
        <UtmTrackLogo size="lg" showTagline />
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Entre na sua conta para continuar</p>
      </div>

      <div className="bg-white dark:bg-[#081A33] rounded-2xl shadow-xl border border-slate-200 dark:border-[#142C52] p-8">
        {/* Biometric login button — only if device has registered passkey */}
        {webAuthnSupported && passkeyAvailable && (
          <div className="mb-5">
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-[#0066FF]/40 bg-[#0066FF]/5 hover:bg-[#0066FF]/10 text-[#0066FF] rounded-lg font-bold text-sm transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
              aria-label="Entrar com biometria — impressão digital ou Face ID"
            >
              {biometricLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Fingerprint className="w-5 h-5" />
                  Entrar com biometria
                </>
              )}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-[#142C52]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-[#081A33] px-2 text-slate-400">ou use senha</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div role="alert" className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 dark:border-[#142C52] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF] sm:text-sm bg-slate-50 dark:bg-[#061326] text-slate-900 dark:text-white"
              placeholder="seu@email.com"
            />
          </div>

          {/* Password field with eye toggle */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Senha
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3.5 py-2.5 pr-11 border border-slate-300 dark:border-[#142C52] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF] sm:text-sm bg-slate-50 dark:bg-[#061326] text-slate-900 dark:text-white"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none focus:text-[#0066FF] transition-colors"
                tabIndex={0}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Eye className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-[#0066FF] hover:bg-[#0052CC] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0066FF] disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
          </button>
        </form>

        {/* WebAuthn supported but no passkey yet — show info after login */}
        {webAuthnSupported && !passkeyAvailable && (
          <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
            💡 Após entrar, você pode ativar login por biometria (impressão digital / Face ID)
          </p>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#142C52]/60 text-center text-xs text-slate-500 dark:text-slate-400">
          <span>Sistema privado com acesso restrito a clientes autorizados.</span>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-slate-400">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  )
}
