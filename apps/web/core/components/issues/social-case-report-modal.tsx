import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { FileDown } from "lucide-react";
import { observer } from "mobx-react";
import { pdf } from "@react-pdf/renderer";
import { Button } from "@plane/propel/button";
import { EIssuesStoreType } from "@plane/types";
import { Checkbox, EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { useIssues } from "@/hooks/store/use-issues";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { extractFromHtml, extractProfilePhotoFromHtml } from "@/components/issues/social-case-form";
import {
  SocialCaseReportPDF,
  type ParsedIssueRow,
  type StateFlowStep,
} from "@/components/issues/social-case-report-pdf";

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
  const { projectId } = useParams();
  const { currentProjectDetails } = useProject();
  const { getProjectStates } = useProjectState();
  const { issueMap } = useIssues(EIssuesStoreType.PROJECT);
  const memberRoot = useMember();

  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [includeCover, setIncludeCover] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(false);
  const [openAfter, setOpenAfter] = useState(true);

  // ── Derived state ──────────────────────────────────────────────────────────

  const states = useMemo(() => getProjectStates(projectId?.toString() ?? ""), [getProjectStates, projectId]);

  const stateFlow = useMemo<StateFlowStep[]>(() => {
    return (states ?? []).map((s) => ({ id: s.id, name: s.name }));
  }, [states]);

  const stateNames = useMemo(() => {
    const map: Record<string, string> = {};
    (states ?? []).forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [states]);

  const { fromDate, toDate } = useMemo(() => {
    if (preset !== "all" && preset !== "custom") {
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

  // Parseo único: filtra, extrae campos y calcula stats en un solo recorrido
  const { rows, byState, byJornada, conResultado } = useMemo(() => {
    const parsedRows: ParsedIssueRow[] = [];
    const parsedByState: Record<string, number> = {};
    const parsedByJornada: Record<string, number> = {};
    let parsedConResultado = 0;

    for (const issue of Object.values(issueMap)) {
      // Solo issues de este proyecto con ficha social
      if (issue.project_id?.toString() !== projectId?.toString()) continue;
      if (!issue.description_html?.includes('data-social-case="1"')) continue;

      // Filtro de fechas
      if (fromDate || toDate) {
        const created = issue.created_at ? new Date(issue.created_at) : null;
        if (!created) continue;
        if (fromDate && created < fromDate) continue;
        if (toDate && created > toDate) continue;
      }

      // Parseo único del HTML
      const d = extractFromHtml(issue.description_html ?? "");
      const photoUrl = extractProfilePhotoFromHtml(issue.description_html ?? "");
      const stateName = stateNames[issue.state_id ?? ""] ?? "Sin estado";
      const jornada = d?.jornada || "Sin jornada";
      const assigneeIds = issue.assignee_ids ?? [];
      const assignees = (assigneeIds ?? [])
        .map((id: string) => memberRoot.getUserDetails(id)?.display_name || memberRoot.getUserDetails(id)?.first_name)
        .filter(Boolean) as string[];
      const responsable = assignees.length > 0 ? assignees.join(", ") : "Sin asignar";
      const accionTomada = d?.accionTomada || "-";
      const resultado = d?.resultado || "-";
      const beneficiado = !!(d?.resultado && d.resultado.trim());

      parsedRows.push({
        id: issue.id,
        sequenceId: issue.sequence_id,
        stateId: issue.state_id ?? null,
        stateName,
        photoUrl,
        responsable,
        nombre: d?.nombre || "-",
        cedula: d?.cedula || "-",
        municipio: d?.municipio || "-",
        jornada: d?.jornada || "-",
        referencia: d?.referencia || "-",
        accionTomada,
        resultado,
        beneficiado,
      });

      parsedByState[stateName] = (parsedByState[stateName] ?? 0) + 1;
      parsedByJornada[jornada] = (parsedByJornada[jornada] ?? 0) + 1;
      if (d?.resultado?.trim()) parsedConResultado++;
    }

    return { rows: parsedRows, byState: parsedByState, byJornada: parsedByJornada, conResultado: parsedConResultado };
  }, [issueMap, projectId, stateNames, fromDate, toDate, memberRoot]);

  const dateRangeLabel = useMemo(() => {
    if (!fromDate && !toDate) return "Todos los registros";
    const f = fromDate ? formatDate(fromDate) : "...";
    const t2 = toDate ? formatDate(toDate) : "hoy";
    return `${f} – ${t2}`;
  }, [fromDate, toDate]);

  // ── PDF generation ─────────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (rows.length === 0) return;
    setGenerating(true);
    try {
      const generatedAtLabel = new Date().toLocaleDateString("es-VE");
      const blob = await pdf(
        <SocialCaseReportPDF
          rows={rows}
          projectName={currentProjectDetails?.name ?? "Proyecto"}
          dateRange={dateRangeLabel}
          byState={byState}
          byJornada={byJornada}
          conResultado={conResultado}
          generatedAtLabel={generatedAtLabel}
          stateFlow={stateFlow}
          includeCover={includeCover}
          includePhotos={includePhotos}
          includeDetails={includeDetails}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      if (openAfter) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `reporte-casos-${new Date().toISOString().split("T")[0]}.pdf`;
        a.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
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
    <ModalCore isOpen handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.LG}>
      <div className="space-y-5 p-6">
        <div className="space-y-1">
          <h3 className="text-18 font-medium text-secondary">Reporte de Casos Sociales</h3>
          <p className="text-12 text-tertiary">{currentProjectDetails?.name}</p>
        </div>

        <div className="space-y-2">
          <p className="text-12 text-tertiary">Rango de fechas</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const isActive = preset === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  disabled={generating}
                  onClick={() => setPreset(p.value)}
                  className={[
                    "rounded-md px-3 py-1.5 text-12 font-medium transition-colors border",
                    isActive
                      ? "bg-primary text-white border-primary"
                      : "bg-surface-2 text-secondary border-subtle hover:bg-layer-1",
                    generating ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  {p.label}
                </button>
              );
            })}
            <button
              type="button"
              disabled={generating}
              onClick={() => setPreset("custom")}
              className={[
                "rounded-md px-3 py-1.5 text-12 font-medium transition-colors border",
                preset === "custom"
                  ? "bg-primary text-white border-primary"
                  : "bg-surface-2 text-secondary border-subtle hover:bg-layer-1",
                generating ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              Personalizado
            </button>
          </div>
        </div>

        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="social-case-from" className="block text-12 text-tertiary">
                Desde
              </label>
              <input
                id="social-case-from"
                type="date"
                value={customFrom}
                disabled={generating}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="focus:border-primary h-9 w-full rounded-md border border-subtle bg-transparent px-3 text-12 text-secondary outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="social-case-to" className="block text-12 text-tertiary">
                Hasta
              </label>
              <input
                id="social-case-to"
                type="date"
                value={customTo}
                disabled={generating}
                onChange={(e) => setCustomTo(e.target.value)}
                className="focus:border-primary h-9 w-full rounded-md border border-subtle bg-transparent px-3 text-12 text-secondary outline-none"
              />
            </div>
          </div>
        )}

        <div className="rounded-lg border border-subtle bg-surface-2 p-4">
          <p className="text-12 text-tertiary">{dateRangeLabel}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-subtle bg-transparent p-3">
              <p className="text-24 font-semibold text-secondary">{rows.length}</p>
              <p className="text-12 text-tertiary">Total de fichas</p>
            </div>
            <div className="rounded-md border border-subtle bg-transparent p-3">
              <p className="text-24 font-semibold text-secondary">{conResultado}</p>
              <p className="text-12 text-tertiary">Con resultado</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-subtle bg-surface-2 p-4">
          <p className="text-12 text-tertiary">Opciones de exportación</p>

          <div className="flex cursor-pointer items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-13 text-secondary">Incluir portada / resumen</p>
              <p className="text-12 text-tertiary">Incluye portada con totales por estado y jornada.</p>
            </div>
            <Checkbox checked={includeCover} onChange={() => setIncludeCover((v) => !v)} disabled={generating} />
          </div>

          <div className="flex cursor-pointer items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-13 text-secondary">Incluir fotos</p>
              <p className="text-12 text-tertiary">Puede tardar más y depender de la carga de imágenes.</p>
            </div>
            <Checkbox checked={includePhotos} onChange={() => setIncludePhotos((v) => !v)} disabled={generating} />
          </div>

          <div className="flex cursor-pointer items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-13 text-secondary">Reporte completo</p>
              <p className="text-12 text-tertiary">Detalle por caso + diagrama del estado real.</p>
            </div>
            <Checkbox checked={includeDetails} onChange={() => setIncludeDetails((v) => !v)} disabled={generating} />
          </div>

          <div className="flex cursor-pointer items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-13 text-secondary">Abrir PDF al finalizar</p>
              <p className="text-12 text-tertiary">Útil para previsualizar antes de guardar.</p>
            </div>
            <Checkbox checked={openAfter} onChange={() => setOpenAfter((v) => !v)} disabled={generating} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={generating}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleDownload}
            disabled={rows.length === 0 || generating}
            loading={generating}
          >
            {!generating && <FileDown className="mr-2 size-4" />}
            {openAfter ? "Generar y abrir PDF" : `Descargar PDF (${rows.length})`}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
