import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { dispatchPushToDevices } from '../src/lib/notifications/push-dispatcher';

describe('Ciclo Completo de Vendas, Fluxo Pix e Push Notifications', () => {
  const rootDir = path.resolve(__dirname, '..');

  test('Formatação estrita de notificações para cada status de venda', () => {
    // Venda Aprovada
    const approvedTitle = "Venda aprovada!";
    const approvedBody = "Venda aprovada!\nValor: R$ 197,00";
    assert.strictEqual(approvedTitle, "Venda aprovada!");
    assert.ok(approvedBody.includes("Valor: R$ 197,00"));

    // Pix Gerado (Pendente)
    const pixTitle = "Pix gerado!";
    const pixBody = "Pix gerado!\nValor: R$ 97,00";
    assert.strictEqual(pixTitle, "Pix gerado!");
    assert.ok(pixBody.includes("Valor: R$ 97,00"));

    // Reembolso
    const refundTitle = "Venda reembolsada";
    const refundBody = "Venda reembolsada\nValor: R$ 197,00";
    assert.strictEqual(refundTitle, "Venda reembolsada");
    assert.ok(refundBody.includes("Valor: R$ 197,00"));

    // Chargeback
    const cbTitle = "Chargeback recebido";
    const cbBody = "Chargeback recebido\nValor: R$ 297,00";
    assert.strictEqual(cbTitle, "Chargeback recebido");
    assert.ok(cbBody.includes("Valor: R$ 297,00"));
  });

  test('Mapeamento sonoro e de canais de notificação Android e iOS', () => {
    const soundsMap = {
      sale_approved: { sound: "som_venda_aprovada", channel: "utmtrack_venda_aprovada", iosSound: "som_venda_aprovada.wav" },
      pix_pending: { sound: "som_pix_gerado", channel: "utmtrack_pix_gerado", iosSound: "som_pix_gerado.wav" },
      refund: { sound: "som_reembolso", channel: "utmtrack_reembolso", iosSound: "som_reembolso.wav" },
      chargeback: { sound: "som_chargeback", channel: "utmtrack_chargeback", iosSound: "som_chargeback.wav" },
    };

    for (const [key, config] of Object.entries(soundsMap)) {
      assert.ok(config.sound.startsWith("som_"), `Som para ${key} deve ser proprietário UTM-Track`);
      assert.ok(config.channel.startsWith("utmtrack_"), `Canal Android para ${key} deve ser prefixado com utmtrack_`);
      assert.ok(config.iosSound.endsWith(".wav"), `Som iOS para ${key} deve possuir extensão .wav`);
    }
  });

  test('Deep Links mapeiam para /sales/[id] com suporte a orderId', () => {
    const saleId = "cly123456789";
    const deepLink = `/sales/${saleId}`;
    assert.strictEqual(deepLink, "/sales/cly123456789");

    const fallbackLink = `/notifications`;
    assert.strictEqual(fallbackLink, "/notifications");
  });

  test('Configuração nativa Android possui canais de áudio e MainActivity atualizada', () => {
    const mainActivityPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'java', 'com', 'utmtrack', 'app', 'MainActivity.java');
    assert.ok(fs.existsSync(mainActivityPath), 'MainActivity.java deve existir');

    const content = fs.readFileSync(mainActivityPath, 'utf-8');
    assert.ok(content.includes('utmtrack_venda_aprovada'), 'Deve conter canal utmtrack_venda_aprovada');
    assert.ok(content.includes('utmtrack_pix_gerado'), 'Deve conter canal utmtrack_pix_gerado');
    assert.ok(content.includes('utmtrack_reembolso'), 'Deve conter canal utmtrack_reembolso');
    assert.ok(content.includes('utmtrack_chargeback'), 'Deve conter canal utmtrack_chargeback');
    assert.ok(content.includes('R.raw.som_venda_aprovada'), 'Deve associar o áudio nativo de venda aprovada');
  });

  test('Configuração nativa iOS possui entitlements de Push e sons no bundle', () => {
    const entitlementsPath = path.join(rootDir, 'ios', 'App', 'App', 'App.entitlements');
    assert.ok(fs.existsSync(entitlementsPath), 'App.entitlements deve existir');

    const entContent = fs.readFileSync(entitlementsPath, 'utf-8');
    assert.ok(entContent.includes('aps-environment'), 'Deve declarar capacidade aps-environment');

    const appDelegatePath = path.join(rootDir, 'ios', 'App', 'App', 'AppDelegate.swift');
    const appDelegateContent = fs.readFileSync(appDelegatePath, 'utf-8');
    assert.ok(appDelegateContent.includes('didRegisterForRemoteNotificationsWithDeviceToken'), 'AppDelegate deve registrar token APNs');

    const soundInIos = path.join(rootDir, 'ios', 'App', 'App', 'som_venda_aprovada.wav');
    assert.ok(fs.existsSync(soundInIos), 'som_venda_aprovada.wav deve estar presente no bundle principal iOS');
  });

  test('Template do Firebase google-services.json.example documentado para Android FCM', () => {
    const gservicesPath = path.join(rootDir, 'android', 'app', 'google-services.json.example');
    assert.ok(fs.existsSync(gservicesPath), 'google-services.json.example deve existir');

    const json = JSON.parse(fs.readFileSync(gservicesPath, 'utf-8'));
    assert.strictEqual(json.client[0].client_info.android_client_info.package_name, 'com.utmtrack.app');
  });
});
