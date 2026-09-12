import { verificarUtilizador, obterFirestoreAdmin } from "./firebaseAdmin.js";
import { dispararCobrancaSTK, obterWalletId, formatarMsisdn } from "./zumbopay.js";

const VALOR_SUBSCRICAO_MENSAL = 250;

export async function processarCobranca(req, res, metodo) {
    if (req.method !== "POST") {
        res.status(405).json({ erro: "MÃ©todo nÃ£o permitido." });
        return;
    }

    try {
        // 1. Confirma que quem estÃ¡ a pedir Ã© mesmo um utilizador autenticado do FABEF
        const utilizador = await verificarUtilizador(req);

        const { empresaId, telefone, valor } = req.body || {};
        if (!empresaId || !telefone) {
            res.status(400).json({ erro: "Dados em falta (empresaId ou telefone)." });
            return;
        }

        // 2. Confirma que este utilizador pertence mesmo a esta empresa (evita pagar a subscriÃ§Ã£o de outra empresa)
        const db = obterFirestoreAdmin();
        const perfilSnap = await db.collection("utilizadores").doc(utilizador.uid).get();
        if (!perfilSnap.exists || perfilSnap.data().empresaId !== empresaId) {
            res.status(403).json({ erro: "NÃ£o autorizado para esta empresa." });
            return;
        }

        // 3. Dispara o pedido de PIN na ZumboPay
        const valorFinal = valor || VALOR_SUBSCRICAO_MENSAL;
        const sourceId = `FABEF-${empresaId}-${Date.now()}`;

        const resultado = await dispararCobrancaSTK({
            walletId: obterWalletId(metodo),
            amount: valorFinal,
            msisdn: formatarMsisdn(telefone),
            customerName: utilizador.name || utilizador.email || "Cliente FABEF",
            sourceId
        });

        if (!resultado.ok) {
            res.status(402).json({ erro: resultado.erro || "Pagamento recusado pela operadora." });
            return;
        }

        res.status(200).json({
            referencia: resultado.reference,
            transacaoId: resultado.reference,
            status: resultado.status,
            sourceId
        });
    } catch (erro) {
        console.error("Erro ao processar cobranÃ§a:", erro);
        res.status(erro.status || 500).json({ erro: erro.message || "Erro interno do servidor." });
    }
}
