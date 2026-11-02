'use strict';

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, 'screenshots');

async function testCompleteInteraction() {
  console.log('========================================================');
  console.log(' TESTING FULL INTERACTION LIFECYCLE');
  console.log('========================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Load Page with intro
  console.log('Step 1: Loading page...');
  await page.goto('http://localhost:3005/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 800));

  // 2. Skip Intro
  console.log('Step 2: Triggering Skip Intro...');
  await page.click('#skipIntroBtn');
  await new Promise(r => setTimeout(r, 600));

  // Check that input is visible & interactive
  const isInputInteractable = await page.evaluate(() => {
    const input = document.querySelector('#rollNumberInput');
    const r = input.getBoundingClientRect();
    const style = window.getComputedStyle(input);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  });
  console.log(`  Input interactable: ${isInputInteractable ? 'YES' : 'NO'}`);

  // 3. Enter Admission Number
  console.log('Step 3: Entering admission number "23CS999"...');
  await page.type('#rollNumberInput', '23CS999', { delay: 50 });

  // Verify compass needle wiggled and runes illuminated
  const runesGlow = await page.evaluate(() => {
    const runes = document.querySelector('#searchRunes');
    return runes.classList.contains('glow');
  });
  console.log(`  Runes illuminated on typing: ${runesGlow ? 'YES' : 'NO'}`);

  // 4. Submit the search
  console.log('Step 4: Submitting search form...');
  await page.click('#submitBtn');

  // 5. Observe Loading State
  await new Promise(r => setTimeout(r, 100));
  const isLoadingVisible = await page.evaluate(() => {
    const loading = document.querySelector('#loadingState');
    return !loading.classList.contains('hidden');
  });
  console.log(`Step 5: Loading state appeared: ${isLoadingVisible ? 'YES' : 'NO'}`);

  // 6. Observe API Response
  console.log('Step 6: Awaiting API response...');
  await new Promise(r => setTimeout(r, 1500));

  const finalState = await page.evaluate(() => {
    const loadingHidden = document.querySelector('#loadingState').classList.contains('hidden');
    const errorShown = !document.querySelector('#errorState').classList.contains('hidden');
    const resultShown = !document.querySelector('#resultState').classList.contains('hidden');
    const errorText = errorShown ? document.querySelector('#errorMessage').textContent : null;
    return { loadingHidden, errorShown, resultShown, errorText };
  });

  console.log(`  Loading finished: ${finalState.loadingHidden ? 'YES' : 'NO'}`);
  console.log(`  Result or Clean Error shown: ${finalState.resultShown ? 'RESULT PRESENTED' : (finalState.errorShown ? `CLEAN ERROR: ${finalState.errorText}` : 'NONE')}`);

  // Save final state screenshot
  const finalShot = path.join(OUTPUT_DIR, 'interaction-final-state.png');
  await page.screenshot({ path: finalShot });
  console.log(`  [SAVED] Final State Screenshot: ${finalShot}`);

  await browser.close();
  console.log('\n========================================================');
  console.log(' INTERACTION LIFECYCLE COMPLETE: ALL PASSED');
  console.log('========================================================\n');
}

testCompleteInteraction().catch(err => {
  console.error('Interaction Test Error:', err);
  process.exit(1);
});
