import crypto from "crypto";
import { obterFirestoreAdmin } from "../../lib/firebaseAdmin.js";

// Precisamos do corpo em bruto (raw) para verificar a assinatura HMAC â€”
// por isso desligamos o parsing automÃ¡tico do Vercel para esta rota.
export const config = {
    api: { bodyParser: false }
};

function lerCorpoBruto(req) {
    return new Promise((resolve, reject) => {
        let dados = "";
        req.on("data", (pedaco) => { dados += pedaco; });
        req.on("end", () => resolve(dados));
        req.on("error", reject);
    });
}

function assinaturaValida(corpoBruto, assinaturaRecebida, segredo) {
    if (!assinaturaRecebida) return false;
    const esperada = crypto.createHmac("sha256", segredo).update(corpoBruto).digest("hex");
    try {
        return crypto.timingSafeEqual(Buffer.from(assinaturaRecebida, "hex"), Buffer.from(esperada, "hex"));
    } catch (e) {
        return false; // tamanhos diferentes, por exemplo
    }
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).end();
        return;
    }

    const corpoBruto = await lerCorpoBruto(req);
    const assinatura = req.headers["x-zumbopay-signature"];
    const segredo = process.env.ZUMBOPAY_WEBHOOK_SECRET;

    if (!segredo || !assinaturaValida(corpoBruto, assinatura, segredo)) {
        console.error("Webhook ZumboPay: assinatura invÃ¡lida â€” pedido ignorado.");
        res.status(401).json({ erro: "Assinatura invÃ¡lida." });
        return;
    }

    const evento = JSON.parse(corpoBruto);
    const tipo = evento?.event || evento?.type;
    const dados = evento?.data || {};
    const sourceId = dados?.source_id || dados?.reference;

    // SÃ³ nos interessam pagamentos concluÃ­dos com sucesso, com a nossa referÃªncia FABEF-...
    if (tipo === "payment.succeeded" && sourceId && String(sourceId).startsWith("FABEF-")) {
        try {
            const partes = String(sourceId).split("-"); // ["FABEF", empresaId, timestamp]
            const empresaId = partes[1];

            const db = obterFirestoreAdmin();
            const empresaRef = db.collection("empresas").doc(empresaId);
            const empresaSnap = await empresaRef.get();

            if (empresaSnap.exists) {
                const agora = new Date();
                const validadeAtual = empresaSnap.data().validade_subscricao
                    ? new Date(empresaSnap.data().validade_subscricao)
                    : agora;

                // Se a subscriÃ§Ã£o ainda estava vÃ¡lida, soma 30 dias a partir daÃ­;
                // se jÃ¡ tinha expirado, conta os 30 dias a partir de agora.
                const baseData = validadeAtual > agora ? validadeAtual : agora;
                const novaValidade = new Date(baseData);
                novaValidade.setDate(novaValidade.getDate() + 30);

                await empresaRef.update({
                    estado_licenca: "ATIVA",
                    subscricao_paga: true,
                    validade_subscricao: novaValidade.toISOString(),
                    ultimoPagamentoConfirmadoEm: agora.toISOString()
                });

                // Atualiza tambÃ©m o registo do pedido de pagamento, se existir com esta referÃªncia
                const pagamentosSnap = await db.collection("empresas").doc(empresaId)
                    .collection("pagamentos")
                    .where("referenciaGateway", "==", sourceId)
                    .limit(1)
                    .get();

                if (!pagamentosSnap.empty) {
                    await pagamentosSnap.docs[0].ref.update({ estado: "CONFIRMADO", confirmadoEm: agora.toISOString() });
                }

                await db.collection("empresas").doc(empresaId).collection("auditoria_logs").add({
                    mensagem: "Pagamento da subscriÃ§Ã£o confirmado automaticamente via ZumboPay.",
                    nivel: "INFO",
                    utilizadorNome: "Sistema (ZumboPay)",
                    data: agora.toISOString()
                });
            }
        } catch (erro) {
            console.error("Erro ao processar webhook de pagamento confirmado:", erro);
            // Devolve 200 mesmo assim para a ZumboPay nÃ£o ficar a tentar reenviar indefinidamente
            // um evento que jÃ¡ percebemos mas falhou a gravar â€” fica registado no log do Vercel.
        }
    }

    res.status(200).json({ recebido: true });
}
