# UTM-Track — SaaS de Tracking, Atribuição Meta Ads e Gestão Financeira

Plataforma profissional e multi-tenant de rastreamento de anúncios Meta Ads, UTMs, sessões, atribuição de vendas e gestão financeira operacional.

---

## 🚀 Visão Geral e Funcionalidades

- **Tracking Próprio**: Script JavaScript ultra-leve (`public/tracker.js`) não bloqueante para instalação em landing pages e páginas de vendas.
- **Captura Automática**: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `fbp`, `fbc`, referrer, landing page e ID de sessão.
- **Atribuição Multi-nível**: Motor Last-Click com pontuação de confiança (fbclid > fbp > sessionId > utmCampaign) relacionando Anúncio → Clique → Sessão → Checkout → Venda.
- **Meta Ads Integration (Graph API v21.0)**:
  - Suporte a múltiplas contas de anúncio por workspace sem limites artificiais.
  - Sincronização hierárquica automática e manual: Contas → Campanhas → Conjuntos → Anúncios.
  - Sincronização de Insights oficiais: Gasto, Impressões, Alcance, Cliques, CTR, CPC, CPM, Frequência, Conversões.
- **Meta Conversions API (CAPI) & Pixel**:
  - Envio de eventos server-side via Graph API v21.0 com hash seguro SHA-256 para dados de usuário (`em`, `ph`).
  - Suporte à deduplicação via `event_id`.
  - Gerador de código embed para páginas de checkout e vendas.
- **Conectores de Vendas & Webhooks com Idempotência**:
  - **Hotmart**: Processamento de pagamentos aprovados, pendentes, reembolsos e cancelamentos com validação de token `hottok`.
  - **Shopify**: Validação de HMAC-SHA256, tópicos `orders/paid`, `refunds/create`, `orders/cancelled`.
  - **Yampi**: Webhooks de status de pedido e metadados de UTMs.
  - **Cacto**: Conector de pedidos e webhook para status de compra.
  - **Webhook Genérico**: Endpoints exclusivos por workspace com mapeamento customizável e ferramenta visual de teste.
- **Dashboard Financeiro e Gestão**:
  - Cálculo de Faturamento Bruto, Faturamento Líquido, Investimento, Vendas, CPA, CPC, CTR, CPM, CPI, ROAS, ROI, Lucro e Margem.
  - Gestão de Despesas com categorias e recorrências (único, mensal, anual).
  - Gestão de Taxas de gateway e plataformas (percentuais e fixas).
  - Proteção contra divisão por zero em todas as métricas.
- **Aplicativo Mobile Real (Android & iOS)**:
  - Empacotamento nativo via **Capacitor** (`com.utmtrack.app`).
  - Projetos Android (`android/`) e iOS (`ios/`) totalmente estruturados.
  - Suporte a Push Notifications em background/fechado e vibração háptica nativa.
  - Barra de navegação móvel ergonômica com contador de alertas em tempo real.
- **Identidade Sonora Oficial UTM-Track**:
  - Áudios WAV proprietários de alta fidelidade sintetizados em 44.1kHz:
    1. `som_venda_aprovada.wav`: Notificação triunfante de venda confirmada ("cha-ching").
    2. `som_pix_gerado.wav`: Chime duplo suave de expectativa de pagamento.
    3. `som_reembolso.wav`: Tom descendente de aviso e saída de caixa.
    4. `som_chargeback.wav`: Alerta sonoro duplo urgente de disputa.
- **Central de Notificações e Preferências**:
  - Painel interativo com filtros por categoria (Vendas, Pix, Reembolsos, Alertas).
  - Testador de sons e vibração diretamente na interface.
  - Configurações granulares de alertas por usuário e workspace.
- **Identidade Visual e Experiência**:
  - Logo e símbolo vetoriais próprios com paleta ciano, azul elétrico, navy dark e estados semânticos (verde sucesso, vermelho erro).
  - Ícone de app, favicon SVG e Web App Manifest integrados.
  - Gráficos Recharts e funil de conversão visual.
  - 100% responsivo para Desktop, Tablet e Mobile.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
|---|---|
| **Framework Fullstack** | Next.js 16 (App Router) + TypeScript |
| **Mobile Nativo** | Capacitor (Android SDK + iOS Xcode) |
| **Estilização** | Tailwind CSS + Lucide React |
| **Banco de Dados** | SQLite (Dev) / PostgreSQL (Prod) |
| **ORM** | Prisma 5.22 |
| **Autenticação** | NextAuth.js v5 (Auth.js) |
| **Push Notifications & Haptics** | @capacitor/push-notifications & @capacitor/haptics |
| **Identidade Sonora** | Web Audio API + HTML5 Audio + Android Raw Resources |
| **Criptografia** | Node.js `crypto` (AES-256-GCM + SHA-256) |
| **Testes** | Node Test Runner + TSX |

---

## ⚙️ Instalação e Execução

### 1. Clonar e Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env.local` e `.env`:
```bash
cp .env.example .env.local
cp .env.example .env
```

### 3. Sincronizar o Banco de Dados
```bash
npm run db:push
```

### 4. Popular o Banco com Dados de Demonstração (Opcional)
```bash
npm run db:seed
```
*Credenciais de acesso criadas:*
- **E-mail:** `demo@utmtrack.com`
- **Senha:** `senha123456`

### 5. Executar em Modo de Desenvolvimento
```bash
npm run dev
```
Acesse em: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Testes Automatizados

O projeto conta com suite de testes completa validando todas as regras de negócio:
```bash
npm test
```
**Testes inclusos:**
- Cálculos de CPA, CPC, CTR, CPM, CPI, ROAS, ROI, Lucro, Margem e divisão por zero.
- Captura e formatação de parâmetros UTM, `fbclid`, cookies `_fbp` e `_fbc`.
- Motor de atribuição Last-Click e pontuação de confiança.
- Normalização de webhooks (Hotmart, Shopify, Yampi, Cacto).
- Chaves de idempotência para prevenir eventos duplicados.

Para verificar a integridade de tipos:
```bash
npm run type-check
```

Para gerar o build de produção:
```bash
npm run build
```

---

## 🔒 Segurança

- **Criptografia em Repouso**: Todos os tokens do Meta Ads e chaves de API são criptografados com **AES-256-GCM** antes de serem salvos no banco.
- **Proteção no Frontend**: Tokens sensíveis nunca são expostos no client-side; tokens salvos são mascarados (`••••••••••••B1c2`).
- **Idempotência**: Webhooks possuem chaves únicas no formato `{plataforma}_{idExterno}_{status}`, garantindo que nenhuma venda seja processada duas vezes.
- **Isolamento Multi-tenant**: Toda consulta e mutação de dados é filtrada pelo `workspaceId` do usuário autenticado.

---

## 📚 Documentação Complementar

- [ARCHITECTURE.md](ARCHITECTURE.md) — Arquitetura de software e multi-tenant.
- [INTEGRATIONS.md](INTEGRATIONS.md) — Guias de configuração de Meta Ads, Hotmart, Shopify, Yampi e Cacto.
- [TRACKING.md](TRACKING.md) — Funcionamento do tracker.js, cookies e CAPI.
- [DATABASE.md](DATABASE.md) — Diagrama de entidades e dicionário de dados Prisma.
