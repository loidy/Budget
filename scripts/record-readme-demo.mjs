import { createRequire } from 'node:module';
import { mkdir, rename, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Records docs/demo.gif from the local app. Seed first:
 *   docker compose exec web npx tsx scripts/seed-readme-demo.ts
 * Then:
 *   npx playwright install chromium
 *   node scripts/record-readme-demo.mjs
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadPlaywright() {
  const candidates = [
    path.join(ROOT, 'package.json'),
    '/tmp/pw-readme/package.json',
  ];
  for (const from of candidates) {
    try {
      return createRequire(from)('playwright');
    } catch {
      // try the next location
    }
  }
  throw new Error(
    'Playwright is not installed. Run `npm i -D playwright && npx playwright install chromium`.'
  );
}

const { chromium } = loadPlaywright();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.DEMO_EMAIL ?? 'maya@example.com';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-readme-2026';
const VIEWPORT = { width: 1280, height: 800 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function installChrome(page) {
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = `
      * { scrollbar-width: none !important; }
      *::-webkit-scrollbar { display: none !important; }
      .animate-ping { animation: none !important; }
      nextjs-portal, [data-next-badge-root], [data-nextjs-dev-indicator] {
        display: none !important;
      }
      #demo-cursor {
        position: fixed;
        z-index: 2147483646;
        width: 28px;
        height: 28px;
        pointer-events: none;
        left: 0;
        top: 0;
        transform: translate(-3px, -2px);
        filter: drop-shadow(0 2px 2px rgba(15, 23, 42, 0.5));
        transition: transform 70ms ease-out;
      }
      #demo-cursor.is-down { transform: translate(-3px, -2px) scale(0.86); }
      #demo-caption:empty { opacity: 0; padding: 0; }
      #demo-caption {
        position: fixed;
        z-index: 2147483645;
        left: 50%;
        bottom: 18px;
        transform: translateX(-50%);
        background: #1d4ed8;
        color: #fff;
        font: 600 13px/1.3 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: 0.01em;
        padding: 9px 16px;
        border-radius: 999px;
        box-shadow: 0 10px 28px rgba(29, 78, 216, 0.35);
        pointer-events: none;
        white-space: nowrap;
      }
    `;
    document.documentElement.appendChild(style);
  });
}

async function attachChrome(page) {
  await page.evaluate(() => {
    const hideNext = () => {
      document.querySelectorAll('nextjs-portal').forEach((el) => el.remove());
    };
    hideNext();
    new MutationObserver(hideNext).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    if (document.getElementById('demo-cursor')) return;
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.style.cssText =
      'position:fixed;z-index:2147483646;width:28px;height:28px;pointer-events:none;left:0;top:0;transform:translate(-3px,-2px);filter:drop-shadow(0 2px 2px rgba(15,23,42,.5));';
    cursor.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><path fill="#0f172a" stroke="#fff" stroke-width="1.6" d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.85a.5.5 0 0 0-.85.36Z"/></svg>';
    const caption = document.createElement('div');
    caption.id = 'demo-caption';
    caption.style.cssText =
      'position:fixed;z-index:2147483645;left:50%;bottom:18px;transform:translateX(-50%);background:#1d4ed8;color:#fff;font:600 13px/1.3 ui-sans-serif,system-ui,sans-serif;padding:9px 16px;border-radius:999px;box-shadow:0 10px 28px rgba(29,78,216,.35);pointer-events:none;white-space:nowrap;display:none;';
    document.body.appendChild(cursor);
    document.body.appendChild(caption);
    window.addEventListener(
      'mousemove',
      (event) => {
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      },
      { passive: true }
    );
    window.addEventListener('mousedown', () => cursor.classList.add('is-down'));
    window.addEventListener('mouseup', () => cursor.classList.remove('is-down'));
  });
}

async function caption(page, text) {
  await page.evaluate((next) => {
    const node = document.getElementById('demo-caption');
    if (!node) return;
    node.textContent = next;
    node.style.display = next ? 'block' : 'none';
  }, text);
}

async function moveToBox(page, box, offsetX = 0.5, offsetY = 0.5) {
  if (!box) return;
  await page.mouse.move(box.x + box.width * offsetX, box.y + box.height * offsetY, { steps: 18 });
}

async function clickLocator(page, locator) {
  const box = await locator.first().boundingBox();
  await moveToBox(page, box);
  await sleep(180);
  await locator.first().click({ force: true });
}

