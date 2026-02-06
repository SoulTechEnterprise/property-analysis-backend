import puppeteer from 'puppeteer';
import 'dotenv/config'

export async function HandleFlex(district) {
    const browser = await puppeteer.connect({
        browserWSEndpoint: process.env.CHROMIUM,
    });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({width: 1920, height: 1080});
    page.setDefaultTimeout(60000);

    await page.goto('https://www.fleximoveis.com/', { waitUntil: 'networkidle0', timeout: 60000 });

    try {
        const typeContainer = await page.waitForSelector('.choices:has(#tipo-imovel-basico)', { visible: true });
        await typeContainer.click();

        await page.waitForSelector('.choices__item--choice ::-p-text(RESIDÊNCIA)', { visible: true });
        await page.click('.choices__item--choice ::-p-text(RESIDÊNCIA)');
        await new Promise(r => setTimeout(r, 1000));

        const districtContainer = await page.waitForSelector('.choices:has(#bairro)', { visible: true });
        await districtContainer.click();

        const districtText = district.toUpperCase();
        await page.waitForSelector(`.choices__item--choice ::-p-text(${districtText})`, { visible: true });
        await page.click(`.choices__item--choice ::-p-text(${districtText})`);

        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 1000));

        await page.waitForSelector('#button-submit', { visible: true });
        await page.click('#button-submit');

    } catch (err) {
        console.error("Erro na navegação Flex:", err.message);
    }

    try {
        await page.waitForSelector('#ver', { visible: true, timeout: 30000 });
        // Pequena pausa antes de mudar a paginação
        await new Promise(r => setTimeout(r, 2000));
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.select('#ver', '100')
        ]);
    } catch (e) {
        console.error("Erro ao tentar mudar paginação na Flex.");
    }
    
    const obj = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('div[id^="RESIDÊNCIA-"]'));
        return cards.map(card => {
            const priceElement = card.querySelector('.label-preco span');
            const priceRaw = priceElement ? priceElement.innerText.replace(/\D/g, '') : "0";
            const price = (parseInt(priceRaw) / 100) || 0;

            const spans = Array.from(card.querySelectorAll('span.tam-16'));
            const sqmSpan = spans.find(s => s.innerText.includes('m²'));
            let sqm = 0;
            if (sqmSpan) {
                const cleanSqm = sqmSpan.innerText.replace(/[^\d,.]/g, '').replace(',', '.');
                sqm = parseFloat(cleanSqm) || 0;
            }
            return { price, sqm };
        }).filter(item => item.sqm >= 10 && item.price > 10000);
    });

    await browser.close();
    return obj;
}