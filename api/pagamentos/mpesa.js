import { processarCobranca } from "../../lib/processarCobranca.js";

export default async function handler(req, res) {
    await processarCobranca(req, res, "MPESA");
}
