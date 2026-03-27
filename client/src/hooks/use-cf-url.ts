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
  if (!imageId || !cfBase) return null;
  return `${cfBase}/${imageId}/public`;
}
