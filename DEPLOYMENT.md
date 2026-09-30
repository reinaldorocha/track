# Guia Oficial de Publicação em Produção — UTM-Track

Este guia detalha o passo a passo completo para colocar o **UTM-Track** em produção na **Vercel** com **PostgreSQL**, configurar domínio **HTTPS**, integrar os webhooks dos gateways de pagamento e publicar os aplicativos móveis nativos (**Android** e **iOS**).

---

## 1. Arquitetura de Produção

```
[ Usuários / Lojas Virtuais ] 
          │
          ▼
   [ Domínio HTTPS ] (ex: app.seudominio.com)
          │
          ▼
   [ Vercel Edge / Serverless ] (Next.js 16 + React 19)
          │
          ├─────────────────────────┬──────────────────────────┐
          ▼                         ▼                          ▼
 [ Banco PostgreSQL ]       [ Push FCM / APNs ]      [ Meta Ads API v21 ]
 (Supabase / Neon / RDS)     (Android & iOS)          (Graph API & CAPI)
```

---

## 2. Passo a Passo de Deploy na Vercel

### Passo 1: Preparar o Banco de Dados PostgreSQL
1. Crie uma instância PostgreSQL em um provedor gerenciado como:
   - **Neon:** https://neon.tech
   - **Supabase:** https://supabase.com
   - **Vercel Postgres:** Painel da Vercel → Storage → Postgres
   - **AWS RDS** ou **DigitalOcean Managed Databases**
2. Obtenha a string de conexão no formato:
   ```
   postgresql://usuario:senha@host:5432/utmtrack?sslmode=require
   ```

