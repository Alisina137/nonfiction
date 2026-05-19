import { normalizeProductForApp, parseAsinFromBody, rainforestProductDetails } from "@/lib/analysis/rainforest";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.RAINFOREST_API_KEY;
  const { amazonDomain } = req.body || {};
  const asin = parseAsinFromBody(req.body);

  if (!asin) return res.status(400).json({ error: "Valid Amazon product URL or ASIN is required." });

  if (!apiKey) {
    return res.status(200).json({
      needsApiKey: true,
      details: null,
      message: "Add RAINFOREST_API_KEY to load ratings and bestseller rank from Amazon."
    });
  }

  try {
    const data = await rainforestProductDetails(apiKey, { asin, amazonDomain });
    if (data.request_info && data.request_info.success === false) {
      return res.status(502).json({
        error: data.error?.message || data.error || "Product lookup failed."
      });
    }
    const details = normalizeProductForApp(data);
    if (!details) return res.status(502).json({ error: "Unexpected product response." });
    return res.status(200).json({ details, asin });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Product lookup failed." });
  }
}