async function login(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: 'en-US',
    colorScheme: 'light',
  });
  await context.addCookies([{ name: 'locale', value: 'en', url: BASE }]);
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 20_000 });
  await page.waitForSelector('text=Oak Street Home');
  const statePath = path.join(ROOT, 'docs/.demo-state.json');
  await context.storageState({ path: statePath });
  await context.close();
  return statePath;
}

async function main() {
  const tmpDir = path.join(ROOT, 'docs/.demo-frames');
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });

  const statePath = await login(browser);
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: 'en-US',
    colorScheme: 'light',
    storageState: statePath,
    recordVideo: { dir: tmpDir, size: VIEWPORT },
    deviceScaleFactor: 1,
  });
  await context.addCookies([
    { name: 'locale', value: 'en', url: BASE },
  ]);

  const page = await context.newPage();
  await installChrome(page);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Oak Street Home');
  await attachChrome(page);
  await page.waitForSelector('#demo-caption', { state: 'attached' });
  await sleep(400);

  await caption(page, 'Project daily cash flow across accounts');
  await sleep(700);

  const chart = page.locator('rect.cursor-crosshair').first();
  await chart.waitFor({ state: 'visible' });
  const chartBox = await chart.boundingBox();
  if (chartBox) {
    await page.mouse.move(chartBox.x + chartBox.width * 0.12, chartBox.y + chartBox.height * 0.45, {
      steps: 16,
    });
    for (const t of [0.22, 0.34, 0.46, 0.58, 0.7, 0.82]) {
      await page.mouse.move(
        chartBox.x + chartBox.width * t,
        chartBox.y + chartBox.height * (0.42 + Math.sin(t * 8) * 0.08),
        { steps: 12 }
      );
      await sleep(220);
    }
  }

  const nav = page.locator('header nav');

  await caption(page, "This month's plan, with paid items and one-offs");
  await clickLocator(page, nav.getByRole('button', { name: 'Plan', exact: true }));
  await page.locator('table tbody tr', { hasText: 'Rent' }).first().waitFor();
  await sleep(1600);

  await caption(page, 'One catalog of recurring income and expenses');
  await clickLocator(page, nav.getByRole('button', { name: 'Expenses and income' }));
  await page.locator('table tbody tr', { hasText: 'Rent' }).first().waitFor();
  await sleep(1600);

  await caption(page, 'Labels route items onto the right account');
  await clickLocator(page, nav.getByRole('button', { name: 'Accounts and labels' }));
  await page.getByText('Subscriptions').first().waitFor();
  await sleep(1400);

  await caption(page, 'Household and business budgets, side by side');
  await clickLocator(page, nav.getByRole('button', { name: 'Overview', exact: true }));
  await page.getByRole('heading', { name: 'Projection', exact: true }).waitFor();
  await sleep(500);
  await clickLocator(page, page.getByRole('button', { name: 'Northwind Studio' }));
  await page.getByText('Freelance practice: retainers, tools, and tax reserve').waitFor();
  await sleep(1600);

  const studioChart = page.locator('rect.cursor-crosshair').first();
  const studioBox = await studioChart.boundingBox();
  if (studioBox) {
    await page.mouse.move(studioBox.x + studioBox.width * 0.2, studioBox.y + studioBox.height * 0.4, {
      steps: 14,
    });
    await page.mouse.move(studioBox.x + studioBox.width * 0.72, studioBox.y + studioBox.height * 0.38, {
      steps: 20,
    });
    await sleep(700);
  }

  await caption(page, '');
  await sleep(400);

  const video = page.video();
  await page.close();
  const videoPath = await video.path();
  await context.close();
  await browser.close();

  const gifPath = path.join(ROOT, 'docs/demo.gif');
  const encoded = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      videoPath,
      '-vf',
      'fps=10,scale=1100:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=full[p];[s1][p]paletteuse=dither=none',
      gifPath,
    ],
    { stdio: 'inherit' }
  );
  if (encoded.status !== 0) {
    throw new Error(`ffmpeg failed with status ${encoded.status}`);
  }

  const tmpGif = `${gifPath}.opt.gif`;
  const optimized = spawnSync('convert', [gifPath, '-layers', 'Optimize', tmpGif], {
    stdio: 'inherit',
  });
  if (optimized.status === 0) {
    await rm(gifPath, { force: true });
    await rename(tmpGif, gifPath);
  }

  console.log(gifPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
