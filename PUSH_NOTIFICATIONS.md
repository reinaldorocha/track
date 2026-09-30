# Sistema de Push Notifications do UTM-Track

Este documento descreve o funcionamento, segurança e fluxo de dados do sistema de **Push Notifications** do UTM-Track.

---

## 1. Fluxo de Vida das Notificações

```
        Webhook Gateway (Hotmart/Shopify/Yampi/Cacto)
                              │
                              ▼
        Upsert Sale & Deduplicação por Chave Única
                              │
                              ▼
    Verificação de Preferências do Usuário (Workspace)
                              │
                              ▼
        Registro no Banco de Dados (Notification)
                              │
                              ▼
   Disparo Push Nativos (Android / iOS / Web) + Áudio
                              │
                              ▼
 Central de Notificações Atualizada em Tempo Real
```

---

## 2. Tipos de Notificações e Sons Oficiais

1. **Venda Aprovada (`sale_approved`)**
   - **Título:** "Venda aprovada!"
   - **Corpo:** "Venda aprovada! 💰\nValor: R$ 151,04 | Plataforma: Hotmart"
   - **Som:** `som_venda_aprovada.wav`
   - **Severidade:** `success`

2. **Pix Gerado (`pix_pending`)**
   - **Título:** "Pix gerado!"
   - **Corpo:** "Pix gerado!\nValor: R$ 151,04 | Status: Pendente de pagamento"
   - **Som:** `som_pix_gerado.wav`
   - **Severidade:** `info`

3. **Venda Pendente (`sale_pending`)**
   - **Título:** "Venda pendente!"
   - **Corpo:** "Venda pendente!\nValor: R$ 151,04 | Origem: Shopify"
   - **Som:** `som_pix_gerado.wav`
   - **Severidade:** `info`

4. **Reembolso (`refund`)**
   - **Título:** "Venda reembolsada"
   - **Corpo:** "Venda reembolsada\nValor: R$ 151,04 | Produto: Curso Meta Ads"
   - **Som:** `som_reembolso.wav`
   - **Severidade:** `warning`

5. **Chargeback (`chargeback`)**
   - **Título:** "Chargeback recebido"
   - **Corpo:** "Chargeback recebido\nValor: R$ 151,04 | Plataforma: Yampi"
   - **Som:** `som_chargeback.wav`
   - **Severidade:** `error`

---

## 3. Segurança e Isolamento Multi-Tenant

- As notificações são rigidamente associadas ao `workspaceId`.
- Dispositivos registrados pertencem a um workspace específico (`Device.workspaceId`). É estritamente impossível que vendas de um workspace gerem push para dispositivos de outro workspace.
- Nenhuma chave de API de push ou credencial privada é armazenada no client-side.

---

## 4. Endpoints REST de Notificação

- `GET /api/notifications`: Lista as notificações do workspace ativo com contagem de não-lidas.
- `PATCH /api/notifications`: Marca notificações individuais ou todas como lidas (`readAt`).
- `DELETE /api/notifications`: Remove notificações do workspace.
- `GET /api/devices`: Lista dispositivos registrados no workspace.
- `POST /api/devices`: Registra ou renova token de push de um dispositivo móvel.
- `DELETE /api/devices`: Desativa um token de dispositivo desinstalado.
- `GET /api/notifications/preferences`: Consulta opções de alertas, som e vibração do usuário.
- `PUT /api/notifications/preferences`: Atualiza preferências de recebimento por categoria.
- `POST /api/notifications/test`: Dispara notificação de teste simulada com áudio e vibração.
