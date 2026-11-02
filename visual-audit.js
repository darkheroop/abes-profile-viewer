'use strict';

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'laptop-1440x900', width: 1440, height: 900 },
  { name: 'standard-1366x768', width: 1366, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 }
];

async function runVisualAudit() {
  console.log('========================================================');
  console.log(' STARTING AUTOMATED VISUAL QUALITY CONTROL & AUDIT');
  console.log('========================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const auditReport = [];

  for (const vp of VIEWPORTS) {
    console.log(`--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });

    // Navigate to page with nointro for UI inspection
    await page.goto('http://localhost:3005/?nointro=true', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1200));

    // Heuristic layout checks
    const findings = await page.evaluate((vpWidth) => {
      const issues = [];

      // 1. Check for horizontal scroll / overflow
      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      if (scrollW > clientW + 1) {
        issues.push(`Horizontal overflow detected! scrollWidth: ${scrollW}px > clientWidth: ${clientW}px`);
      }

      // 2. Check header visibility & bounding rect
      const header = document.querySelector('.app-header');
      const headerRect = header ? header.getBoundingClientRect() : null;

      // 3. Check hero block bounding rect
      const hero = document.querySelector('.hero-block');
      const heroRect = hero ? hero.getBoundingClientRect() : null;

      // 4. Check form input & button rect
      const input = document.querySelector('#rollNumberInput');
      const inputRect = input ? input.getBoundingClientRect() : null;

      const btn = document.querySelector('#submitBtn');
      const btnRect = btn ? btn.getBoundingClientRect() : null;

      // 5. Overlap detection: does hero overlap input or button?
      if (heroRect && inputRect) {
        if (heroRect.bottom > inputRect.top) {
          issues.push(`OVERLAP BUG: Hero bottom (${heroRect.bottom}px) overlaps Input top (${inputRect.top}px)`);
        }
      }

      if (inputRect && btnRect) {
        if (inputRect.bottom > btnRect.top) {
          issues.push(`OVERLAP BUG: Input bottom (${inputRect.bottom}px) overlaps Button top (${btnRect.top}px)`);
        }
      }

      // 6. Minimum tap targets on mobile
      if (vpWidth <= 480) {
        const interactiveElements = document.querySelectorAll('button, a, input');
        interactiveElements.forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40)) {
            issues.push(`Small tap target: <${el.tagName.toLowerCase()} class="${el.className}"> is ${Math.round(r.width)}x${Math.round(r.height)}px (< 40px)`);
          }
        });
      }

      return {
        issues,
        headerBottom: headerRect ? headerRect.bottom : null,
        heroTop: heroRect ? heroRect.top : null,
        inputWidth: inputRect ? inputRect.width : null,
        btnWidth: btnRect ? btnRect.width : null
      };
    }, vp.width);

    // Save screenshot
    const shotPath = path.join(OUTPUT_DIR, `${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`  [SAVED] Screenshot: ${shotPath}`);

    if (findings.issues.length === 0) {
      console.log(`  [PASS] Clean layout, zero overlaps, zero horizontal overflow!`);
    } else {
      findings.issues.forEach(iss => console.error(`  [DEFECT] ${iss}`));
    }

    auditReport.push({ viewport: vp.name, ...findings });
    await page.close();
  }

  // Also test Intro Scene on Desktop
  console.log(`\n--- Testing Intro Scene Overlay on Desktop 1920x1080 ---`);
  const introPage = await browser.newPage();
  await introPage.setViewport({ width: 1920, height: 1080 });
  await introPage.goto('http://localhost:3005/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));

  const introShotPath = path.join(OUTPUT_DIR, 'intro-scene-1920x1080.png');
  await introPage.screenshot({ path: introShotPath });
  console.log(`  [SAVED] Intro Scene Screenshot: ${introShotPath}`);

  // Test Skip Intro Button
  await introPage.click('#skipIntroBtn');
  await new Promise(r => setTimeout(r, 600));

  const isOverlayHidden = await introPage.evaluate(() => {
    const overlay = document.querySelector('#cinematicIntroOverlay');
    const style = window.getComputedStyle(overlay);
    return style.display === 'none' || overlay.classList.contains('dismissed');
  });

  if (isOverlayHidden) {
    console.log(`  [PASS] Skip Intro successfully dismissed overlay!`);
  } else {
    console.error(`  [FAIL] Overlay still visible after Skip Intro!`);
  }

  const postSkipShotPath = path.join(OUTPUT_DIR, 'post-skip-1920x1080.png');
  await introPage.screenshot({ path: postSkipShotPath });
  console.log(`  [SAVED] Post-Skip Screenshot: ${postSkipShotPath}`);

  await introPage.close();
  await browser.close();

  console.log('\n========================================================');
  console.log(' VISUAL AUDIT COMPLETE');
  console.log('========================================================\n');
}

runVisualAudit().catch(err => {
  console.error('Audit Exception:', err);
  process.exit(1);
});
