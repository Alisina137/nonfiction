/**
 * Extract Amazon ASIN from common URL shapes (and plain 10-char ASIN).
 */
export function extractAsinFromAmazonUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const direct = trimmed.match(/^([A-Z0-9]{10})$/i);
  if (direct) return direct[1].toUpperCase();
  const dp = trimmed.match(/\/(?:dp|gp\/product|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  if (dp) return dp[1].toUpperCase();
  const q = trimmed.match(/[?&]asin=([A-Z0-9]{10})/i);
  if (q) return q[1].toUpperCase();
  return null;
}
