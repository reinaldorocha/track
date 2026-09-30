# Arquitetura Mobile do UTM-Track (Android & iOS)

Este documento detalha a arquitetura do aplicativo móvel do **UTM-Track**, configurado com **Capacitor**, empacotamento nativo para **Android** e **iOS**, sistema de **Push Notifications**, **Haptics** e **Identidade Sonora Oficial**.

---

## 1. Visão Geral

- **ID do Pacote (App ID):** `com.utmtrack.app`
- **Nome do App:** UTM-Track
- **Plataformas Nativas Suportadas:**
  - Android (Gradle 8+, Android SDK 24+, Android 14/15 Support)
  - iOS (Xcode 15+, iOS 16+, Swift Package Manager)
- **Lógica e Backend:** Compartilhado diretamente com a aplicação Next.js e banco de dados SQLite/Postgres. Não há duplicação de lógica de regras de negócio.

---

## 2. Plugins Nativos Integrados

| Plugin | Finalidade | Configuração |
|---|---|---|
| `@capacitor/push-notifications` | Registro de tokens APNs / FCM e recebimento em background/foreground | Canais dedicados de som e vibração |
| `@capacitor/local-notifications` | Disparo de alertas locais em resposta a eventos webhooks e testes | Sons proprietários em `res/raw/` |
| `@capacitor/haptics` | Vibração nativa de sucesso, alerta e aviso | Respostas táteis sincronizadas |

---

## 3. Identidade Sonora e Recursos Nativos

Os arquivos de áudio oficiais do UTM-Track estão localizados em:
- Web: `public/sounds/`
- Android: `android/app/src/main/res/raw/`
- iOS: `ios/App/App/`

### Catálogo de Sons:
1. `som_venda_aprovada.wav`: Arpejo ascendente e brilhante com harmônicos metálicos (experiência de dinheiro e recompensa).
2. `som_pix_gerado.wav`: Chime duplo suave indicando expectativa de confirmação de pagamento.
3. `som_reembolso.wav`: Tom de aviso descendente e sutil.
4. `som_chargeback.wav`: Alerta duplo de urgência e atenção imediata.

---

## 4. Como Compilar os Aplicativos Nativos

### Para Android:
```bash
# 1. Sincronizar assets web e plugins
npx cap sync android

# 2. Abrir no Android Studio
npx cap open android

# 3. Gerar APK ou AAB de Produção
# No Android Studio: Build > Generate Signed Bundle / APK
```

### Para iOS:
```bash
# 1. Sincronizar assets web e plugins
npx cap sync ios

# 2. Abrir no Xcode (macOS)
npx cap open ios

# 3. Gerar Archive para TestFlight / App Store
# No Xcode: Product > Archive
```

---

## 5. Permissões Configuradas no `AndroidManifest.xml`
- `INTERNET`: Comunicação com a API do UTM-Track.
- `POST_NOTIFICATIONS`: Exibição de notificações a partir do Android 13 (API 33).
- `VIBRATE`: Resposta háptica e vibração de alertas.
- `WAKE_LOCK`: Despertar de tela para notificações sonoras de venda.
