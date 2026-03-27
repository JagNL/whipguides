import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AppConfig {
  cfImagesUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  googleMapsApiKey: string;
}

export function useAppConfig(): AppConfig {
  const { data } = useQuery<AppConfig>({
    queryKey: ["/api/config"],
    queryFn: () => apiRequest("GET", "/api/config").then(r => r.json()),
    staleTime: Infinity,
  });
  return data || { cfImagesUrl: "", supabaseUrl: "", supabaseAnonKey: "", googleMapsApiKey: "" };
}

export function useCfUrl(): string {
  const config = useAppConfig();
  return (config.cfImagesUrl || "").replace(/\/$/, "");
}

export function useGoogleMapsKey(): string {
  const config = useAppConfig();
  return config.googleMapsApiKey || "";
}

export function cfImageUrl(cfBase: string, imageId: string | null | undefined): string | null {
  if (!imageId) return null;
  // Already a full URL (data URI or https) — return as-is
  if (imageId.startsWith("data:") || imageId.startsWith("http")) return imageId;
  if (!cfBase) return null;
  return `${cfBase}/${imageId}/public`;
}

/** Resolve any image reference to a displayable URL. */
export function resolveImageUrl(cfBase: string, imageId: string | null | undefined): string | null {
  return cfImageUrl(cfBase, imageId);
}
