import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'
import { encrypt } from '@/lib/encryption'
import { MetaApiClient } from '@/lib/meta/client'
import {
  verifyOAuthState,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getMetaRedirectUri,
} from '@/lib/meta/oauth'


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const errorReason = searchParams.get('error_reason')

  // 1. Tratar cancelamento ou negação de permissão pelo usuário na Meta
  if (error || !code) {
    const reason = errorDescription || errorReason || error || 'Autorização cancelada ou código ausente'
    return NextResponse.redirect(
      new URL(`/meta-ads?error=${encodeURIComponent(reason)}`, request.url)
    )
  }

  // 2. Validação criptográfica do state (CSRF / Workspace binding)
  const stateVerification = verifyOAuthState(state)
  if (!stateVerification.valid) {
    return NextResponse.redirect(
      new URL(
        `/meta-ads?error=${encodeURIComponent(stateVerification.error || 'State de segurança inválido')}`,
        request.url
      )
    )
  }

  // 3. Obter sessão autenticada ou usar identificador do state validado
  const session = await auth()
  const userId = session?.user?.id || stateVerification.userId
  if (!userId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const workspaceId =
    stateVerification.workspaceId || (await getUserWorkspaceId(userId))
  if (!workspaceId) {
    return NextResponse.redirect(new URL('/meta-ads?error=no_workspace', request.url))
  }

  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL('/meta-ads?error=meta_not_configured', request.url)
    )
  }

  const redirectUri = getMetaRedirectUri(request)


  try {
    // 4. Troca de code por short-lived token
    const { accessToken: shortToken } = await exchangeCodeForToken(
      code,
      redirectUri,
      appId,
      appSecret
    )

    // 5. Troca por Long-Lived Token (~60 dias de validade)
    const { accessToken: longLivedToken } = await exchangeForLongLivedToken(
      shortToken,
      appId,
      appSecret
    )

    // 6. Buscar contas de anúncios associadas ao usuário na Meta
    const metaClient = new MetaApiClient(longLivedToken)
    const adAccounts = await metaClient.getAdAccounts()

    // 7. Criptografar o token para repouso seguro no banco (AES-256-GCM)
    const accessTokenEnc = encrypt(longLivedToken)
    let metaUserInfo = null
    try {
      metaUserInfo = await metaClient.getMe()
    } catch {}

    // 8. Persistir contas encontradas no workspace
    for (const acc of adAccounts) {
      await prisma.adAccount.upsert({
        where: {
          workspaceId_externalId: {
            workspaceId,
            externalId: acc.id,
          },
        },
        update: {
          name: acc.name || acc.id,
          currency: acc.currency || 'BRL',
          timezone: acc.timezone_name || 'America/Sao_Paulo',
          status: 'active',
          accessTokenEnc,
          metaUserId: metaUserInfo?.id || null,
        },
        create: {
          workspaceId,
          externalId: acc.id,
          name: acc.name || acc.id,
          currency: acc.currency || 'BRL',
          timezone: acc.timezone_name || 'America/Sao_Paulo',
          status: 'active',
          accessTokenEnc,
          metaUserId: metaUserInfo?.id || null,
        },
      })
    }

    // 9. Redireciona para /meta-ads com modal de seleção e confirmação
    return NextResponse.redirect(
      new URL('/meta-ads?status=oauth_success&select_accounts=true', request.url)
    )
  } catch (err: unknown) {
    const errorDetail =
      err instanceof Error
        ? err.message
        : 'Falha durante o processamento do callback Meta'
    console.error('Meta OAuth callback error:', err)
    return NextResponse.redirect(
      new URL(`/meta-ads?error=${encodeURIComponent(errorDetail)}`, request.url)
    )
  }
}

