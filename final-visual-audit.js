const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const http = require('http');
const app = require('./server');

const PORT = 3008;
const SCREENSHOT_DIR = path.resolve('screenshots/final-single-screen');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runAudit() {
  const server = app.listen(PORT);
  console.log(`Test server running on port ${PORT}...`);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const viewports = [
    { name: 'desktop-1920x1080', width: 1920, height: 1080 },
    { name: 'laptop-1440x900', width: 1440, height: 900 },
    { name: 'tablet-768x1024', width: 768, height: 1024 },
    { name: 'mobile-390x844', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

    // Wait 1.5s for fonts and particles
    await new Promise(r => setTimeout(r, 1500));

    // Capture resting screenshot
    const shotPath = path.join(SCREENSHOT_DIR, `${vp.name}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`[PASS] Captured ${vp.name} -> ${shotPath}`);

    // If desktop, test typing and hover
    if (vp.name === 'desktop-1920x1080') {
      // Focus and type into input
      await page.focus('#rollNumberInput');
      await page.keyboard.type('2025B01010618');
      await new Promise(r => setTimeout(r, 300));
      
      const typingShot = path.join(SCREENSHOT_DIR, 'desktop-typing.png');
      await page.screenshot({ path: typingShot });
      console.log(`[PASS] Captured typing state -> ${typingShot}`);

      // Hover over submit button
      await page.hover('#submitBtn');
      await new Promise(r => setTimeout(r, 400));
      const hoverShot = path.join(SCREENSHOT_DIR, 'desktop-button-hover.png');
      await page.screenshot({ path: hoverShot });
      console.log(`[PASS] Captured button hover -> ${hoverShot}`);
    }

    await page.close();
  }

  await browser.close();
  server.close();
  console.log('Visual audit completed successfully!');
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
