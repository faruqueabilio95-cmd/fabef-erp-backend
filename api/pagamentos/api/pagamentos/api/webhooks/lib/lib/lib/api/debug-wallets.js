// FICHEIRO TEMPORÃRIO â€” usar uma vez para descobrir os wallet_id da conta,
// depois apagar este ficheiro do repositÃ³rio (nÃ£o Ã© preciso mantÃª-lo).
export default async function handler(req, res) {
    try {
        const apiKey = process.env.ZUMBOPAY_API_KEY;
        const merchantId = process.env.ZUMBOPAY_MERCHANT_ID;

        const resposta = await fetch("https://zumbopay.com/api/public/v1/merchant/validate", {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "X-Merchant-Id": merchantId
            }
        });

        const dados = await resposta.json();
        res.status(200).json(dados);
    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
}
