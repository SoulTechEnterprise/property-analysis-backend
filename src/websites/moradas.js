import puppeteer from 'puppeteer';
import 'dotenv/config'

export async function HandleMoradas(district) {
    const browser = await puppeteer.connect({
        browserWSEndpoint: process.env.CHROMIUM,
    });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({width: 1920, height: 1080});
    page.setDefaultNavigationTimeout(60000);

    await page.goto('https://www.moradasimoveis.com.br/', { waitUntil: 'networkidle0', timeout: 60000 });

    try {
        await page.waitForSelector('#tipo', { visible: true });
        await page.select('#tipo', 'casa');
        // Digitação com delay para evitar erros no seletor de sugestão
        await page.type('#endereco', district, { delay: 100 });

        const districtOption = `#lista-endereco li ::-p-text(${district})`;
        await page.waitForSelector(districtOption, { visible: true });
        await page.click(districtOption);

        await page.waitForSelector('#submit-busca', { visible: true });
        await page.click('#submit-busca');
        await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
        console.error("Erro na busca inicial Moradas:", err.message);
    }

    let allProperties = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
        const districtSlug = district.toLowerCase().replace(/\s+/g, '-');
        const url = `https://www.moradasimoveis.com.br/venda/casa/marilia/${districtSlug}/?&pagina=${currentPage}`;
        
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
            await page.waitForSelector('.card', { visible: true, timeout: 15000 });
        } catch (e) {
            hasMorePages = false;
            break;
        }

        const propertiesOnPage = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('.card'));
            return cards.map(card => {
                const priceElement = card.querySelector('.preco-imovel-card');
                const priceRaw = priceElement ? priceElement.innerText.replace(/\D/g, '') : "0";
                const price = (parseInt(priceRaw) / 100) || 0;

                const footerSpans = Array.from(card.querySelectorAll('span'));
                const sqmSpan = footerSpans.find(s => s.innerText.includes('m²'));
                let sqm = 0;
                if (sqmSpan) {
                    const cleanSqm = sqmSpan.innerText.replace(/[^\d,]/g, '').replace(',', '.');
                    sqm = parseFloat(cleanSqm) || 0;
                }
                return { price, sqm };
            }).filter(item => item.sqm >= 10 && item.price > 80000);
        });

        if (propertiesOnPage.length === 0) {
            hasMorePages = false;
        } else {
            allProperties = allProperties.concat(propertiesOnPage);
            currentPage++;
            if (currentPage > 15) hasMorePages = false; 
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    await browser.close();
    return allProperties;
}