import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 604800;

function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/ai`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const supabase = getSupabaseClient();
  if (!supabase) return staticPages;

  try {
    const [entriesResult, privateProfilesResult] = await Promise.all([
      supabase
        .from("country_entries")
        .select("country_code, updated_at, created_at, user_id")
        .eq("private_by_owner", false)
        .eq("forced_private", false),
      supabase
        .from("user_profiles")
        .select("id")
        .eq("is_private", true),
    ]);

    if (entriesResult.error) throw entriesResult.error;
    if (privateProfilesResult.error) throw privateProfilesResult.error;

    const privateIds = new Set((privateProfilesResult.data || []).map((profile) => profile.id));
    const publicEntries = (entriesResult.data || []).filter((entry) => !privateIds.has(entry.user_id));

    if (publicEntries.length === 0) {
      return staticPages;
    }

    const latestUpdated = publicEntries
      .map((entry) => new Date(entry.updated_at || entry.created_at))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    staticPages[0] = {
      ...staticPages[0],
      lastModified: latestUpdated,
    };

    const countries = Array.from(new Set(publicEntries.map((entry) => entry.country_code).filter(Boolean))).sort();

    const countryPages: MetadataRoute.Sitemap = countries.map((countryCode) => ({
      url: `${baseUrl}/?country=${countryCode}`,
      lastModified: latestUpdated,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    return [...staticPages, ...countryPages];
  } catch {
    return staticPages;
  }
}
