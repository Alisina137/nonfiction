import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function getServiceSupabase() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server configuration is missing or invalid.");
  }

  return createClient(
    url,
    serviceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );
}

export async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
