import { processarCobranca } from "../../lib/processarCobranca.js";

export default async function handler(req, res) {
    aguardar processarCobranca(req, res, "EMOLA");
}
