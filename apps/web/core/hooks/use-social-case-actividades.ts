/* oxlint-disable promise/always-return */
import { useState, useEffect } from "react";
import { APIService } from "@/services/api.service";
import { API_BASE_URL } from "@plane/constants";
import { extractFromHtml } from "@/components/issues/social-case-form";

class SocialCaseService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  getSocialCases(workspaceSlug: string, projectId: string): Promise<any[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/social-cases/`)
      .then((res) => res?.data ?? [])
      .catch(() => []);
  }
}
const socialCaseService = new SocialCaseService();

// Cache en memoria por sesión: evita requests duplicados cuando varios componentes
// montan el hook con los mismos parámetros (ej. formulario + detalle del mismo proyecto).
const cache = new Map<string, string[]>();

/** Invalida el cache de un proyecto para que el próximo mount re-fetche la lista actualizada. */
export function invalidateSocialCaseActividades(workspaceSlug: string, projectId: string) {
  cache.delete(`${workspaceSlug}::${projectId}`);
}

/**
 * Devuelve la lista de actividades (jornadas) únicas registradas en el proyecto,
 * útil para mostrar sugerencias en el campo Actividad del formulario.
 */
export function useSocialCaseActividades(workspaceSlug: string, projectId: string): string[] {
  const cacheKey = `${workspaceSlug}::${projectId}`;
  const [actividades, setActividades] = useState<string[]>(() => cache.get(cacheKey) ?? []);

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    const key = `${workspaceSlug}::${projectId}`;
    if (cache.has(key)) {
      setActividades(cache.get(key)!);
      return;
    }
    socialCaseService.getSocialCases(workspaceSlug, projectId).then((list) => {
      const set = new Set<string>();
      for (const issue of list) {
        const d = extractFromHtml(issue?.description_html ?? "");
        const jornada = d?.jornada?.trim();
        if (jornada) set.add(jornada);
      }
      // oxlint-disable-next-line unicorn/no-array-sort
      const sorted = [...set].sort((a, b) => a.localeCompare(b, "es"));
      cache.set(key, sorted);
      setActividades(sorted);
    });
  }, [workspaceSlug, projectId]);

  return actividades;
}
