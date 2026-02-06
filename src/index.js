import Fastify from 'fastify'
import 'dotenv/config'
import axios from "axios"

const fastify = Fastify({
  logger: false
})

import { HandleFlex } from './websites/flex.js';
import { HandleMoradas } from './websites/moradas.js';

fastify.post('/form', async function (request, reply) {
    const {
        zip, street, number, district, city,
        length, width, name, phone
    } = request.body;

    reply.status(200).send({ message: 'Solicitação recebida.' });

    (async () => {
        try {
            const [flexData, moradasData] = await Promise.all([
                HandleFlex(district).catch(() => []),
                HandleMoradas(district).catch(() => [])
            ]);

            const calculateAverageSqm = (data) => {
                if (!data || data.length === 0) return 0;

                const validItems = data.filter(item => {
                    if (!item.price || !item.sqm || item.sqm <= 0) return false;
                    const sqmPrice = item.price / item.sqm;
                    return sqmPrice > 1000 && sqmPrice < 12000;
                });

                if (validItems.length === 0) return 0;

                const totalSqmPrice = validItems.reduce((acc, item) => acc + (item.price / item.sqm), 0);
                return totalSqmPrice / validItems.length;
            };

            const flexAvg = calculateAverageSqm(flexData);
            const moradasAvg = calculateAverageSqm(moradasData);
            
            const allData = [...flexData, ...moradasData];
            const generalAvg = calculateAverageSqm(allData);
            const totalImoveis = allData.length;

            const formatBRL = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            const cardDescription = `--- DADOS DO CLIENTE ---\n` +
                `Nome: ${name}\n` +
                `Telefone: ${phone}\n` +
                `CEP: ${zip}\n` +
                `Endereço: ${street}, ${number} - ${district}, ${city}\n` +
                `Terreno: ${length}m x ${width}m\n\n` +
                `--- ANÁLISE DE MERCADO (${district}) ---\n` +
                `Média Flex: ${flexAvg > 0 ? formatBRL(flexAvg) + '/m²' : 'N/A'}\n` +
                `Média Moradas: ${moradasAvg > 0 ? formatBRL(moradasAvg) + '/m²' : 'N/A'}\n\n` +
                `MÉDIA GERAL DO BAIRRO: ${generalAvg > 0 ? formatBRL(generalAvg) + '/m²' : 'N/A'}\n` +
                `Total de imóveis analisados: ${totalImoveis}`;

            await axios.post('https://api.trello.com/1/cards', null, {
                params: {
                    key: process.env.TRELLO_KEY,
                    token: process.env.TRELLO_TOKEN,
                    idList: '698530ebdf7a90320f418e40',
                    name: `Avaliação: ${name} | ${district}`,
                    desc: cardDescription,
                    pos: 'top'
                }
            });

        } catch (error) {
            // Error handling remains for stability but without logging
        }
    })();
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err) {
  if (err) {
    process.exit(1)
  }
})