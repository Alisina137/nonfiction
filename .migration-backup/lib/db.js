import { getServiceSupabase } from "@/lib/supabaseServer";

export async function listProjects(userId) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("book_projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createProject(userId, payload) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("book_projects")
    .insert([{ user_id: userId, ...payload }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(userId, id, patch) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("book_projects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getProject(userId, id) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("book_projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}
