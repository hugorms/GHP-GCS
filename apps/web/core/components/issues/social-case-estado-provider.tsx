import { useState, useEffect, useRef, useMemo, createContext, useContext, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { APIService } from "@/services/api.service";
import { API_BASE_URL } from "@plane/constants";

// ── Servicio ──────────────────────────────────────────────────────────────────

class SocialCaseFilterService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  async getIdsByEstados(workspaceSlug: string, projectId: string, estados: string[]): Promise<string[]> {
    const param = estados.map(encodeURIComponent).join(",");
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/social-cases/?estados=${param}`)
      .then((res) => (res?.data ?? []).map((i: { id: string }) => i.id))
      .catch(() => []);
  }
}
const filterService = new SocialCaseFilterService();

// ── Context ───────────────────────────────────────────────────────────────────

type ContextValue = {
  estadosFilter: string[];
  toggleEstado: (estado: string) => void;
  clearEstados: () => void;
  /** null = sin filtro (mostrar todos), Set<string> = solo estos IDs */
  filteredIssueIds: Set<string> | null;
  loadingFilter: boolean;
};

const SocialCaseEstadoFilterContext = createContext<ContextValue>({
  estadosFilter: [],
  toggleEstado: () => {},
  clearEstados: () => {},
  filteredIssueIds: null,
  loadingFilter: false,
});

export const useSocialCaseEstadoFilter = () => useContext(SocialCaseEstadoFilterContext);

// ── Provider ──────────────────────────────────────────────────────────────────

export function SocialCaseEstadoProvider({ children }: { children: ReactNode }) {
  const { workspaceSlug, projectId } = useParams();
  const [estadosFilter, setEstadosFilter] = useState<string[]>([]);
  const [filteredIssueIds, setFilteredIssueIds] = useState<Set<string> | null>(null);
  const [loadingFilter, setLoadingFilter] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const toggleEstado = (estado: string) => {
    setEstadosFilter((prev) => (prev.includes(estado) ? prev.filter((e) => e !== estado) : [...prev, estado]));
  };

  const clearEstados = () => setEstadosFilter([]);

  useEffect(() => {
    if (estadosFilter.length === 0) {
      setFilteredIssueIds(null);
      return;
    }

    const ws = workspaceSlug?.toString();
    const pid = projectId?.toString();
    if (!ws || !pid) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoadingFilter(true);
    filterService
      .getIdsByEstados(ws, pid, estadosFilter)
      .then((ids) => setFilteredIssueIds(new Set(ids)))
      .finally(() => setLoadingFilter(false));
  }, [estadosFilter, workspaceSlug, projectId]);

  const contextValue = useMemo(
    () => ({ estadosFilter, toggleEstado, clearEstados, filteredIssueIds, loadingFilter }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estadosFilter, filteredIssueIds, loadingFilter]
  );

  return (
    <SocialCaseEstadoFilterContext.Provider value={contextValue}>{children}</SocialCaseEstadoFilterContext.Provider>
  );
}
