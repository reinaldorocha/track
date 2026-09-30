import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT_DIR = path.resolve(__dirname, '..');
const BRAND_SOURCE_DIR = path.join(ROOT_DIR, 'UTM-Track_Identidade_Visual');
const PUBLIC_BRAND_DIR = path.join(ROOT_DIR, 'public', 'brand');

async function main() {
  console.log('--- Setting up UTM-Track Official Brand Identity ---');

  // 1. Ensure target directories exist
  const dirs = [
    path.join(PUBLIC_BRAND_DIR, 'logo'),
    path.join(PUBLIC_BRAND_DIR, 'icons'),
    path.join(PUBLIC_BRAND_DIR, 'app'),
    path.join(PUBLIC_BRAND_DIR, 'notifications'),
    path.join(PUBLIC_BRAND_DIR, 'guidelines'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 2. Identify key source files
  const lightLogoSrc = path.join(BRAND_SOURCE_DIR, 'a_clean_white_background_logo_branding_image_wide.png');
  const darkLogoSrc = path.join(BRAND_SOURCE_DIR, 'a_clean_high_resolution_dark_themed_branding_log.png');
  const appIconSrc = path.join(BRAND_SOURCE_DIR, 'a_clean_graphic_design_app_icon_style_image_a_d.png');
  const notifIconSrc = path.join(BRAND_SOURCE_DIR, 'a_clean_high_resolution_app_notification_icon_sty.png');
  const paletteSrc = path.join(BRAND_SOURCE_DIR, 'a_clean_modern_brand_style_guide_poster_palette.png');
  const typoSrc = path.join(BRAND_SOURCE_DIR, 'a_clean_modern_brand_guideline_poster_typography.png');
  const brandKitSrc = path.join(BRAND_SOURCE_DIR, 'wide_clean_modern_brand_style_guide_poster_for.png');

  // 3. Copy official guideline posters
  if (fs.existsSync(paletteSrc)) {
    fs.copyFileSync(paletteSrc, path.join(PUBLIC_BRAND_DIR, 'guidelines', 'brand-palette-guide.png'));
  }
  if (fs.existsSync(typoSrc)) {
    fs.copyFileSync(typoSrc, path.join(PUBLIC_BRAND_DIR, 'guidelines', 'brand-typography-guide.png'));
  }
  if (fs.existsSync(brandKitSrc)) {
    fs.copyFileSync(brandKitSrc, path.join(PUBLIC_BRAND_DIR, 'guidelines', 'brand-overview-guide.png'));
  }

  // 4. Process Logos
  console.log('Processing logos...');
  if (fs.existsSync(lightLogoSrc)) {
    fs.copyFileSync(lightLogoSrc, path.join(PUBLIC_BRAND_DIR, 'logo', 'logo-light-full.png'));
    // Also generate an optimized web version
    await sharp(lightLogoSrc)
      .resize({ width: 1200, withoutEnlargement: true })
      .png({ quality: 95 })
      .toFile(path.join(PUBLIC_BRAND_DIR, 'logo', 'logo-light.png'));
  }

  if (fs.existsSync(darkLogoSrc)) {
    fs.copyFileSync(darkLogoSrc, path.join(PUBLIC_BRAND_DIR, 'logo', 'logo-dark-full.png'));
    await sharp(darkLogoSrc)
      .resize({ width: 1200, withoutEnlargement: true })
      .png({ quality: 95 })
      .toFile(path.join(PUBLIC_BRAND_DIR, 'logo', 'logo-dark.png'));
  }

  // 5. Process App & Notification Icons
  console.log('Processing App and Notification icons...');
  if (fs.existsSync(appIconSrc)) {
    fs.copyFileSync(appIconSrc, path.join(PUBLIC_BRAND_DIR, 'app', 'app-icon-source.png'));
    
    // Master app icon
    await sharp(appIconSrc)
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toFile(path.join(PUBLIC_BRAND_DIR, 'app', 'app-icon-1024.png'));

    // Web & PWA icons
    await sharp(appIconSrc)
      .resize(512, 512, { fit: 'cover' })
      .png()
      .toFile(path.join(PUBLIC_BRAND_DIR, 'app', 'icon-512.png'));
    fs.copyFileSync(path.join(PUBLIC_BRAND_DIR, 'app', 'icon-512.png'), path.join(ROOT_DIR, 'public', 'icon-512.png'));

    await sharp(appIconSrc)
      .resize(192, 192, { fit: 'cover' })
      .png()
      .toFile(path.join(PUBLIC_BRAND_DIR, 'app', 'icon-192.png'));
    fs.copyFileSync(path.join(PUBLIC_BRAND_DIR, 'app', 'icon-192.png'), path.join(ROOT_DIR, 'public', 'icon-192.png'));

    await sharp(appIconSrc)
      .resize(180, 180, { fit: 'cover' })
      .png()
      .toFile(path.join(PUBLIC_BRAND_DIR, 'app', 'apple-touch-icon.png'));
    fs.copyFileSync(path.join(PUBLIC_BRAND_DIR, 'app', 'apple-touch-icon.png'), path.join(ROOT_DIR, 'public', 'apple-touch-icon.png'));

    // Favicon sizes
    await sharp(appIconSrc)
      .resize(32, 32, { fit: 'cover' })
      .png()
      .toFile(path.join(ROOT_DIR, 'public', 'favicon-32x32.png'));

    await sharp(appIconSrc)
      .resize(16, 16, { fit: 'cover' })
      .png()
      .toFile(path.join(ROOT_DIR, 'public', 'favicon-16x16.png'));

    await sharp(appIconSrc)
      .resize(48, 48, { fit: 'cover' })
      .png()
      .toFile(path.join(ROOT_DIR, 'public', 'favicon.png'));

    // Symbol png
    await sharp(appIconSrc)
      .resize(256, 256, { fit: 'cover' })
      .png()
      .toFile(path.join(PUBLIC_BRAND_DIR, 'icons', 'symbol.png'));
  }

  if (fs.existsSync(notifIconSrc)) {
    fs.copyFileSync(notifIconSrc, path.join(PUBLIC_BRAND_DIR, 'notifications', 'notification-icon.png'));
    await sharp(notifIconSrc)
      .resize(96, 96, { fit: 'cover' })
      .png()
      .toFile(path.join(PUBLIC_BRAND_DIR, 'notifications', 'notification-badge-96.png'));
  }

  // 6. Copy to native Android & iOS paths if existing
  const androidResDir = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(androidResDir) && fs.existsSync(appIconSrc)) {
    console.log('Generating Android native mipmap launcher icons...');
    const mipmaps = [
      { dir: 'mipmap-mdpi', size: 48 },
      { dir: 'mipmap-hdpi', size: 72 },
      { dir: 'mipmap-xhdpi', size: 96 },
      { dir: 'mipmap-xxhdpi', size: 144 },
      { dir: 'mipmap-xxxhdpi', size: 192 },
    ];
    for (const m of mipmaps) {
      const targetDir = path.join(androidResDir, m.dir);
      if (fs.existsSync(targetDir)) {
        await sharp(appIconSrc)
          .resize(m.size, m.size, { fit: 'cover' })
          .png()
          .toFile(path.join(targetDir, 'ic_launcher.png'));
        await sharp(appIconSrc)
          .resize(m.size, m.size, { fit: 'cover' })
          .png()
          .toFile(path.join(targetDir, 'ic_launcher_round.png'));
        await sharp(appIconSrc)
          .resize(m.size, m.size, { fit: 'cover' })
          .png()
          .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
      }
    }
  }

  const iosAppIconDir = path.join(ROOT_DIR, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  if (fs.existsSync(iosAppIconDir) && fs.existsSync(appIconSrc)) {
    console.log('Generating iOS native AppIcon...');
    await sharp(appIconSrc)
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toFile(path.join(iosAppIconDir, 'AppIcon-512@2x.png'));
  }

  console.log('✅ Visual identity assets organized and processed successfully.');
}

main().catch((err) => {
  console.error('Error organizing visual identity assets:', err);
  process.exit(1);
});
