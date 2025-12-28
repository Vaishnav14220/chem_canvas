
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:1755';
const ARTIFACTS_DIR = 'C:\\Users\\singhsmi\\.gemini\\antigravity\\brain\\8b2d9091-dcb2-40b4-964f-9b9bdb6459dd\\screenshots';

async function capture() {
    if (!fs.existsSync(ARTIFACTS_DIR)) {
        fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Helper to take screenshot
    async function takeScreenshot(name) {
        const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filePath = path.join(ARTIFACTS_DIR, `${safeName}.png`);
        await page.screenshot({ path: filePath, fullPage: false });
        console.log(`Captured: ${name}`);
    }

    // Helper to click and wait
    async function clickAndWait(selector, screenshotName, waitMs = 2000) {
        try {
            console.log(`Attempting to click: ${selector}`);
            await page.waitForSelector(selector, { timeout: 5000, visible: true });
            await page.click(selector);
            await new Promise(r => setTimeout(r, waitMs)); // Wait for animation/render
            await takeScreenshot(screenshotName);
        } catch (e) {
            console.error(`Failed to capture ${screenshotName}: ${e.message}`);
        }
    }

    try {
        // 1. Initial Load (Main Canvas)
        console.log('Navigating to Home...');
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000)); // clear initial loads
        await takeScreenshot('01_Home_Canvas');

        // 2. Navigation Routes
        const routes = [
            { path: '/epoxidation', name: '02_Epoxidation_Mode' },
            { path: '/components/dock/message-dock', name: '03_Message_Dock' },
            { path: '/vision-analyze', name: '04_Vision_Analyze' },
            { path: '/vision-chat', name: '05_Vision_Chat' },
            { path: '/vision-video', name: '06_Vision_Video' }
        ];

        for (const route of routes) {
            try {
                console.log(`Navigating to ${route.path}...`);
                await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 2000));
                await takeScreenshot(route.name);
            } catch (e) {
                console.error(`Error visiting ${route.path}: ${e.message}`);
            }
        }

        // 3. Interactions on Home Page
        console.log('Returning to Home for interactions...');
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 3000));

        // Define interactions. We reload between major state changes to ensure clean slate.
        const interactions = [
            { label: 'SRL Coach', selector: 'button:has-text("SRL Coach")', name: '07_SRL_Coach' },
            { label: 'Sources Panel', selector: 'button:has-text("Sources")', name: '08_Sources_Panel' }, // Opens sidebar
            { label: '3D Explorer', selector: 'button:has-text("3D Explorer")', name: '09_3D_Explorer_ChemistryPanel' },
            { label: 'NMR Lab', selector: 'button:has-text("NMR Lab")', name: '10_NMR_Lab_Fullscreen' },
            { label: 'Doc Studio', selector: 'button:has-text("Doc Studio")', name: '11_Doc_Studio_AIWord' },
            { label: 'Immersive Learning', selector: 'button:has-text("Immersive Learning")', name: '12_Immersive_Learning' },
            { label: 'Socratic', selector: 'button:has-text("Socratic")', name: '13_Socratic_Mode' },
            { label: 'Feynman', selector: 'button:has-text("Feynman")', name: '14_Feynman_Mode' },
            { label: 'Canvas Planner', selector: 'button:has-text("Canvas Planner")', name: '15_Canvas_Planner' },
            { label: 'Molecule Sketcher', selector: 'button:has-text("Molecule Sketcher")', name: '16_Molecule_Sketcher' },
            // Check "Start Chat" if visible
            { label: 'Start Chat', selector: 'button:has-text("Start Chat")', name: '17_Chat_Panel' }
        ];

        // Using a loop with reloading to avoid state conflicts
        for (const interaction of interactions) {
            if (interaction.name !== '08_Sources_Panel' && interaction.name !== '16_Molecule_Sketcher') {
                // Soft reset for major panels
                await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
                await new Promise(r => setTimeout(r, 2000));
            }

            // Selectors based on text
            const selector = `//button[contains(., '${interaction.label}')]`;
            try {
                console.log(`Interaction: ${interaction.label}`);
                // XPath selector support in puppeteer is via page.$x or prefixing with xpath/.
                // But actually page.waitForSelector doesn't support xpath directly in older versions?
                // Puppeteer supports text selector "::-p-text(My Button)" or specifically `aria` etc. 
                // Simpler to use evaluate or handle non-standard text.
                // Actually, let's use the `aria-label` or just text content search.

                // Find element by text content
                const found = await page.evaluateHandle((text) => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.find(b => b.textContent && b.textContent.includes(text));
                }, interaction.label);

                if (found && found.asElement()) {
                    await found.asElement().click();
                    await new Promise(r => setTimeout(r, 2000));
                    await takeScreenshot(interaction.name);
                } else {
                    console.warn(`Button with text "${interaction.label}" not found.`);
                }

            } catch (e) {
                console.error(`Interaction error for ${interaction.label}:`, e);
            }
        }

    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        await browser.close();
    }
}

capture();
