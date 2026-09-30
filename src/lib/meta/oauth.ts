import crypto from 'crypto';
import axios from 'axios';

const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export const PRODUCTION_APP_URL = 'https://utm-track-navy.vercel.app';
export const META_OAUTH_SCOPES = 'ads_read,ads_management,business_management';

/**
 * Resolve the canonical application base URL for OAuth callbacks and external integrations.
 */
export function getAppBaseUrl(request?: Request): string {
  // 1. Explicit environment variable
  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim() !== '') {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, '');
  }
  if (process.env.APP_URL && process.env.APP_URL.trim() !== '') {
    return process.env.APP_URL.trim().replace(/\/$/, '');
  }
  if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.trim() !== '') {
    return process.env.NEXTAUTH_URL.trim().replace(/\/$/, '');
  }

  // 2. Vercel System Production Domain
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL && process.env.VERCEL_PROJECT_PRODUCTION_URL.trim() !== '') {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim().replace(/\/$/, '')}`;
  }

  // 3. Fallback for production / Vercel runtime
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return PRODUCTION_APP_URL;
  }

  // 4. Request headers during local development
  if (request) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    if (host && !host.includes('vercel.app')) {
      return `${proto}://${host}`.replace(/\/$/, '');
    }
  }

  return 'http://localhost:3000';
}

/**
 * Resolve the exact OAuth callback URI for Meta Facebook Login.
 */
export function getMetaRedirectUri(request?: Request): string {
  const baseUrl = getAppBaseUrl(request);
  return `${baseUrl}/api/meta/callback`;
}

function getSigningSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.ENCRYPTION_KEY ||
    'utm_track_oauth_state_signing_key_2025'
  );
}


export interface OAuthStatePayload {
  userId: string;
  workspaceId: string;
  timestamp: number;
  nonce: string;
}

/**
 * Generate a cryptographically signed state token for Meta OAuth CSRF protection.
 */
export function generateOAuthState(userId: string, workspaceId: string): string {
  const payload: OAuthStatePayload = {
    userId,
    workspaceId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(12).toString('hex'),
  };

  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(serialized)
    .digest('base64url');

  return `${serialized}.${signature}`;
}

/**
 * Validate and unpack the OAuth state token.
 */
export function verifyOAuthState(stateString: string | null | undefined): {
  valid: boolean;
  userId?: string;
  workspaceId?: string;
  error?: string;
} {
  if (!stateString) {
    return { valid: false, error: 'State ausente' };
  }

  const parts = stateString.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Formato de state inválido' };
  }

  const [serialized, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(serialized)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature, 'utf8');
  const expBuffer = Buffer.from(expectedSignature, 'utf8');

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return { valid: false, error: 'Assinatura do state inválida (possível CSRF)' };
  }

  try {
    const payload: OAuthStatePayload = JSON.parse(
      Buffer.from(serialized, 'base64url').toString('utf8')
    );

    // Max 30 minutes validity
    const maxAge = 30 * 60 * 1000;
    if (Date.now() - payload.timestamp > maxAge) {
      return { valid: false, error: 'State expirado. Inicie o fluxo novamente.' };
    }

    return {
      valid: true,
      userId: payload.userId,
      workspaceId: payload.workspaceId,
    };
  } catch {
    return { valid: false, error: 'Falha ao decodificar payload do state' };
  }
}

/**
 * Exchange the authorization code for a short-lived user access token.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string
): Promise<{ accessToken: string; expiresIn?: number }> {
  const url = `${META_GRAPH_BASE}/oauth/access_token`;
  try {
    const response = await axios.get(url, {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
      timeout: 15000,
    });

    const accessToken = response.data?.access_token;
    if (!accessToken) {
      throw new Error('Meta não retornou access_token na troca de code');
    }

    return {
      accessToken,
      expiresIn: response.data?.expires_in,
    };
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const errorData = err.response?.data?.error;
      console.error('[Meta OAuth /oauth/access_token Diagnostic]', {
        status,
        code: errorData?.code,
        type: errorData?.type,
        message: errorData?.message,
        error_subcode: errorData?.error_subcode,
        redirectUriSent: redirectUri,
      });

      if (errorData?.message) {
        const subcodeInfo = errorData.error_subcode ? ` (subcode ${errorData.error_subcode})` : '';
        const codeInfo = errorData.code ? `[Code ${errorData.code}${subcodeInfo}] ` : '';
        throw new Error(`${codeInfo}${errorData.message}`);
      }
    }
    throw err;
  }
}

/**
 * Exchange a short-lived user access token for a long-lived user access token (~60 days).
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<{ accessToken: string; expiresIn?: number }> {
  try {
    const url = `${META_GRAPH_BASE}/oauth/access_token`;
    const response = await axios.get(url, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
      },
      timeout: 15000,
    });

    const accessToken = response.data?.access_token;
    if (accessToken) {
      return {
        accessToken,
        expiresIn: response.data?.expires_in,
      };
    }
  } catch (err: any) {
    console.warn('[Meta OAuth] Aviso ao obter long-lived token, mantendo token original:', err?.response?.data || err?.message);
  }

  // Fallback to original short-lived token if long-lived exchange is unavailable
  return { accessToken: shortLivedToken };
}

