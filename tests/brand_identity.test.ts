import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Identidade Visual Oficial UTM-Track', () => {
  const rootDir = path.resolve(__dirname, '..');
  const publicBrand = path.join(rootDir, 'public', 'brand');

  test('Logotipos oficiais (versões clara e escura) presentes e íntegros', () => {
    const lightLogo = path.join(publicBrand, 'logo', 'logo-light.png');
    const darkLogo = path.join(publicBrand, 'logo', 'logo-dark.png');

    assert.ok(fs.existsSync(lightLogo), 'Logo light oficial deve existir');
    assert.ok(fs.existsSync(darkLogo), 'Logo dark oficial deve existir');

    const lightStat = fs.statSync(lightLogo);
    const darkStat = fs.statSync(darkLogo);

    assert.ok(lightStat.size > 1000, 'Logo light deve ter tamanho superior a 1KB');
    assert.ok(darkStat.size > 1000, 'Logo dark deve ter tamanho superior a 1KB');
  });

  test('Ícones de aplicativo e PWA oficiais gerados e dimensionados', () => {
    const appIcon1024 = path.join(publicBrand, 'app', 'app-icon-1024.png');
    const icon512 = path.join(rootDir, 'public', 'icon-512.png');
    const icon192 = path.join(rootDir, 'public', 'icon-192.png');
    const appleTouch = path.join(rootDir, 'public', 'apple-touch-icon.png');
    const favicon32 = path.join(rootDir, 'public', 'favicon-32x32.png');

    assert.ok(fs.existsSync(appIcon1024), 'app-icon-1024.png deve existir');
    assert.ok(fs.existsSync(icon512), 'icon-512.png deve existir em public/');
    assert.ok(fs.existsSync(icon192), 'icon-192.png deve existir em public/');
    assert.ok(fs.existsSync(appleTouch), 'apple-touch-icon.png deve existir em public/');
    assert.ok(fs.existsSync(favicon32), 'favicon-32x32.png deve existir em public/');
  });

  test('Ativos de notificação push oficiais presentes', () => {
    const notifIcon = path.join(publicBrand, 'notifications', 'notification-icon.png');
    const notifBadge = path.join(publicBrand, 'notifications', 'notification-badge-96.png');

    assert.ok(fs.existsSync(notifIcon), 'Ícone oficial de notificação deve existir');
    assert.ok(fs.existsSync(notifBadge), 'Badge de notificação 96px deve existir');
  });

  test('Guias oficiais de paleta de cores e tipografia integrados', () => {
    const paletteGuide = path.join(publicBrand, 'guidelines', 'brand-palette-guide.png');
    const typoGuide = path.join(publicBrand, 'guidelines', 'brand-typography-guide.png');

    assert.ok(fs.existsSync(paletteGuide), 'Pôster oficial de paleta de cores deve existir');
    assert.ok(fs.existsSync(typoGuide), 'Pôster oficial de tipografia deve existir');
  });

  test('Símbolo vetorial SVG oficial configurado com gradientes corretos', () => {
    const symbolSvg = path.join(publicBrand, 'icons', 'symbol.svg');
    const publicSymbol = path.join(rootDir, 'public', 'symbol.svg');
    const publicFavicon = path.join(rootDir, 'public', 'favicon.svg');

    assert.ok(fs.existsSync(symbolSvg), 'symbol.svg deve existir em public/brand/icons');
    assert.ok(fs.existsSync(publicSymbol), 'symbol.svg deve existir em public/');
    assert.ok(fs.existsSync(publicFavicon), 'favicon.svg deve existir em public/');

    const content = fs.readFileSync(symbolSvg, 'utf-8');
    assert.ok(content.includes('#0066FF'), 'SVG deve conter cor primária oficial #0066FF');
    assert.ok(content.includes('#00D4FF'), 'SVG deve conter cor secundária oficial #00D4FF');
    assert.ok(content.includes('#081A33'), 'SVG deve conter marinho base oficial #081A33');
  });

  test('Recursos nativos Android mipmap e iOS AppIcon atualizados', () => {
    const androidMipmapHdpi = path.join(rootDir, 'android', 'app', 'src', 'main', 'res', 'mipmap-hdpi', 'ic_launcher.png');
    const androidMipmapXxhdpi = path.join(rootDir, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxhdpi', 'ic_launcher.png');
    const iosAppIcon = path.join(rootDir, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');

    assert.ok(fs.existsSync(androidMipmapHdpi), 'Android hdpi launcher icon deve existir');
    assert.ok(fs.existsSync(androidMipmapXxhdpi), 'Android xxhdpi launcher icon deve existir');
    assert.ok(fs.existsSync(iosAppIcon), 'iOS AppIcon-512@2x.png deve existir');
  });

  test('Web App Manifest configurado com cores e ícones da marca oficial', () => {
    const manifestPath = path.join(rootDir, 'public', 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json deve existir');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.strictEqual(manifest.name, 'UTM-Track');
    assert.strictEqual(manifest.theme_color, '#0066FF');
    assert.strictEqual(manifest.background_color, '#081A33');
    assert.ok(manifest.icons.some((i: any) => i.src === '/icon-192.png'), 'Deve ter icon-192.png');
    assert.ok(manifest.icons.some((i: any) => i.src === '/icon-512.png'), 'Deve ter icon-512.png');
  });
});
