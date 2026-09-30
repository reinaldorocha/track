# Documentação Técnica de Tracking & Atribuição — UTM-Track

## 1. Central de Configuração de Rastreamento (Hub)

A área de **UTMs & Tracking** (`/integrations/utm`) atua como a central de configuração técnica do UTM-Track, unificando em um único painel:
1. **Script de Rastreamento da Página de Venda** (Tracker ultraleve < 3KB)
2. **Meta Pixel & Conversions API (CAPI)** com criptografia AES-256-GCM
3. **Parâmetros Dinâmicos para Anúncios Meta Ads**
4. **Webhooks Oficiais de Gateways de Pagamento** (Hotmart, Cakto, Yampi, Shopify, Genérico)
5. **Painel de Diagnóstico em Tempo Real** e Testes Automatizados

---

## 2. O Script de Tracking (`public/tracker.js`)

O `tracker.js` é um script vanilla JavaScript ultra-leve (< 3KB), autônomo, não dependente de bibliotecas externas e projetado para nunca travar a renderização da página (carregamento assíncrono via atributo `async`).

### Instalação Unificada na Página de Vendas (Landing Page)
Para o fluxo **Anúncio → Página de Vendas → Checkout → Fim (sem página de obrigado)**, cole apenas este único script no `<head>` da sua Landing Page:

```html
<script 
  src="https://SEU-DOMINIO-TRACK/tracker.js" 
  data-api-url="https://SEU-DOMINIO-TRACK" 
  data-workspace-id="ID_DO_SEU_WORKSPACE" 
  data-pixel-id="ID_NUMERICO_DO_META_PIXEL" 
  async
></script>
```

#### O que o Script Unificado faz automaticamente:
1. **Carrega o SDK Oficial da Meta (`fbevents.js`)**: Injeta a tag do SDK da Meta de forma segura e assíncrona caso ainda não exista no documento.
2. **Inicializa o Pixel com Segurança**: Chama `fbq('init', pixelId)` uma única vez, sem disparar PageView genérico duplo.
3. **Disparos Sincronizados com Deduplicação (`trackSingle`)**: Dispara `PageView` no carregamento e `InitiateCheckout` no clique de qualquer botão/link de checkout tanto no navegador (`fbq('trackSingle', ...)`) quanto no servidor (`/api/tracking/event` → CAPI) com o **mesmo `event_id`**.
4. **Resiliência a AdBlockers**: Se o SDK da Meta for bloqueado ou falhar na rede, a página continua funcionando normalmente: UTMs são salvas por 30 dias, checkouts são decorados e os eventos continuam sendo entregues via CAPI pelo servidor.
5. **Prevenção de Duplicação**: Se o script for incluído mais de uma vez na página, a execução subsequente é interrompida silenciosamente via `window.__utmTrackLoaded`.
6. **Modo Externo / GTM (`data-auto-pixel="false"`)**: Se você já gerencia o Pixel via Google Tag Manager (GTM) ou apps do construtor, adicione `data-auto-pixel="false"` para desativar o carregamento do SDK. Certifique-se de coordenar ou desativar o disparo de PageView padrão do construtor para evitar duplicações no Meta Events Manager.

### Fluxo sem Página de Obrigado (Checkout Direto)
Quando o checkout não redireciona para uma página de obrigado sua, a compra (`Purchase`) é confirmada **exclusivamente no servidor**:
1. O `tracker.js` decora o link do checkout com `_utmt_sid`, `_utmt_vid`, `fbclid`, `_fbp`, `_fbc` e UTMs.
2. O webhook da plataforma (Kiwify, Hotmart, Eduzz, etc.) avisa o UTM-Track da venda aprovada.
3. O UTM-Track processa a venda e dispara o evento `Purchase` diretamente para a Meta via Conversions API (CAPI) utilizando o token criptografado do workspace.

### Instalação na Página de Obrigado (Apenas se houver página de confirmação no domínio próprio)
Caso utilize página de obrigado própria no seu domínio:
```html
<script 
  src="https://SEU-DOMINIO-TRACK/tracker.js" 
  data-api-url="https://SEU-DOMINIO-TRACK" 
  data-workspace-id="ID_DO_SEU_WORKSPACE" 
  data-pixel-id="ID_NUMERICO_DO_META_PIXEL"
  data-platform="kiwify" <!-- ou "hotmart", "cakto", "yampi", "getfy", "shopify" -->
  async
></script>
```

