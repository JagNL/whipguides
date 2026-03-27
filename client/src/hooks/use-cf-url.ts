import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useCfUrl(): string {
  const { data } = useQuery<{ cfImagesUrl: string }>({
    queryKey: ["/api/config"],
    queryFn: () => apiRequest("GET", "/api/config").then(r => r.json()),
    staleTime: Infinity, // never re-fetch — this never changes
  });
  return (data?.cfImagesUrl || "").replace(/\/$/, "");
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
