#!/usr/bin/env node
/* Gera ícones do Android (launcher, adaptativo, redondo) e telas de splash a partir de www/assets/icon.svg.
 * Uso: node tools/gen-icons.js   (requer Playwright/Chromium) */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const svg = fs.readFileSync(path.join(__dirname, '..', 'www', 'assets', 'icon.svg'), 'utf8');
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  async function render(html, w, h, out, transparent) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent('<html><body style="margin:0;background:transparent">' + html + '</body></html>');
    await page.screenshot({ path: out, omitBackground: !!transparent, clip: { x: 0, y: 0, width: w, height: h } });
  }
  const full = (s, round) => `<div style="width:${s}px;height:${s}px;${round ? 'border-radius:50%;overflow:hidden;' : ''}">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div>`;
  // primeiro plano adaptativo: só a moeda, dentro da zona segura (66/108)
  const fg = (s) => {
    const inner = Math.round(s * 0.62), off = Math.round((s - inner) / 2);
    const coinOnly = svg.replace(/<rect width="512" height="512"[^>]*\/>/, '');
    return `<div style="width:${s}px;height:${s}px;position:relative"><div style="position:absolute;left:${off}px;top:${off}px">${coinOnly.replace('<svg ', `<svg width="${inner}" height="${inner}" viewBox="66 66 380 380" `).replace('viewBox="0 0 512 512"', '')}</div></div>`;
  };
  for (const [d, k] of Object.entries(DENS)) {
    const dir = path.join(RES, 'mipmap-' + d);
    fs.mkdirSync(dir, { recursive: true });
    await render(full(Math.round(48 * k)), Math.round(48 * k), Math.round(48 * k), path.join(dir, 'ic_launcher.png'), true);
    await render(full(Math.round(48 * k), true), Math.round(48 * k), Math.round(48 * k), path.join(dir, 'ic_launcher_round.png'), true);
    await render(fg(Math.round(108 * k)), Math.round(108 * k), Math.round(108 * k), path.join(dir, 'ic_launcher_foreground.png'), true);
  }
  // splash
  const splashDirs = fs.readdirSync(RES).filter(n => n.startsWith('drawable')).map(n => path.join(RES, n, 'splash.png')).filter(f => fs.existsSync(f));
  for (const f of splashDirs) {
    const { w, h } = pngSize(f);
    const s = Math.round(Math.min(w, h) * 0.38);
    await render(`<div style="width:${w}px;height:${h}px;background:radial-gradient(120% 70% at 50% 30%,#3b1f7a,#140b2b);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif">
      ${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}
      <div style="color:#ffc93c;font-weight:900;font-size:${Math.round(s * 0.22)}px;margin-top:${Math.round(s * 0.12)}px">Cifrópolis</div>
      <div style="color:#b3a8dc;font-weight:700;font-size:${Math.round(s * 0.09)}px;margin-top:${Math.round(s * 0.03)}px">do zero ao império</div></div>`, w, h, f);
  }
  await browser.close();
  // fundo do ícone adaptativo
  fs.writeFileSync(path.join(RES, 'values', 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2E1468</color>\n</resources>\n');
  console.log('Ícones e splash gerados em', RES);
})();
