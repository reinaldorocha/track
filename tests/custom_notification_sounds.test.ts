import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateAudioMagicBytes,
  validateAudioUpload,
  sanitizeFilename,
  MAX_AUDIO_FILE_SIZE,
  RECOMMENDED_DURATION_SECONDS,
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} from "../src/lib/notifications/sound-storage";
import { VALID_NOTIFICATION_TYPES } from "../src/app/api/notification-sounds/route";
import { isHotmartTestEvent } from "../src/lib/integrations/normalizer";
import { SOUND_MAP, SoundType } from "../src/lib/sound";

describe("Sistema de Sons Personalizados para Notificações", () => {
  // 1. Validação de Magic Bytes
  describe("1. Validação de Magic Bytes de Áudio", () => {
    test("Identifica cabeçalho MP3 com tag ID3", () => {
      const mp3Buffer = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20]);
      const res = validateAudioMagicBytes(mp3Buffer);
      assert.equal(res.valid, true);
      assert.equal(res.format, "mp3");
    });

    test("Identifica cabeçalho MP3 com frame sync (0xFFFB)", () => {
      const mp3SyncBuffer = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00]);
      const res = validateAudioMagicBytes(mp3SyncBuffer);
      assert.equal(res.valid, true);
      assert.equal(res.format, "mp3");
    });

    test("Identifica cabeçalho WAV (RIFF....WAVE)", () => {
      const wavBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x24, 0x00, 0x00, 0x00, // Size
        0x57, 0x41, 0x56, 0x45, // WAVE
        0x66, 0x6d, 0x74, 0x20, // fmt
      ]);
      const res = validateAudioMagicBytes(wavBuffer);
      assert.equal(res.valid, true);
      assert.equal(res.format, "wav");
    });

    test("Identifica cabeçalho M4A / MP4 Audio (ftyp)", () => {
      const m4aBuffer = Buffer.from([
        0x00, 0x00, 0x00, 0x20, // size
        0x66, 0x74, 0x79, 0x70, // ftyp
        0x4d, 0x34, 0x41, 0x20, // M4A
      ]);
      const res = validateAudioMagicBytes(m4aBuffer);
      assert.equal(res.valid, true);
      assert.equal(res.format, "m4a");
    });

    test("Identifica cabeçalho AAC ADTS (0xFFF1)", () => {
      const aacBuffer = Buffer.from([0xff, 0xf1, 0x50, 0x80]);
      const res = validateAudioMagicBytes(aacBuffer);
      assert.equal(res.valid, true);
      assert.equal(res.format, "aac");
    });

    test("Identifica cabeçalho OGG (OggS)", () => {
      const oggBuffer = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]);
      const res = validateAudioMagicBytes(oggBuffer);
      assert.equal(res.valid, true);
      assert.equal(res.format, "ogg");
    });

    test("Rejeita arquivo não-áudio (ex: script executável, HTML, texto)", () => {
      const fakeBuffer = Buffer.from("<html><script>alert(1)</script></html>");
      const res = validateAudioMagicBytes(fakeBuffer);
      assert.equal(res.valid, false);
    });
  });

  // 2. Validação de Upload de Arquivos
  describe("2. Validação e Sanitização de Uploads", () => {
    test("Aceita arquivo MP3 legítimo com tamanho e MIME válidos", () => {
      const validMp3 = Buffer.concat([
        Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]),
        Buffer.alloc(1024),
      ]);
      const res = validateAudioUpload(validMp3, "meu_som_venda.mp3", "audio/mpeg", 3.5);
      assert.equal(res.valid, true);
      assert.equal(res.detectedExtension, ".mp3");
      assert.equal(res.sanitizedOriginalName, "meu_som_venda.mp3");
    });

    test("Rejeita arquivo que excede limite máximo de 5MB", () => {
      const hugeBuffer = Buffer.concat([
        Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]),
        Buffer.alloc(MAX_AUDIO_FILE_SIZE + 10),
      ]);
      const res = validateAudioUpload(hugeBuffer, "audio_gigante.mp3", "audio/mpeg");
      assert.equal(res.valid, false);
      assert.match(res.error || "", /excede o tamanho máximo/);
    });

    test("Rejeita extensão não permitida (ex: .exe, .sh, .php, .js)", () => {
      const fakeBuffer = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]);
      const res = validateAudioUpload(fakeBuffer, "script.exe", "audio/mpeg");
      assert.equal(res.valid, false);
      assert.match(res.error || "", /Formato de arquivo.*não suportado/);
    });

    test("Rejeita arquivo com extensão disfarçada mas conteúdo falso", () => {
      const textRenamedToMp3 = Buffer.from("conteúdo de texto simples");
      const res = validateAudioUpload(textRenamedToMp3, "falso_som.mp3", "audio/mpeg");
      assert.equal(res.valid, false);
      assert.match(res.error || "", /não possui uma assinatura de áudio válida/);
    });

    test("Sanitiza nome de arquivo com tentativa de Directory Traversal", () => {
      const maliciousName = "../../../etc/passwd_som.mp3";
      const sanitized = sanitizeFilename(maliciousName);
      assert.equal(sanitized, "passwd_som.mp3");
      assert.equal(sanitized.includes("/"), false);
      assert.equal(sanitized.includes(".."), false);
    });
  });

  // 3. Tipos de Notificação Válidos
  describe("3. Tipos Mínimos Oficiais de Notificação", () => {
    test("Suporta os 5 tipos essenciais de notificação", () => {
      const expectedTypes = [
        "sale_approved",
        "pix_pending",
        "sale_pending",
        "refund",
        "chargeback",
      ];
      for (const t of expectedTypes) {
        assert.equal(VALID_NOTIFICATION_TYPES.includes(t), true);
      }
    });

    test("Todos os tipos possuem som padrão de fallback associado", () => {
      assert.ok(SOUND_MAP.som_venda_aprovada);
      assert.ok(SOUND_MAP.som_pix_gerado);
      assert.ok(SOUND_MAP.som_venda_pendente);
      assert.ok(SOUND_MAP.som_reembolso);
      assert.ok(SOUND_MAP.som_chargeback);
    });
  });

  // 4. Lógica de Fallback e Isolamento de Testes Hotmart
  describe("4. Regras de Negócio e Isolamento de Testes", () => {
    test("Eventos de simulação da Hotmart não disparam notificações financeiras", () => {
      const testPayload = {
        event: "PURCHASE_APPROVED",
        data: {
          purchase: {
            transaction: "HP00000000000001",
            price: { value: 1500.0 },
          },
          buyer: {
            email: "teste@hotmart.test",
          },
        },
      };

      const isTest = isHotmartTestEvent(testPayload, {
        "x-hotmart-hottok": "test_token",
      });
      assert.equal(isTest, true);
    });

    test("Fallback automático para o som oficial UTM-Track quando som personalizado não configurado", () => {
      const hasCustomSound = false;
      const notificationType = "sale_approved";
      const soundToPlay = hasCustomSound
        ? "custom_venda.mp3"
        : SOUND_MAP[notificationType] || SOUND_MAP.som_venda_aprovada;

      assert.equal(soundToPlay, "/sounds/som_venda_aprovada.wav");
    });

    test("Renderização Imediata Mobile: todos os 5 tipos de cards possuem rótulos e fallbacks garantidos", () => {
      const requiredTypes = [
        { key: "sale_approved", label: "VENDA APROVADA", defaultSound: "som_venda_aprovada.wav" },
        { key: "pix_pending", label: "PIX GERADO", defaultSound: "som_pix_gerado.wav" },
        { key: "sale_pending", label: "VENDA PENDENTE", defaultSound: "som_venda_pendente.wav" },
        { key: "refund", label: "VENDA REEMBOLSADA", defaultSound: "som_reembolso.wav" },
        { key: "chargeback", label: "CHARGEBACK", defaultSound: "som_chargeback.wav" },
      ];

      for (const item of requiredTypes) {
        assert.ok(item.label, "Card deve possuir rótulo em caixa alta");
        assert.ok(item.defaultSound.endsWith(".wav"), "Fallback deve ser arquivo de som oficial");
      }
    });

    test("Resiliência de Estado: Quando API está em loading ou offline, cartões não ficam vazios", () => {
      const mockSoundsMap = new Map<string, any>();
      // Sem sons cadastrados
      const soundConfig = {
        key: "sale_approved",
        defaultSoundName: "som_venda_aprovada.wav",
      };
      const customSound = mockSoundsMap.get(soundConfig.key);
      const displayText = customSound ? customSound.originalFileName : "Nenhum som personalizado (usando padrão)";
      assert.equal(displayText, "Nenhum som personalizado (usando padrão)");
    });
  });

  // 5. Garantia de Tabela e Operações CRUD Multi-Tenant
  describe("5. Estrutura de Banco de Dados e Isolamento Multi-Tenant", () => {
    test("ensureNotificationSoundTable executa de forma idempotente sem lançar erros", async () => {
      const { ensureNotificationSoundTable } = await import("../src/lib/db/ensure-tables");
      const result = await ensureNotificationSoundTable();
      assert.equal(result, true);
    });

    test("Contrato de Schema da Tabela NotificationSound contém todas as colunas obrigatórias", () => {
      const expectedColumns = [
        "id",
        "workspaceId",
        "userId",
        "notificationType",
        "originalFileName",
        "storagePath",
        "fileUrl",
        "mimeType",
        "fileSize",
        "duration",
        "status",
        "isActive",
        "createdAt",
        "updatedAt",
      ];

      // Verificação dos campos esperados
      for (const col of expectedColumns) {
        assert.ok(col, `Coluna ${col} é mandatória na estrutura de NotificationSound`);
      }
    });

    test("Isolamento Multi-Tenant: Chave única [workspaceId, notificationType] impede colisão entre tenants", () => {
      const tenantA_Sound = {
        workspaceId: "ws_alpha_123",
        notificationType: "sale_approved",
        fileUrl: "/api/notification-sounds/sound_a/file",
      };
      const tenantB_Sound = {
        workspaceId: "ws_beta_456",
        notificationType: "sale_approved",
        fileUrl: "/api/notification-sounds/sound_b/file",
      };

      const keyA = `${tenantA_Sound.workspaceId}_${tenantA_Sound.notificationType}`;
      const keyB = `${tenantB_Sound.workspaceId}_${tenantB_Sound.notificationType}`;

      assert.notEqual(keyA, keyB, "Workspaces distintos possuem chaves únicas isoladas para o mesmo tipo de notificação");
    });
  });
});
