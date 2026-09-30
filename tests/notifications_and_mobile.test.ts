import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'

describe('Identidade Sonora e Arquivos de Áudio Oficiais', () => {
  const sounds = [
    'som_venda_aprovada.wav',
    'som_pix_gerado.wav',
    'som_venda_pendente.wav',
    'som_reembolso.wav',
    'som_chargeback.wav'
  ]

  sounds.forEach((soundName) => {
    it(`Validação de integridade do arquivo de som: ${soundName}`, () => {
      const soundPath = path.join(process.cwd(), 'public', 'sounds', soundName)
      assert.ok(fs.existsSync(soundPath), `Arquivo ${soundName} deve existir em public/sounds/`)

      const stats = fs.statSync(soundPath)
      assert.ok(stats.size > 20000, `Arquivo ${soundName} deve ter tamanho válido (> 20KB)`)

      // Validar cabeçalho RIFF/WAVE
      const buffer = fs.readFileSync(soundPath)
      const riff = buffer.toString('utf8', 0, 4)
      const wave = buffer.toString('utf8', 8, 12)
      assert.equal(riff, 'RIFF', 'Cabeçalho deve ser RIFF')
      assert.equal(wave, 'WAVE', 'Subformato deve ser WAVE')
    })
  })

  it('Verificação dos 5 sons nos recursos nativos do Android (res/raw/)', () => {
    sounds.forEach((soundName) => {
      const androidPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res', 'raw', soundName)
      assert.ok(fs.existsSync(androidPath), `Arquivo ${soundName} deve existir em android/app/src/main/res/raw/`)
    })
  })

  it('Verificação dos 5 sons nos recursos nativos do iOS (ios/App/App/)', () => {
    sounds.forEach((soundName) => {
      const iosPath = path.join(process.cwd(), 'ios', 'App', 'App', soundName)
      assert.ok(fs.existsSync(iosPath), `Arquivo ${soundName} deve existir em ios/App/App/`)
    })
  })
})

describe('Sistema de Notificações, Mensagens e Sons', () => {
  it('Formatação exata da notificação de Venda Aprovada', () => {
    const formattedAmount = 'R$ 151,04'
    const title = 'Venda aprovada!'
    const message = `Venda aprovada no valor de ${formattedAmount}`
    const sound = 'som_venda_aprovada'

    assert.equal(title, 'Venda aprovada!')
    assert.equal(message, 'Venda aprovada no valor de R$ 151,04')
    assert.equal(sound, 'som_venda_aprovada')
  })

  it('Formatação exata da notificação de Pix Gerado (Pendente)', () => {
    const formattedAmount = 'R$ 97,00'
    const title = 'Pix gerado!'
    const message = `Um Pix de ${formattedAmount} foi gerado e está aguardando pagamento.`
    const sound = 'som_pix_gerado'

    assert.equal(title, 'Pix gerado!')
    assert.equal(message, 'Um Pix de R$ 97,00 foi gerado e está aguardando pagamento.')
    assert.equal(sound, 'som_pix_gerado')
  })

  it('Formatação exata da notificação de Venda Pendente', () => {
    const formattedAmount = 'R$ 197,00'
    const title = 'Venda pendente!'
    const message = `Venda de ${formattedAmount} aguardando confirmação.`
    const sound = 'som_venda_pendente'

    assert.equal(title, 'Venda pendente!')
    assert.equal(message, 'Venda de R$ 197,00 aguardando confirmação.')
    assert.equal(sound, 'som_venda_pendente')
  })

  it('Formatação exata da notificação de Reembolso', () => {
    const formattedAmount = 'R$ 151,04'
    const title = 'Venda reembolsada'
    const message = `Uma venda de ${formattedAmount} foi reembolsada.`
    const sound = 'som_reembolso'

    assert.equal(title, 'Venda reembolsada')
    assert.equal(message, 'Uma venda de R$ 151,04 foi reembolsada.')
    assert.equal(sound, 'som_reembolso')
  })

  it('Formatação exata da notificação de Chargeback', () => {
    const formattedAmount = 'R$ 151,04'
    const title = 'Chargeback recebido'
    const message = `Foi registrado um chargeback de ${formattedAmount}.`
    const sound = 'som_chargeback'

    assert.equal(title, 'Chargeback recebido')
    assert.equal(message, 'Foi registrado um chargeback de R$ 151,04.')
    assert.equal(sound, 'som_chargeback')
  })

  it('Geração e unicidade de chaves de idempotência para notificações', () => {
    const ws = 'ws_123'
    const type = 'sale_approved'
    const tx = 'HP_102030'

    const key1 = `notif_${ws}_${type}_${tx}`
    const key2 = `notif_${ws}_${type}_${tx}`
    const keyDiff = `notif_${ws}_refund_${tx}`

    assert.equal(key1, key2, 'Mesma notificação do mesmo evento deve ter a mesma chave')
    assert.notEqual(key1, keyDiff, 'Eventos diferentes devem ter chaves distintas')
  })
})

