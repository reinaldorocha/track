const fs = require('fs');
const path = require('path');

const publicDir = path.join(process.cwd(), 'public');

// 1. Symbol SVG (Vector Mark: Intersecting Precision Tracking Geometry with Cyan/Blue Glow)
const symbolSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <defs>
    <linearGradient id="utmt_grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="utmt_glow" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#60a5fa" stop-opacity="0.3" />
    </linearGradient>
    <filter id="utmt_shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0284c7" flood-opacity="0.35" />
    </filter>
  </defs>
  <rect x="6" y="6" width="88" height="88" rx="22" fill="#090d16" stroke="#1e293b" stroke-width="2" />
  <path d="M22 72 L44 32 L56 50 L78 24" stroke="url(#utmt_glow)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M26 36 L50 20 L74 36 L74 54 L50 78 L26 54 Z" fill="url(#utmt_grad1)" filter="url(#utmt_shadow)" fill-opacity="0.9" />
  <circle cx="50" cy="46" r="7" fill="#ffffff" />
  <circle cx="50" cy="46" r="13" stroke="#38bdf8" stroke-width="2.5" stroke-opacity="0.8" stroke-dasharray="3 3" />
</svg>`;

fs.writeFileSync(path.join(publicDir, 'symbol.svg'), symbolSvg, 'utf8');

// 2. Full Logo SVG with Wordmark
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80" fill="none">
  <defs>
    <linearGradient id="logo_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>
  </defs>
  <g transform="translate(8, 8)">
    <rect x="0" y="0" width="64" height="64" rx="16" fill="#090d16" stroke="#1e293b" stroke-width="1.5" />
    <path d="M14 46 L28 26 L36 36 L50 18" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-opacity="0.6" />
    <path d="M18 26 L32 16 L46 26 L46 38 L32 52 L18 38 Z" fill="url(#logo_grad)" />
    <circle cx="32" cy="33" r="4.5" fill="#ffffff" />
  </g>
  <text x="86" y="46" font-family="system-ui, -apple-system, sans-serif" font-size="27" font-weight="800" fill="#0f172a">
    UTM<tspan fill="#0284c7">-</tspan><tspan fill="#0284c7">Track</tspan>
  </text>
  <text x="88" y="61" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="600" letter-spacing="1.5" fill="#64748b">
    ATRIBUIÇÃO &amp; GESTÃO
  </text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'logo.svg'), logoSvg, 'utf8');
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), symbolSvg, 'utf8');

// 3. Web App Manifest for PWA and Mobile Installation
const manifest = {
  name: 'UTM-Track',
  short_name: 'UTM-Track',
  description: 'Tracking, Atribuição Meta Ads e Gestão Financeira',
  start_url: '/dashboard',
  display: 'standalone',
  background_color: '#090d16',
  theme_color: '#0284c7',
  icons: [
    {
      src: '/symbol.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any maskable'
    }
  ]
};
fs.writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('Brand files generated successfully');