---

## 3. Dados Capturados Automaticamente

Ao carregar em qualquer página, o script executa as seguintes etapas:

1. **Extração de UTMs**:
   - `utm_source` / `src`
   - `utm_medium`
   - `utm_campaign` / `sck`
   - `utm_content`
   - `utm_term`
   *Nota: Se o usuário navegar entre páginas do mesmo site, os parâmetros UTM são mantidos na `sessionStorage` para preservar a origem.*

2. **Identificadores Meta**:
   - `fbclid`: Identificador de clique único gerado pelo Meta Ads na URL (capturado automaticamente, sem necessidade de digitação manual).
   - `_fbp`: Cookie primário do Meta (formato `fb.1.{timestamp}.{random}`).
   - `_fbc`: Cookie de clique do Meta (formato `fb.1.{timestamp}.{fbclid}`).

3. **Gerenciamento de Sessão**:
   - `_utmt_sid`: Identificador único de sessão com expiração em 30 minutos de inatividade.
   - `_utmt_vid`: Identificador anônimo persistente do visitante.

4. **Detecção Automática de Checkouts**:
   - O script detecta automaticamente links e botões que direcionam para `pay.hotmart.com`, `checkout.cakto.com.br`, `yampi.io`, `myshopify.com` e dispara o evento `InitiateCheckout`.

5. **Disparo de Eventos Não-Bloqueantes**:
   - O script utiliza `navigator.sendBeacon` com fallback para `fetch(..., { keepalive: true })`. Dessa forma, mesmo que o usuário feche a página imediatamente, os dados de tracking continuam sendo transmitidos ao servidor.

---

## 4. Parâmetros Dinâmicos Recomendados para Meta Ads

Para identificar automaticamente a origem do clique diretamente nos anúncios do Meta Ads:

```text
utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&src={{site_source_name}}&sck={{campaign.name}}
```

### Instruções no Meta Ads Manager:
1. Abra o Gerenciador de Anúncios;
2. Edite o anúncio no nível de **Anúncio**;
3. Localize o campo **Parâmetros da URL**;
4. Cole a string acima e publique.
5. *Nota:* O parâmetro `fbclid` é anexado automaticamente pelo Meta Ads no clique e capturado pelo script.

---

## 5. Meta Pixel & Conversions API (CAPI)

- **Browser Pixel + Server-Side CAPI**: Envio híbrido para máxima taxa de recuperação de conversões no iOS 14.5+.
- **Deduplicação**: Baseada no campo `event_id`. Quando o evento é recebido no navegador e posteriormente no servidor via webhook, o Meta deduplica automaticamente.
- **Segurança de Tokens**: O Access Token da CAPI é armazenado com criptografia `AES-256-GCM` no banco de dados e nunca é transmitido ou exibido no frontend (apenas mascarado `••••••••••••1234`).

---

## 6. Regras do Motor de Atribuição (Last-Click)

Quando uma venda chega via webhook de qualquer plataforma (Hotmart, Cakto, Yampi, Shopify, Genérico), o sistema executa `attemptAttribution(saleId)`:

| Prioridade | Método de Matching | Confiança | Descrição |
|---|---|---|---|
| **1ª** | `fbclid` | 100% | O ID de clique do anúncio bate exatamente com a sessão registrada. |
| **2ª** | `_fbp` | 90% | O cookie do navegador bate com a sessão do usuário. |
| **3ª** | `sessionId` | 85% | O ID da sessão do checkout bate com a sessão do lead. |
| **4ª** | `utm_campaign` | 50% | A campanha bate com a última campanha acessada pelo lead. |

Se nenhum identificador confiável for encontrado, a venda **não** é atribuída forçadamente, preservando a integridade e precisão dos dados do dashboard.

---

## 7. Isolamento de Eventos de Teste (Hotmart e Simulações)

- Eventos sintéticos de teste enviados por ferramentas de postback da Hotmart são identificados pela função `isHotmartTestEvent` e registrados exclusivamente na Central de Eventos com status `TEST_ISOLATED`.
- **Garantia Financeira**: Eventos de teste não geram `Sale` financeira real, não afetam Faturamento Bruto, Líquido, Lucro, CPA, ROAS ou ROI, e não disparam notificações Push reais.
