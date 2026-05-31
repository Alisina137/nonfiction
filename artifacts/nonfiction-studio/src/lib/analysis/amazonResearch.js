/**
 * amazonResearch.js
 *
 * Client-side helpers for Amazon book research data.
 * The actual API calls go through /api/analysis/* which uses Apify server-side.
 */

import { extractAsinFromAmazonUrl } from "@/lib/analysis/asin";

/** Build a canonical Amazon product URL from an ASIN */
export function buildAmazonUrl(asin, domain) {
  const d = (domain || "amazon.com").replace(/^www\./, "");
  return `https://www.${d}/dp/${asin}`;
}

/**
 * Parse an ASIN from a request body { asin?, url? }.
 * Used by manual URL entry.
 */
export function parseAsinFromInput(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[A-Z0-9]{10}$/i.test(s)) return s.toUpperCase();
  return extractAsinFromAmazonUrl(s);
}
