// rebuild
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { FileDown } from "lucide-react";
import { observer } from "mobx-react";
import { pdf } from "@react-pdf/renderer";
import { Button } from "@plane/propel/button";
import { Checkbox, EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { getFileURL } from "@plane/utils";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { APIService } from "@/services/api.service";
import { IssueAttachmentService } from "@/services/issue/issue_attachment.service";
import { API_BASE_URL } from "@plane/constants";
import { extractFromHtml, extractProfilePhotoFromHtml } from "@/components/issues/social-case-form";
import { VENEZUELA_ESTADOS } from "@/components/issues/social-case-estados";
import { cn } from "@plane/utils";
import {
  SocialCaseReportPDF,
  type ParsedIssueRow,
  type AttachmentInfo,
  type StateFlowStep,
} from "@/components/issues/social-case-report-pdf";
import { SocialCaseFichaPDF, type FichaAttachment } from "@/components/issues/social-case-ficha-pdf";

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

// Servicio dedicado para el endpoint de casos sociales
class SocialCaseService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  async getSocialCases(workspaceSlug: string, projectId: string): Promise<any[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/social-cases/`)
      .then((res) => res?.data ?? [])
      .catch(() => []);
  }
}
const socialCaseService = new SocialCaseService();
const attachmentService = new IssueAttachmentService();

// Convierte una URL directa (sin credenciales) a base64
async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("loadend", () => resolve(reader.result as string));
    reader.addEventListener("error", () => reject(new Error("FileReader error")));
    reader.readAsDataURL(blob);
  });
}

// Obtiene la URL pre-firmada de MinIO a través del API de Django (que requiere auth)
// y luego descarga el archivo SIN credenciales (evita CORS wildcard+credentials)
async function fetchBase64WithAuth(apiUrl: string): Promise<string> {
  // Paso 1: pedir la URL pre-firmada como JSON (no redirect)
  const jsonRes = await fetch(`${apiUrl}?as_url=1`, { credentials: "include" });
  if (!jsonRes.ok) throw new Error(`HTTP ${jsonRes.status} al obtener URL`);
  const { url } = await jsonRes.json();
  // Paso 2: descargar de MinIO sin credenciales (pre-signed URL es auto-autenticada)
  return urlToBase64(url);
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  onClose: () => void;
};

export const SocialCaseReportModal = observer(function SocialCaseReportModal({ onClose }: Props) {
  const { workspaceSlug, projectId } = useParams();

  // Fix: usar getProjectById con el projectId del URL en vez de currentProjectDetails
  // que depende del router store global y puede estar cacheado de otro proyecto.
  const { getProjectById } = useProject();
  const projectDetails = getProjectById(projectId?.toString() ?? "");

  const { getProjectStates } = useProjectState();
  const memberRoot = useMember();

  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [includeCover, setIncludeCover] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [openAfter, setOpenAfter] = useState(true);
  const [estadosFilter, setEstadosFilter] = useState<string[]>([]); // [] = Todos
  const [selectedFichaId, setSelectedFichaId] = useState<string>("");
  const [generatingFicha, setGeneratingFicha] = useState(false);

  const toggleEstadoModal = (estado: string) =>
    setEstadosFilter((prev) => (prev.includes(estado) ? prev.filter((e) => e !== estado) : [...prev, estado]));

  // Fix: los issues del issueMap NO traen description_html (solo el detalle lo carga).
  // Fetacheamos directamente del API para tener el HTML completo con la ficha social.
  const [allIssues, setAllIssues] = useState<any[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(true);

  useEffect(() => {
    const ws = workspaceSlug?.toString();
    const pid = projectId?.toString();
    if (!ws || !pid) return;

    setLoadingIssues(true);
    socialCaseService
      .getSocialCases(ws, pid)
      .then((list) => setAllIssues(list))
      .finally(() => setLoadingIssues(false));
  }, [workspaceSlug, projectId]);

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

  // Mapa stateId → group para detectar casos resueltos
  const stateGroups = useMemo(() => {
    const map: Record<string, string> = {};
    (states ?? []).forEach((s) => {
      map[s.id] = s.group;
    });
    return map;
  }, [states]);

  // Casos resueltos (group === "completed") con datos parseados — para la ficha individual
  const casosResueltos = useMemo(() => {
    return allIssues
      .filter((issue) => issue && stateGroups[issue.state_id ?? ""] === "completed")
      .map((issue) => {
        const d = extractFromHtml(issue.description_html ?? "");
        const label = d?.nombre ? `${d.nombre}${d.cedula ? ` · ${d.cedula}` : ""}` : `GCS-${issue.sequence_id}`;
        return { id: issue.id, label, sequenceId: issue.sequence_id };
      });
  }, [allIssues, stateGroups]);

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

  const { rows, byState, byJornada, conResultado } = useMemo(() => {
    const parsedRows: ParsedIssueRow[] = [];
    const parsedByState: Record<string, number> = {};
    const parsedByJornada: Record<string, number> = {};
    let parsedConResultado = 0;

    for (const issue of allIssues) {
      if (!issue) continue;

      // Filtro de fechas
      if (fromDate || toDate) {
        const created = issue.created_at ? new Date(issue.created_at) : null;
        if (!created) continue;
        if (fromDate && created < fromDate) continue;
        if (toDate && created > toDate) continue;
      }

      const d = extractFromHtml(issue.description_html ?? "");

      // Filtro por estado de Venezuela (multi-selección)
      if (estadosFilter.length > 0) {
        const entidad = d?.entidad?.trim().toLowerCase() ?? "";
        if (!estadosFilter.some((e) => e.toLowerCase() === entidad)) continue;
      }
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
  }, [allIssues, stateNames, fromDate, toDate, memberRoot, estadosFilter]);

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
    setProgress({ current: 0, total: rows.length });
    try {
      const generatedAtLabel = new Date().toLocaleDateString("es-VE");
      const projectName = projectDetails?.name ?? "Proyecto";

      // Logo institucional
      let logoUrl: string | null = null;
      try {
        logoUrl = await urlToBase64(`${window.location.origin}/venezuela-logo.png`);
      } catch {
        logoUrl = null;
      }

      const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);
      const ws = workspaceSlug?.toString() ?? "";
      const pid = projectId?.toString() ?? "";

      let done = 0;
      const resolvedRows: ParsedIssueRow[] = await Promise.all(
        rows.map(async (row) => {
          // Resolver foto de perfil
          let resolvedPhotoUrl = row.photoUrl;
          if (includePhotos && row.photoUrl) {
            try {
              const raw = getFileURL(row.photoUrl) ?? row.photoUrl;
              const apiUrl = raw.startsWith("http") ? raw : `${window.location.origin}${raw}`;
              resolvedPhotoUrl = await fetchBase64WithAuth(apiUrl);
            } catch {
              resolvedPhotoUrl = null;
            }
          }

          // Resolver adjuntos
          let attachments: AttachmentInfo[] = [];
          if (includeAttachments && includeDetails) {
            try {
              const rawList = await attachmentService.getIssueAttachments(ws, pid, row.id);
              attachments = await Promise.all(
                (rawList ?? []).map(async (a) => {
                  const nameExt = (a.attributes?.name ?? "").split(".").pop()?.toLowerCase() ?? "";
                  const urlExt = (a.asset_url ?? "").split("?")[0].split(".").pop()?.toLowerCase() ?? "";
                  const ext = nameExt || urlExt;
                  const isImage = IMAGE_EXTS.has(ext);
                  if (isImage) {
                    try {
                      const url = getFileURL(a.asset_url) ?? a.asset_url;
                      const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
                      const base64 = await fetchBase64WithAuth(fullUrl);
                      return { name: a.attributes?.name ?? "archivo", isImage: true, base64 };
                    } catch {
                      return { name: a.attributes?.name ?? "archivo", isImage: false };
                    }
                  }
                  return { name: a.attributes?.name ?? "archivo", isImage: false };
                })
              );
            } catch {
              attachments = [];
            }
          }

          done += 1;
          setProgress({ current: done, total: rows.length });
          return { ...row, photoUrl: resolvedPhotoUrl, attachments };
        })
      );

      const blob = await pdf(
        <SocialCaseReportPDF
          rows={resolvedRows}
          projectName={projectName}
          dateRange={dateRangeLabel}
          byState={byState}
          byJornada={byJornada}
          conResultado={conResultado}
          generatedAtLabel={generatedAtLabel}
          stateFlow={stateFlow}
          includeCover={includeCover}
          includePhotos={includePhotos}
          includeDetails={includeDetails}
          includeAttachments={includeAttachments}
          logoUrl={logoUrl}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      if (openAfter) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const a = document.createElement("a");
        a.href = url;
        const safeName = projectName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        a.download = `reporte-${safeName}-${new Date().toISOString().split("T")[0]}.pdf`;
        a.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  // ── Ficha individual ────────────────────────────────────────────────────────

  const handleDownloadFicha = async () => {
    if (!selectedFichaId) return;
    const issue = allIssues.find((i) => i.id === selectedFichaId);
    if (!issue) return;

    setGeneratingFicha(true);
    try {
      const ws = workspaceSlug?.toString() ?? "";
      const pid = projectId?.toString() ?? "";
      const projectName = projectDetails?.name ?? "Proyecto";
      const generatedAtLabel = new Date().toLocaleDateString("es-VE");

      // Logo institucional
      let fichaLogoUrl: string | null = null;
      try {
        fichaLogoUrl = await urlToBase64(`${window.location.origin}/venezuela-logo.png`);
      } catch {
        fichaLogoUrl = null;
      }
      const d = extractFromHtml(issue.description_html ?? "");
      const photoUrlRaw = extractProfilePhotoFromHtml(issue.description_html ?? "");
      const stateName = stateNames[issue.state_id ?? ""] ?? "Resuelto";
      const assignees = (issue.assignee_ids ?? [])
        .map((id: string) => memberRoot.getUserDetails(id)?.display_name || memberRoot.getUserDetails(id)?.first_name)
        .filter(Boolean) as string[];
      const responsable = assignees.length > 0 ? assignees.join(", ") : "Sin asignar";

      // Resolver foto de perfil a base64
      let resolvedPhotoUrl: string | null = null;
      if (photoUrlRaw) {
        try {
          const raw = getFileURL(photoUrlRaw) ?? photoUrlRaw;
          const apiUrl = raw.startsWith("http") ? raw : `${window.location.origin}${raw}`;
          resolvedPhotoUrl = await fetchBase64WithAuth(apiUrl);
        } catch {
          resolvedPhotoUrl = null;
        }
      }

      // Resolver adjuntos imagen como evidencia de entrega
      const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);
      let fichaAttachments: FichaAttachment[] = [];
      try {
        const rawList = await attachmentService.getIssueAttachments(ws, pid, issue.id);
        fichaAttachments = await Promise.all(
          (rawList ?? []).map(async (a) => {
            const nameExt = (a.attributes?.name ?? "").split(".").pop()?.toLowerCase() ?? "";
            const urlExt = (a.asset_url ?? "").split("?")[0].split(".").pop()?.toLowerCase() ?? "";
            const ext = nameExt || urlExt;
            const isImage = IMAGE_EXTS.has(ext);
            if (isImage) {
              try {
                const url = getFileURL(a.asset_url) ?? a.asset_url;
                const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
                const base64 = await fetchBase64WithAuth(fullUrl);
                return { name: a.attributes?.name ?? "archivo", isImage: true, base64 };
              } catch {
                return { name: a.attributes?.name ?? "archivo", isImage: false };
              }
            }
            return { name: a.attributes?.name ?? "archivo", isImage: false };
          })
        );
      } catch {
        fichaAttachments = [];
      }

      const blob = await pdf(
        <SocialCaseFichaPDF
          data={
            (d ?? {
              numeroCaso: "",
              cedula: "",
              nombre: "",
              telefono: "",
              direccion: "",
              parroquia: "",
              municipio: "",
              entidad: "",
              jornada: "",
              referencia: "",
              accionTomada: "",
              resultado: "",
              mismoBeneficiario: "true",
              solicitante: "",
              nombreBeneficiario: "",
              cedulaBeneficiario: "",
              observacionCierre: "",
              fechaCierre: "",
            }) as SocialCaseData
          }
          projectName={projectName}
          stateName={stateName}
          sequenceId={issue.sequence_id}
          responsable={responsable}
          photoUrl={resolvedPhotoUrl}
          attachments={fichaAttachments}
          generatedAtLabel={generatedAtLabel}
          logoUrl={fichaLogoUrl}
          startDate={issue.start_date ?? issue.created_at?.slice(0, 10) ?? null}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      if (openAfter) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `ficha-gcs${issue.sequence_id}-${new Date().toISOString().split("T")[0]}.pdf`;
        a.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setGeneratingFicha(false);
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
          <p className="text-12 text-tertiary">{projectDetails?.name}</p>
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

        {/* Filtro por estado de Venezuela */}
        <div className="space-y-2">
          <p className="text-12 text-tertiary">Filtrar por estado</p>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {/* Chip "Todos" — limpia la selección */}
              <button
                type="button"
                onClick={() => setEstadosFilter([])}
                className={cn(
                  "rounded-full border px-3 py-1 text-11 font-medium transition-colors",
                  estadosFilter.length === 0
                    ? "border-accent-primary bg-accent-primary text-white"
                    : "border-subtle bg-surface-2 text-tertiary hover:bg-layer-1 hover:text-secondary"
                )}
              >
                Todos
              </button>
              {VENEZUELA_ESTADOS.map((estado) => {
                const selected = estadosFilter.includes(estado);
                return (
                  <button
                    key={estado}
                    type="button"
                    onClick={() => toggleEstadoModal(estado)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-3 py-1 text-11 font-medium transition-colors",
                      selected
                        ? "border-accent-primary bg-accent-primary text-white"
                        : "border-subtle bg-surface-2 text-tertiary hover:bg-layer-1 hover:text-secondary"
                    )}
                  >
                    {selected && (
                      <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
                        <path
                          d="M1.5 5L4 7.5L8.5 2.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    {estado}
                  </button>
                );
              })}
            </div>
            {estadosFilter.length > 0 && (
              <button
                type="button"
                onClick={() => setEstadosFilter([])}
                className="text-11 text-accent-primary hover:underline"
              >
                Limpiar selección ({estadosFilter.length})
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-subtle bg-surface-2 p-4">
          <p className="text-12 text-tertiary">
            {dateRangeLabel}
            {estadosFilter.length > 0 ? ` · ${estadosFilter.join(", ")}` : ""}
          </p>
          {loadingIssues ? (
            <p className="mt-3 text-12 text-tertiary">Cargando casos...</p>
          ) : (
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
          )}
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

          <div
            className={cn("flex cursor-pointer items-center justify-between gap-3", !includeDetails && "opacity-40")}
          >
            <div className="space-y-0.5">
              <p className="text-13 text-secondary">Incluir adjuntos</p>
              <p className="text-12 text-tertiary">
                Una página por adjunto (imágenes y archivos). Requiere reporte completo.
              </p>
            </div>
            <Checkbox
              checked={includeAttachments}
              onChange={() => setIncludeAttachments((v) => !v)}
              disabled={generating || !includeDetails}
            />
          </div>

          <div className="flex cursor-pointer items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-13 text-secondary">Abrir PDF al finalizar</p>
              <p className="text-12 text-tertiary">Útil para previsualizar antes de guardar.</p>
            </div>
            <Checkbox checked={openAfter} onChange={() => setOpenAfter((v) => !v)} disabled={generating} />
          </div>
        </div>

        {progress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-12 text-tertiary">
                Procesando caso {progress.current} de {progress.total}...
              </p>
              <p className="text-12 font-medium text-tertiary">
                {Math.round((progress.current / progress.total) * 100)}%
              </p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent-primary transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ── FICHA INDIVIDUAL ─────────────────────────────────────────── */}
        <div
          className={cn(
            "space-y-3 rounded-lg border p-4",
            casosResueltos.length > 0 ? "border-green-500/40 bg-green-500/5" : "border-subtle bg-surface-2 opacity-60"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-13 font-medium text-secondary">Ficha técnica individual</p>
              <p className="text-12 text-tertiary">
                {casosResueltos.length > 0
                  ? `${casosResueltos.length} caso${casosResueltos.length !== 1 ? "s" : ""} resuelto${casosResueltos.length !== 1 ? "s" : ""} disponible${casosResueltos.length !== 1 ? "s" : ""}`
                  : "Sin casos resueltos en el proyecto"}
              </p>
            </div>
          </div>

          {casosResueltos.length > 0 && (
            <div className="flex items-center gap-3">
              <select
                className="focus:border-accent-primary h-9 flex-1 rounded-md border border-subtle bg-surface-1 px-3 text-12 text-secondary focus:outline-none"
                value={selectedFichaId}
                onChange={(e) => setSelectedFichaId(e.target.value)}
                disabled={generatingFicha || loadingIssues}
              >
                <option value="">— Seleccionar caso resuelto —</option>
                {casosResueltos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="primary"
                onClick={handleDownloadFicha}
                disabled={!selectedFichaId || generatingFicha || loadingIssues}
                loading={generatingFicha}
              >
                {!generatingFicha && <FileDown className="mr-2 size-4" />}
                Generar ficha
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={generating || generatingFicha}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleDownload}
            disabled={rows.length === 0 || generating || loadingIssues}
            loading={generating || loadingIssues}
          >
            {!generating && !loadingIssues && <FileDown className="mr-2 size-4" />}
            {loadingIssues ? "Cargando casos..." : openAfter ? "Generar y abrir PDF" : `Descargar PDF (${rows.length})`}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
