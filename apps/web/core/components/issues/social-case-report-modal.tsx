import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { X, FileDown, Loader2 } from "lucide-react";
import { observer } from "mobx-react";
import { pdf } from "@react-pdf/renderer";
import { Button } from "@plane/propel/button";
import { EIssuesStoreType } from "@plane/types";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { extractFromHtml } from "@/components/issues/social-case-form";
import { SocialCaseReportPDF } from "@/components/issues/social-case-report-pdf";

// ── Date preset helpers ──────────────────────────────────────────────────────

type Preset = "today" | "week" | "month" | "3months" | "all" | "custom";

function presetRange(preset: Preset): { from: Date | null; to: Date | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "today") return { from: today, to: now };
  if (preset === "week") {
    const from = new Date(today);
    from.setDate(today.getDate() - 6);
    return { from, to: now };
  }
  if (preset === "month") {
    const from = new Date(today);
    from.setDate(1);
    return { from, to: now };
  }
  if (preset === "3months") {
    const from = new Date(today);
    from.setMonth(today.getMonth() - 3);
    return { from, to: now };
  }
  return { from: null, to: null };
}

function formatDate(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  onClose: () => void;
};

export const SocialCaseReportModal = observer(function SocialCaseReportModal({ onClose }: Props) {
  const { workspaceSlug, projectId } = useParams();
  const { currentProjectDetails } = useProject();
  const { getProjectStates } = useProjectState();
  const { issueMap } = useIssues(EIssuesStoreType.PROJECT);

  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  // ── Derived state ──────────────────────────────────────────────────────────

  const states = useMemo(
    () => getProjectStates(projectId?.toString() ?? ""),
    [getProjectStates, projectId]
  );

  const stateNames = useMemo(() => {
    const map: Record<string, string> = {};
    (states ?? []).forEach((s) => { map[s.id] = s.name; });
    return map;
  }, [states]);

  const { fromDate, toDate } = useMemo(() => {
    if (preset !== "all" && preset !== "custom" ) {
      const range = presetRange(preset);
      return { fromDate: range.from, toDate: range.to };
    }
    if (preset === "custom") {
      return {
        fromDate: customFrom ? new Date(customFrom) : null,
        toDate: customTo ? new Date(customTo + "T23:59:59") : null,
      };
    }
    return { fromDate: null, toDate: null };
  }, [preset, customFrom, customTo]);

  // All issues for this project that have a social case table
  const allProjectIssues = useMemo(() => {
    return Object.values(issueMap).filter(
      (issue) =>
        issue.project_id?.toString() === projectId?.toString() &&
        issue.description_html?.includes('data-social-case="1"')
    );
  }, [issueMap, projectId]);

  const filteredIssues = useMemo(() => {
    return allProjectIssues.filter((issue) => {
      if (!fromDate && !toDate) return true;
      const created = issue.created_at ? new Date(issue.created_at) : null;
      if (!created) return false;
      if (fromDate && created < fromDate) return false;
      if (toDate && created > toDate) return false;
      return true;
    });
  }, [allProjectIssues, fromDate, toDate]);

  const stats = useMemo(() => {
    const byState: Record<string, number> = {};
    let conResultado = 0;
    for (const issue of filteredIssues) {
      const sname = stateNames[issue.state_id ?? ""] ?? "Sin estado";
      byState[sname] = (byState[sname] ?? 0) + 1;
      const d = extractFromHtml(issue.description_html ?? "");
      if (d?.resultado?.trim()) conResultado++;
    }
    return { byState, conResultado };
  }, [filteredIssues, stateNames]);

  const dateRangeLabel = useMemo(() => {
    if (!fromDate && !toDate) return "Todos los registros";
    const f = fromDate ? formatDate(fromDate) : "...";
    const t = toDate ? formatDate(toDate) : "hoy";
    return `${f} – ${t}`;
  }, [fromDate, toDate]);

  // ── PDF generation ─────────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (filteredIssues.length === 0) return;
    setGenerating(true);
    try {
      const blob = await pdf(
        <SocialCaseReportPDF
          issues={filteredIssues}
          projectName={currentProjectDetails?.name ?? "Proyecto"}
          dateRange={dateRangeLabel}
          stateNames={stateNames}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-casos-${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const presets: { value: Preset; label: string }[] = [
    { value: "today", label: "Hoy" },
    { value: "week", label: "Esta semana" },
    { value: "month", label: "Este mes" },
    { value: "3months", label: "Últimos 3 meses" },
    { value: "all", label: "Todo" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-lg rounded-xl bg-custom-background-100 shadow-xl border border-custom-border-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-custom-border-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-custom-text-100">Reporte de Casos Sociales</h2>
            <p className="text-xs text-custom-text-300 mt-0.5">{currentProjectDetails?.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-custom-text-300 hover:bg-custom-background-80 hover:text-custom-text-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">

          {/* Presets */}
          <div>
            <p className="text-xs text-custom-text-300 mb-2">Rango de fechas</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    preset === p.value
                      ? "bg-custom-primary-100 text-white"
                      : "bg-custom-background-80 text-custom-text-200 hover:bg-custom-background-70"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPreset("custom")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  preset === "custom"
                    ? "bg-custom-primary-100 text-white"
                    : "bg-custom-background-80 text-custom-text-200 hover:bg-custom-background-70"
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>

          {/* Custom date pickers */}
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-custom-text-300 mb-1">Desde</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full rounded-md border border-custom-border-200 bg-custom-background-80 px-3 py-1.5 text-xs text-custom-text-100 focus:outline-none focus:border-custom-primary-100"
                />
              </div>
              <div>
                <label className="block text-xs text-custom-text-300 mb-1">Hasta</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full rounded-md border border-custom-border-200 bg-custom-background-80 px-3 py-1.5 text-xs text-custom-text-100 focus:outline-none focus:border-custom-primary-100"
                />
              </div>
            </div>
          )}

          {/* Stats preview */}
          <div className="rounded-lg border border-custom-border-200 bg-custom-background-90 p-4">
            <p className="text-xs text-custom-text-300 mb-3">{dateRangeLabel}</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-md bg-custom-background-100 border border-custom-border-200 p-3">
                <p className="text-2xl font-bold text-custom-text-100">{filteredIssues.length}</p>
                <p className="text-xs text-custom-text-300 mt-0.5">Total de fichas</p>
              </div>
              <div className="rounded-md bg-custom-background-100 border border-custom-border-200 p-3">
                <p className="text-2xl font-bold text-custom-text-100">{stats.conResultado}</p>
                <p className="text-xs text-custom-text-300 mt-0.5">Con resultado</p>
              </div>
            </div>
            {Object.keys(stats.byState).length > 0 && (
              <div className="space-y-1.5">
                {Object.entries(stats.byState).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-xs text-custom-text-200">{name}</span>
                    <span className="text-xs font-semibold text-custom-text-100">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-custom-border-200 px-5 py-4">
          <Button type="button" variant="tertiary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={filteredIssues.length === 0 || generating}
            onClick={handleDownload}
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Generando...
              </>
            ) : (
              <>
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                Descargar PDF ({filteredIssues.length})
              </>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
});
