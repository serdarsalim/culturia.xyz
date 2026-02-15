import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { countries } from "@/lib/countries";

export const revalidate = 604800;
export const runtime = "nodejs";

function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`.replace(/\/+$/, "");

  // Canonical production fallback (prevents localhost/preview URLs in sitemap).
  return "https://culturia.xyz";
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
    // Keep sitemap response fast and predictable for crawlers.
    const timeoutMs = 4000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Sitemap DB query timeout")), timeoutMs)
    );
    const queryPromise = Promise.all([
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
    const [entriesResult, privateProfilesResult] = await Promise.race([queryPromise, timeoutPromise]);

    if (entriesResult.error) throw entriesResult.error;
    if (privateProfilesResult.error) throw privateProfilesResult.error;

    const privateIds = new Set((privateProfilesResult.data || []).map((profile) => profile.id));
    const publicEntries = (entriesResult.data || []).filter((entry) => !privateIds.has(entry.user_id));

    if (publicEntries.length === 0) return staticPages;

    const latestUpdated = publicEntries
      .map((entry) => new Date(entry.updated_at || entry.created_at))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    staticPages[0] = {
      ...staticPages[0],
      lastModified: latestUpdated,
    };

    const knownCountryCodes = new Set(countries.map((country) => country.code));
    const countryCodes = Array.from(
      new Set(
        publicEntries
          .map((entry) => entry.country_code?.toUpperCase())
          .filter((code): code is string => !!code && knownCountryCodes.has(code))
      )
    ).sort();

    const countryPages: MetadataRoute.Sitemap = countryCodes.map((countryCode) => ({
      url: `${baseUrl}/country/${countryCode}`,
      lastModified: latestUpdated,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    return [...staticPages, ...countryPages];
  } catch {
    return staticPages;
  }
}
