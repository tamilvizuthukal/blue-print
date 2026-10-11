import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1200 });

    console.log('Navigating to login page...');
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle2' });

    console.log('Logging in...');
    await page.type('input[placeholder="Enter username"]', 'admin');
    await page.type('input[placeholder="Enter password"]', 'ss');
    
    // Click submit and wait for state updates
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 4000));

    console.log('Successfully logged in. Looking for blueprints...');
    
    // Wait for the dashboard/blueprints list to load
    await new Promise(r => setTimeout(r, 2000));
    
    // Let's capture the dashboard to verify we logged in successfully
    await page.screenshot({ path: 'C:/Users/Dominic/.gemini/antigravity-ide/brain/0ace0a0c-9c9e-415c-9ee7-8680b4a46a0a/dashboard.png' });
    console.log('Dashboard screenshot saved.');

    // Find first blueprint link/button and click it.
    // Click Blue Print Config link in the sidebar
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const bpLink = links.find(el => el.textContent.includes('Blue Print Config') || el.textContent.includes('BluePrint'));
      if (bpLink) {
        bpLink.click();
      }
    });
    console.log('Clicked Blue Print Config. Waiting for list...');
    await new Promise(r => setTimeout(r, 3000));

    // Save a screenshot of the blueprint list to debug
    await page.screenshot({ path: 'C:/Users/Dominic/.gemini/antigravity-ide/brain/0ace0a0c-9c9e-415c-9ee7-8680b4a46a0a/blueprint_list.png' });

    // Click the first "View/Edit" button in the blueprint list
    const clicked = await page.evaluate(() => {
      const viewBtn = document.querySelector('button[title="View/Edit"]');
      if (viewBtn) {
        viewBtn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('Clicked blueprint. Waiting for details page...');
      await new Promise(r => setTimeout(r, 4000));

      // Click "Reports" or similar if needed, or find Report 3 directly
      const report3Clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const r3 = buttons.find(b => b.textContent.includes('Report 3'));
        if (r3) {
          r3.click();
          return true;
        }
        return false;
      });

      if (report3Clicked) {
        console.log('Clicked Report 3 tab. Waiting for report to load...');
        await new Promise(r => setTimeout(r, 4000));

        // Save screenshot of Report 3
        await page.screenshot({
          path: 'C:/Users/Dominic/.gemini/antigravity-ide/brain/0ace0a0c-9c9e-415c-9ee7-8680b4a46a0a/report3.png',
          fullPage: true
        });
        console.log('Report 3 screenshot saved successfully!');
      } else {
        console.log('Report 3 button not found.');
        await page.screenshot({ path: 'C:/Users/Dominic/.gemini/antigravity-ide/brain/0ace0a0c-9c9e-415c-9ee7-8680b4a46a0a/blueprint_view.png', fullPage: true });
      }
    } else {
      console.log('No blueprints found to click in the list.');
    }

    await browser.close();
  } catch (err) {
    console.error('Error running puppeteer test:', err);
  }
})();
