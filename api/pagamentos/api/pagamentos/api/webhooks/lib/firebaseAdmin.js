// Inicializa o Firebase Admin uma Ãºnica vez (reaproveitado entre pedidos).
// A credencial vem da variÃ¡vel de ambiente FIREBASE_SERVICE_ACCOUNT_JSON,
// nunca escrita diretamente no cÃ³digo.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function inicializarFirebaseAdmin() {
    if (getApps().length > 0) return;

    const jsonBruto = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!jsonBruto) {
        throw new Error("VariÃ¡vel de ambiente FIREBASE_SERVICE_ACCOUNT_JSON nÃ£o configurada no Vercel.");
    }

    const credenciais = JSON.parse(jsonBruto);
    initializeApp({ credential: cert(credenciais) });
}

export function obterAuthAdmin() {
    inicializarFirebaseAdmin();
    return getAuth();
}

export function obterFirestoreAdmin() {
    inicializarFirebaseAdmin();
    return getFirestore();
}

// Verifica o token do Firebase enviado pelo browser (cabeÃ§alho Authorization: Bearer <token>)
// e devolve os dados do utilizador autenticado. LanÃ§a erro se o token for invÃ¡lido/expirado.
export async function verificarUtilizador(req) {
    const cabecalho = req.headers.authorization || "";
    const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;
    if (!token) {
        const erro = new Error("Token de autenticaÃ§Ã£o em falta.");
        erro.status = 401;
        throw erro;
    }

    try {
        const decodificado = await obterAuthAdmin().verifyIdToken(token);
        return decodificado; // contÃ©m uid, email, etc.
    } catch (e) {
        const erro = new Error("Token invÃ¡lido ou expirado.");
        erro.status = 401;
        throw erro;
    }
}
