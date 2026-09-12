// Todas as chamadas Ã  ZumboPay passam por aqui. As credenciais vÃªm sempre
// de variÃ¡veis de ambiente do Vercel â€” nunca ficam escritas no cÃ³digo.
const BASE_URL = "https://zumbopay.com/api/public/v1";

function credenciaisObrigatorias() {
    const apiKey = process.env.ZUMBOPAY_API_KEY;
    const merchantId = process.env.ZUMBOPAY_MERCHANT_ID;
    if (!apiKey || !merchantId) {
        throw new Error("ZUMBOPAY_API_KEY ou ZUMBOPAY_MERCHANT_ID nÃ£o configurados no Vercel.");
    }
    return { apiKey, merchantId };
}

// Dispara um pedido de cobranÃ§a directa (STK push) â€” o cliente recebe o
// pedido do PIN diretamente no telemÃ³vel, sem redirecionamento.
export async function dispararCobrancaSTK({ walletId, amount, msisdn, customerName, sourceId }) {
    const { apiKey, merchantId } = credenciaisObrigatorias();

    const resposta = await fetch(`${BASE_URL}/charges`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "X-Merchant-Id": merchantId,
            "Content-Type": "application/json",
            "Idempotency-Key": sourceId
        },
        body: JSON.stringify({
            wallet_id: walletId,
            amount,
            msisdn,
            customer_name: customerName,
            source_id: sourceId
        })
    });

    const dados = await resposta.json().catch(() => ({}));

    // A ZumboPay devolve 200 (sucesso imediato), 202 (a aguardar PIN) ou 402 (recusado)
    return {
        ok: resposta.ok || resposta.status === 202,
        httpStatus: resposta.status,
        status: dados?.data?.status || (resposta.ok ? "success" : "failed"),
        reference: dados?.data?.reference || null,
        erro: dados?.error?.message || null
    };
}

// Devolve o wallet_id certo consoante o mÃ©todo e o nÃºmero de telefone,
// a partir das variÃ¡veis de ambiente configuradas no Vercel.
export function obterWalletId(metodo) {
    const walletMpesa = process.env.ZUMBOPAY_WALLET_MPESA;
    const walletEmola = process.env.ZUMBOPAY_WALLET_EMOLA;

    if (metodo === "MPESA") {
        if (!walletMpesa) throw new Error("ZUMBOPAY_WALLET_MPESA nÃ£o configurado no Vercel.");
        return walletMpesa;
    }
    if (metodo === "EMOLA") {
        if (!walletEmola) throw new Error("ZUMBOPAY_WALLET_EMOLA nÃ£o configurado no Vercel.");
        return walletEmola;
    }
    throw new Error("MÃ©todo de pagamento desconhecido: " + metodo);
}

// Formata o nÃºmero de telefone moÃ§ambicano para o padrÃ£o internacional (258...)
export function formatarMsisdn(telefone) {
    const limpo = String(telefone).replace(/\D/g, "");
    return limpo.startsWith("258") ? limpo : "258" + limpo;
}