### Passo 2: Importar o Projeto na Vercel
1. Acesse o dashboard da Vercel (https://vercel.com) e clique em **Add New Project**.
2. Conecte o repositório Git do **UTM-Track**.
3. **Framework Preset:** o repositório contém um `vercel.json` que fixa `"framework": "nextjs"`,
   `buildCommand` e `installCommand`. Esse arquivo **sobrescreve** qualquer valor do painel, então
   o projeto sempre será construído como **Next.js (App Router)**, mesmo que a detecção automática falhe.
4. **Root Directory:** deve permanecer **vazio** (raiz do repositório). Não aponte para nenhuma subpasta.
5. **Não** ative o *Override* de *Output Directory* / *Build Command* no painel — o `vercel.json` já cuida disso.

> ⚠️ **Sintoma de configuração errada:** se o domínio de produção responder
> `404: NOT_FOUND` (página de erro da própria Vercel) em **todas** as rotas — inclusive `/`,
> `/login` e `/api/health` — significa que a Vercel está servindo apenas a pasta estática `public/`
> porque o Framework Preset ficou como **"Other"**. Solução: garantir que o `vercel.json` deste
> repositório esteja no commit implantado e, no painel, **Settings → Build & Deployment →
> Framework Preset = Next.js** (com os *Overrides* de Build Command e Output Directory **desligados**).
> Depois clique em **Redeploy**.

### Passo 3: Configurar as Variáveis de Ambiente na Vercel
No painel **Settings → Environment Variables**, adicione as seguintes variáveis:

#### Obrigatórias:
| Variável | Descrição | Exemplo |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | URL pública definitiva HTTPS | `https://app.seudominio.com` |
| `NEXTAUTH_URL` | URL base do NextAuth | `https://app.seudominio.com` |
| `NEXTAUTH_SECRET` | Chave de assinatura JWT (32+ chars) | `openssl rand -base64 32` |
| `AUTH_SECRET` | Alias para NextAuth v5 | Mesmo valor de `NEXTAUTH_SECRET` |
| `AUTH_TRUST_HOST` | Confiança em headers de proxy da Vercel | `true` |
| `ENCRYPTION_KEY` | Chave de 32 bytes em hex (64 chars) | `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | URL do PostgreSQL de produção | `postgresql://...` |

#### Integrações e Gateways (Conforme Utilizados):
| Variável | Plataforma | Onde Obter |
|---|---|---|
| `META_APP_ID` | Meta Ads | developers.facebook.com → Meu Aplicativo |
| `META_APP_SECRET` | Meta Ads | developers.facebook.com → Configurações Básicas |
| `HOTMART_WEBHOOK_SECRET` | Hotmart | Hotmart → Ferramentas → Webhooks (Token hottok) |
| `SHOPIFY_WEBHOOK_SECRET` | Shopify | Shopify Admin → Configurações → Notificações |
| `YAMPI_WEBHOOK_SECRET` | Yampi | Painel Yampi → Webhooks |
| `CACTO_WEBHOOK_SECRET` | Cakto / Cacto | Painel Cakto → Integrações / Webhooks |
| `FCM_SERVER_KEY` | Android Push | Firebase Console → Cloud Messaging → Server Key |

### Passo 4: Sincronizar o Esquema com o PostgreSQL
Durante o build, o comando `vercel-build` (`node scripts/switch-database.js detect && prisma generate && next build`) detectará automaticamente a URL PostgreSQL e gerará o cliente correspondente. O `vercel.json` já força `buildCommand` para `npm run vercel-build`.

Para aplicar as tabelas pela primeira vez no banco PostgreSQL:
```bash
# Definir temporariamente a variável do banco de produção e aplicar o schema:
npx prisma db push --schema=prisma/schema.postgresql.prisma
```

---

## 3. Configuração de Domínio e HTTPS

1. No painel do seu projeto na Vercel, vá em **Settings → Domains**.
2. Adicione seu domínio ou subdomínio (ex: `app.seudominio.com`).
3. No seu provedor de DNS (Cloudflare, Registro.br, GoDaddy, Hostinger), crie o registro apontado pela Vercel:
   - Tipo: `CNAME`
   - Nome: `app`
   - Destino: `cname.vercel-dns.com`
4. A Vercel emitirá o certificado SSL/TLS (HTTPS) automaticamente em poucos minutos.

---

## 4. URLs de Webhook para Configurar nos Gateways

Após a publicação do seu domínio, cadastre as seguintes URLs nos respectivos painéis:

| Gateway | Eventos Suportados | URL do Webhook |
|---|---|---|
| **Hotmart** | `PURCHASE_APPROVED`, `PURCHASE_PENDING` (Pix), `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK` | `https://app.seudominio.com/api/webhooks/hotmart` |
| **Shopify** | `orders/paid`, `orders/create`, `refunds/create`, `orders/cancelled` | `https://app.seudominio.com/api/webhooks/shopify` |
| **Yampi** | `payment_approved`, `pending` (Pix), `refunded`, `chargeback` | `https://app.seudominio.com/api/webhooks/yampi` |
| **Cakto** | `approved`, `pending` (Pix), `refunded`, `chargeback` | `https://app.seudominio.com/api/webhooks/cacto` |
| **Genérico** | Normalização automática de payloads customizados | `https://app.seudominio.com/api/webhooks/generic/{endpointId}` |

---

## 5. Instalação do Tracker nas Páginas de Vendas

Cole a tag no `<head>` ou antes de fechar o `</body>` de suas páginas:

```html
<script 
  src="https://app.seudominio.com/tracker.js" 
  data-api-url="https://app.seudominio.com" 
  data-workspace-id="SEU_WORKSPACE_ID" 
  async
></script>
```

---

## 6. Publicação dos Aplicativos Mobile

### Android (Google Play Store):
1. Acesse o **Firebase Console** e crie um projeto para `com.utmtrack.app`.
2. Baixe o arquivo oficial `google-services.json` e coloque em:
   `android/app/google-services.json`
3. Sincronize e gere o pacote de release:
   ```bash
   npx cap sync android
   cd android
   ./gradlew bundleRelease
   ```
4. O arquivo `.aab` gerado em `android/app/build/outputs/bundle/release/` está pronto para envio na Google Play Console.

### iOS (Apple App Store / TestFlight):
1. No **Apple Developer Portal**, habilite as capacidades de **Push Notifications** e **Background Modes** no App ID `com.utmtrack.app`.
2. Sincronize o projeto:
   ```bash
   npx cap sync ios
   npx cap open ios
   ```
3. No Xcode:
   - Selecione seu Team de desenvolvimento em Signing & Capabilities.
   - Execute **Product → Archive**.
   - Clique em **Distribute App** para enviar diretamente ao TestFlight / App Store Connect.