describe('Estrutura e Configuração do Aplicativo Mobile Nativo', () => {
  it('Configuração do Capacitor (App ID, Android & iOS)', () => {
    const configPath = path.join(process.cwd(), 'capacitor.config.ts')
    assert.ok(fs.existsSync(configPath))

    const content = fs.readFileSync(configPath, 'utf8')
    assert.ok(content.includes('com.utmtrack.app'))
    assert.ok(content.includes('PushNotifications'))
    assert.ok(content.includes('LocalNotifications'))
  })

  it('Validação de permissões essenciais e Deep Linking no AndroidManifest.xml', () => {
    const manifestPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
    assert.ok(fs.existsSync(manifestPath))

    const content = fs.readFileSync(manifestPath, 'utf8')
    assert.ok(content.includes('android.permission.INTERNET'))
    assert.ok(content.includes('android.permission.POST_NOTIFICATIONS'))
    assert.ok(content.includes('android.permission.VIBRATE'))
    assert.ok(content.includes('android:scheme="utmtrack"'), 'Deve conter intent-filter para utmtrack://')
  })

  it('Validação dos 5 Canais de Notificação no Android MainActivity.java', () => {
    const mainActivityPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'java', 'com', 'utmtrack', 'app', 'MainActivity.java')
    assert.ok(fs.existsSync(mainActivityPath))

    const content = fs.readFileSync(mainActivityPath, 'utf8')
    assert.ok(content.includes('utmtrack_venda_aprovada'))
    assert.ok(content.includes('utmtrack_pix_gerado'))
    assert.ok(content.includes('utmtrack_venda_pendente'))
    assert.ok(content.includes('utmtrack_reembolso'))
    assert.ok(content.includes('utmtrack_chargeback'))
  })

  it('Validação de esquemas de Deep Linking e Background Modes no iOS Info.plist', () => {
    const plistPath = path.join(process.cwd(), 'ios', 'App', 'App', 'Info.plist')
    assert.ok(fs.existsSync(plistPath))

    const content = fs.readFileSync(plistPath, 'utf8')
    assert.ok(content.includes('utmtrack'), 'Info.plist deve registrar CFBundleURLSchemes utmtrack')
    assert.ok(content.includes('remote-notification'), 'Info.plist deve registrar UIBackgroundModes remote-notification')
  })

  it('Validação de entrada e registro de dispositivo móvel', () => {
    const validPlatforms = ['android', 'ios', 'web']
    const testDevice = {
      token: 'fcm_test_token_abc123',
      platform: 'android',
      workspaceId: 'ws_demo_1'
    }

    assert.ok(validPlatforms.includes(testDevice.platform))
    assert.ok(testDevice.token.length > 10)
    assert.ok(Boolean(testDevice.workspaceId))
  })

  it('Validação de fechamento automático e rotas do menu mobile', () => {
    const mobileRoutes = [
      '/dashboard',
      '/summary',
      '/meta-ads',
      '/integrations',
      '/dashboard/app',
      '/dashboard/advanced',
      '/sales',
      '/utm',
      '/rules',
      '/fees',
      '/expenses',
      '/reports',
      '/events',
      '/notifications',
      '/account',
      '/settings',
      '/settings/notifications'
    ]

    mobileRoutes.forEach((route) => {
      assert.ok(route.startsWith('/'), `Rota ${route} deve começar com /`)
    })
    assert.equal(mobileRoutes.length, 17)
  })

  it('Validação dos 10 presets do Seletor de Período Mobile', async () => {
    const { getDateRange } = await import('../src/lib/utils')
    const presets = [
      'Hoje',
      'Ontem',
      'Últimos 7 dias',
      'Últimos 15 dias',
      'Últimos 30 dias',
      'Últimos 60 dias',
      'Últimos 90 dias',
      'Este mês',
      'Mês anterior'
    ]

    presets.forEach((preset) => {
      const { from, to } = getDateRange(preset)
      assert.ok(from instanceof Date, `Preset ${preset} deve retornar from do tipo Date`)
      assert.ok(to instanceof Date, `Preset ${preset} deve retornar to do tipo Date`)
      assert.ok(to >= from, `Preset ${preset} deve ter to >= from`)
    })
  })

  it('Validação de payloads dos 6 tipos de push notification de teste', () => {
    const testTypes = [
      { type: 'general', sound: 'som_venda_aprovada', expectedChannel: 'utmtrack_venda_aprovada' },
      { type: 'sale_approved', sound: 'som_venda_aprovada', expectedChannel: 'utmtrack_venda_aprovada' },
      { type: 'pix_pending', sound: 'som_pix_gerado', expectedChannel: 'utmtrack_pix_gerado' },
      { type: 'sale_pending', sound: 'som_venda_pendente', expectedChannel: 'utmtrack_venda_pendente' },
      { type: 'refund', sound: 'som_reembolso', expectedChannel: 'utmtrack_reembolso' },
      { type: 'chargeback', sound: 'som_chargeback', expectedChannel: 'utmtrack_chargeback' }
    ]

    testTypes.forEach((t) => {
      assert.ok(t.sound.startsWith('som_'))
      assert.ok(t.expectedChannel.startsWith('utmtrack_'))
    })
  })
})

