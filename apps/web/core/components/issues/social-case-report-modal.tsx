// rebuild
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { FileDown, FileSpreadsheet, ChevronDown, X } from "lucide-react";
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
const toUpperOrDash = (v: string | undefined | null) => (v ?? "-").toUpperCase();

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
  // Usar & si la URL ya tiene query params para no malformar la URL
  const sep = apiUrl.includes("?") ? "&" : "?";
  const jsonRes = await fetch(`${apiUrl}${sep}as_url=1`, { credentials: "include" });
  if (!jsonRes.ok) throw new Error(`HTTP ${jsonRes.status} al obtener URL`);
  const { url } = await jsonRes.json();
  // Paso 2: descargar de MinIO sin credenciales (pre-signed URL es auto-autenticada)
  return urlToBase64(url);
}

// ── FilterDropdown ────────────────────────────────────────────────────────────

type FilterDropdownProps = {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (value: string) => void;
  onClear: () => void;
  disabled?: boolean;
};

function FilterDropdown({ label, options, selected, onChange, onClear, disabled }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  // Limpiar búsqueda al cerrar
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-md border px-3 py-1.5 text-12 font-medium transition-colors",
          selected.length > 0
            ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
            : "border-subtle bg-surface-2 text-secondary hover:bg-layer-1",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-primary px-1 text-10 font-semibold text-white">
            {selected.length}
          </span>
        )}
        {selected.length > 0 ? (
          <X
            className="h-3 w-3 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          />
        ) : (
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && (
        <div className="shadow-lg absolute top-full left-0 z-50 mt-1.5 w-56 rounded-lg border border-subtle bg-surface-1">
          {/* Search */}
          <div className="border-b border-subtle px-3 py-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-transparent text-12 text-secondary outline-none placeholder:text-tertiary"
            />
          </div>
          {/* Options */}
          <div className="vertical-scrollbar scrollbar-sm max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-12 text-tertiary">Sin resultados</p>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(opt)}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-12 text-secondary transition-colors hover:bg-surface-2"
                  >
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors",
                        isSelected ? "border-accent-primary bg-accent-primary" : "border-custom-border-300"
                      )}
                    >
                      {isSelected && (
                        <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M1.5 5L4 7.5L8.5 2.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{opt}</span>
                  </button>
                );
              })
            )}
          </div>
          {/* Footer */}
          {selected.length > 0 && (
            <div className="border-t border-subtle px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className="text-11 text-accent-primary hover:underline"
              >
                Limpiar selección ({selected.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  const [generatingType, setGeneratingType] = useState<"pdf" | "excel" | null>(null);
  const generating = generatingType !== null;
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [includeCover, setIncludeCover] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [openAfter, setOpenAfter] = useState(true);
  const [estadosFilter, setEstadosFilter] = useState<string[]>([]); // [] = Todos
  const toggleEstadoModal = (estado: string) =>
    setEstadosFilter((prev) => (prev.includes(estado) ? prev.filter((e) => e !== estado) : [...prev, estado]));
  const [actividadFilter, setActividadFilter] = useState<string[]>([]);
  const toggleActividadFilter = (act: string) =>
    setActividadFilter((prev) => (prev.includes(act) ? prev.filter((a) => a !== act) : [...prev, act]));

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

  const actividadesUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const issue of allIssues) {
      const d = extractFromHtml(issue?.description_html ?? "");
      const jornada = d?.jornada?.trim();
      if (jornada) set.add(jornada);
    }
    // oxlint-disable-next-line unicorn/no-array-sort
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [allIssues]);

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

      // Filtro por actividad (jornada)
      if (actividadFilter.length > 0) {
        const jornada = d?.jornada?.trim() ?? "";
        if (!actividadFilter.includes(jornada)) continue;
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
  }, [allIssues, stateNames, fromDate, toDate, memberRoot, estadosFilter, actividadFilter]);

  const dateRangeLabel = useMemo(() => {
    if (!fromDate && !toDate) return "Todos los registros";
    const f = fromDate ? formatDate(fromDate) : "...";
    const t2 = toDate ? formatDate(toDate) : "hoy";
    return `${f} – ${t2}`;
  }, [fromDate, toDate]);

  // ── PDF generation ─────────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (rows.length === 0) return;
    setGeneratingType("pdf");
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
      setGeneratingType(null);
      setProgress(null);
    }
  };

  // ── Excel generation ────────────────────────────────────────────────────────

  const handleDownloadExcel = async () => {
    if (rows.length === 0) return;
    setGeneratingType("excel");
    setProgress({ current: 0, total: rows.length });
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Reporte");

      const projectName = projectDetails?.name ?? "Proyecto";
      const ws = workspaceSlug?.toString() ?? "";
      const pid = projectId?.toString() ?? "";

      // ── Constantes de imágenes ────────────────────────────────────────────
      // Cédula: 5 cm × 3 cm → 189 × 113 px a 96 DPI
      const PHOTO_W_PX = 189;
      const PHOTO_H_PX = 113;
      // ExcelJS usa mdw=7 internamente (Calibri 11): px = width * 7 + 5
      // Cédula 189px → min units = ceil((189-5)/7) = 27, con margen generoso = 38
      const PHOTO_COL_W = 38; // idx 7
      // Reseña: 2 imgs×94px + gaps = 200px → min = ceil(195/7) = 28, con margen = 40
      const RESENA_IMG_W = 94; // 2.5 cm → 94 px
      const RESENA_IMG_H = 113; // 3 cm → 113 px
      const RESENA_COL_IDX = 8;
      const RESENA_COL_W = 40; // idx 8 — margen generoso para 2 imágenes
      const RESENA_COL_W_PX = RESENA_COL_W * 7 + 5; // mdw=7, mismo que usa ExcelJS
      const RESENA_GAP = 4; // px entre imágenes
      const IMAGE_EXTS_XLS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);
      const SLOT_PREFIXES_XLS = ["[CI_SOL]", "[CI_BEN]", "[ENTREGA]"];

      // ── Columnas (11 total) ───────────────────────────────────────────────
      sheet.columns = [
        { key: "num" },
        { key: "nombre" },
        { key: "cedula" },
        { key: "telefono" },
        { key: "direccion" },
        { key: "tipo" },
        { key: "descripcion" },
        { key: "foto", width: PHOTO_COL_W },
        { key: "resena", width: RESENA_COL_W },
        { key: "organismo" },
        { key: "observacion" },
      ];
      // Longitud máxima por columna — inicializada con los encabezados de tabla
      // idx 7 y 8 son fotos → 0
      const colMaxLen = [2, 38, 20, 14, 26, 14, 28, 0, 0, 22, 24];

      // ── Logo ───────────────────────────────────────────────────────────────
      let logoId: number | null = null;
      try {
        const logoFull = await urlToBase64(`${window.location.origin}/venezuela-logo.png`);
        const mimeMatch = logoFull.match(/^data:image\/(\w+);base64,/);
        const ext = (mimeMatch?.[1] ?? "png") as "png" | "jpeg" | "gif";
        logoId = workbook.addImage({ base64: logoFull.split(",")[1], extension: ext });
      } catch {
        logoId = null;
      }

      // ── Filas de encabezado (filas 1–3) ───────────────────────────────────
      const HEADER_BG = "FF1e3a5f";
      const WHITE = "FFFFFFFF";

      sheet.addRow([]); // fila 1 — logo
      sheet.addRow([]); // fila 2 — nombre de la actividad
      sheet.addRow([]); // fila 3 — fecha de inicio del primer caso

      sheet.getRow(1).height = 70;
      sheet.getRow(2).height = 40;
      sheet.getRow(3).height = 28;

      // A1:K1 — logo ocupa toda la fila 1 (11 columnas)
      sheet.mergeCells("A1:K1");
      sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
      if (logoId !== null) {
        // tl = inicio columna A, fila 1 — br = mitad columna G, fin fila 1
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sheet.addImage(logoId, { tl: { col: 0, row: 0 } as any, br: { col: 6.5, row: 1 } as any });
      }

      // A2:K2 — nombre de la actividad (jornada)
      sheet.mergeCells("A2:K2");
      const jornadaUnique =
        rows.length > 0 && rows[0].jornada !== "-" && rows.every((r) => r.jornada === rows[0].jornada)
          ? rows[0].jornada.toUpperCase()
          : projectName.toUpperCase();
      sheet.getCell("A2").value = jornadaUnique;
      sheet.getCell("A2").font = { bold: true, size: 18, name: "Arial", color: { argb: "FF000000" } };
      sheet.getCell("A2").alignment = { vertical: "middle", horizontal: "center", wrapText: true };

      // A3:K3 — fecha de inicio del primer caso de la actividad
      sheet.mergeCells("A3:K3");
      const firstCaseStartDate = rows
        .map(
          (r) =>
            allIssues.find((is) => is.id === r.id)?.start_date ??
            allIssues.find((is) => is.id === r.id)?.created_at?.slice(0, 10)
        )
        .filter(Boolean)
        // oxlint-disable-next-line unicorn/no-array-sort
        .sort()[0];
      const firstCaseDateLabel = firstCaseStartDate
        ? new Date(firstCaseStartDate + "T00:00:00")
            .toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })
            .toUpperCase()
        : "-";
      sheet.getCell("A3").value = `FECHA DE INICIO: ${firstCaseDateLabel}`;
      sheet.getCell("A3").font = { bold: true, size: 16, name: "Arial", color: { argb: "FF000000" } };
      sheet.getCell("A3").alignment = { vertical: "middle", horizontal: "center" };

      // ── Fila de cabecera de tabla (fila 4) ─────────────────────────────────
      const BORDER_THIN = { style: "thin" as const, color: { argb: "FF9ca3af" } };
      const tableHeaderRow = sheet.addRow([
        "N°",
        "NOMBRES Y APELLIDOS DEL SOLICITANTE",
        "CÉDULA DE IDENTIDAD",
        "TELÉFONO",
        "DIRECCIÓN DE HABITACIÓN",
        "TIPO DE CASO",
        "DESCRIPCIÓN DE LA SOLICITUD",
        "CÉDULA DE IDENTIDAD",
        "RESEÑA FOTOGRÁFICA",
        "ORGANISMO COMPETENTE",
        "OBSERVACIÓN",
      ]);
      tableHeaderRow.height = 44; // 59 px × 0.75 = 44 pt
      tableHeaderRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cell.font = { bold: true, color: { argb: WHITE }, size: 12, name: "Arial" };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
      });

      // Sin fotos: no forzar height → Excel auto-calcula al abrir (sin customHeight="1")
      // Con fotos: forzar mínimo para que quepa la imagen (3 cm ≈ 85 pt)
      // 1 cm = 28.35 pt → 3 cm ≈ 85 pt
      const PHOTO_ROW_H_PT = Math.ceil((PHOTO_H_PX / 96) * 2.54 * 28.35); // px→cm→pt

      // ── Filas de datos (orden ascendente: más antiguo primero) ────────────
      // oxlint-disable-next-line unicorn/no-array-sort
      const sortedRows = [...rows].sort((a, b) => {
        const ia = allIssues.find((is) => is.id === a.id);
        const ib = allIssues.find((is) => is.id === b.id);
        return (ia?.created_at ?? "").localeCompare(ib?.created_at ?? "");
      });
      let done = 0;

      for (let i = 0; i < sortedRows.length; i++) {
        const row = sortedRows[i];
        const issue = allIssues.find((is) => is.id === row.id);
        const d = issue ? extractFromHtml(issue.description_html ?? "") : null;
        const isEven = i % 2 === 0;
        const ROW_BG = isEven ? "FFF3F4F6" : "FFFFFFFF";
        const BORDER_DATA = { style: "thin" as const, color: { argb: "FFd1d5db" } };
        const cellValues = [
          toUpperOrDash(d?.numeroCaso), // 0
          toUpperOrDash(row.nombre), // 1
          toUpperOrDash(row.cedula), // 2
          toUpperOrDash(d?.telefono), // 3
          toUpperOrDash(d?.direccion), // 4
          toUpperOrDash(issue?.name), // 5
          toUpperOrDash(row.referencia), // 6
          "", // 7 — cédula foto
          "", // 8 — reseña fotográfica
          toUpperOrDash(row.responsable), // 9
          toUpperOrDash(d?.observacionCierre), // 10
        ];
        // Rastrear longitud máxima (excluir columnas de foto idx 7 y 8)
        cellValues.forEach((val, idx) => {
          if (idx !== 7 && idx !== 8) colMaxLen[idx] = Math.max(colMaxLen[idx], val.length);
        });
        const dataRow = sheet.addRow(cellValues);
        if (includePhotos) {
          // Altura = máximo entre mínimo de foto y texto más largo estimado
          const PT_PER_LINE = 15;
          const CHARS_EST = 18; // chars por línea con columnas auto-ajustadas
          let maxLines = 1;
          cellValues.forEach((val, idx) => {
            if (idx === 7 || idx === 8) return;
            maxLines = Math.max(maxLines, Math.ceil(val.length / CHARS_EST));
          });
          dataRow.height = Math.max(PHOTO_ROW_H_PT, maxLines * PT_PER_LINE);
        }
        dataRow.eachCell((cell, colNum) => {
          if (colNum !== 8 && colNum !== 9) {
            // 1-based: col 8=cédula foto, 9=reseña
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_BG } };
          }
          cell.font = { size: 12, name: "Arial" };
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          cell.border = { top: BORDER_DATA, bottom: BORDER_DATA, left: BORDER_DATA, right: BORDER_DATA };
        });
        dataRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };

        // ── Fotos: cédula + reseña fotográfica ────────────────────────────
        if (includePhotos) {
          try {
            // oxlint-disable-next-line no-await-in-loop
            const attList = await attachmentService.getIssueAttachments(ws, pid, row.id);
            const rowZero = sheet.rowCount - 1; // índice 0-based de esta fila

            // Cédula — [CI_BEN] primero, [CI_SOL] como fallback
            const cedulaAtt =
              attList?.find((a) => a.attributes?.name?.startsWith("[CI_BEN]")) ??
              attList?.find((a) => a.attributes?.name?.startsWith("[CI_SOL]"));
            if (cedulaAtt) {
              const rawUrl = getFileURL(cedulaAtt.asset_url) ?? cedulaAtt.asset_url;
              const fullUrl = rawUrl.startsWith("http") ? rawUrl : `${window.location.origin}${rawUrl}`;
              // oxlint-disable-next-line no-await-in-loop
              const base64Full = await fetchBase64WithAuth(fullUrl);
              const mimeM = base64Full.match(/^data:image\/(\w+);base64,/);
              const ext = (mimeM?.[1] ?? "jpeg") as "png" | "jpeg" | "gif";
              const imgId = workbook.addImage({ base64: base64Full.split(",")[1], extension: ext });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              sheet.addImage(imgId, {
                tl: { col: 7, row: rowZero } as any,
                ext: { width: PHOTO_W_PX, height: PHOTO_H_PX },
              });
            }

            // Reseña fotográfica — adjuntos nativos (sin prefijo de slot)
            const nativeImgs = (attList ?? []).filter((a) => {
              const name = a.attributes?.name ?? "";
              const noPrefix = !SLOT_PREFIXES_XLS.some((p) => name.startsWith(p));
              const nameExt = name.split(".").pop()?.toLowerCase() ?? "";
              const urlExt = (a.asset_url ?? "").split("?")[0].split(".").pop()?.toLowerCase() ?? "";
              return noPrefix && IMAGE_EXTS_XLS.has(nameExt || urlExt);
            });
            if (nativeImgs.length > 0) {
              // Ajustar alto de fila si las imágenes en grilla necesitan más espacio
              const gridRows = Math.ceil(nativeImgs.length / 2);
              const reseñaHPx = gridRows * RESENA_IMG_H + (gridRows + 1) * RESENA_GAP;
              const reseñaHPt = Math.ceil(reseñaHPx * 0.75);
              dataRow.height = Math.max(dataRow.height ?? PHOTO_ROW_H_PT, reseñaHPt);
              const rowHPx = (dataRow.height ?? PHOTO_ROW_H_PT) * (96 / 72);

              for (let imgIdx = 0; imgIdx < nativeImgs.length; imgIdx++) {
                const att = nativeImgs[imgIdx];
                try {
                  const rawUrl = getFileURL(att.asset_url) ?? att.asset_url;
                  const fullUrl = rawUrl.startsWith("http") ? rawUrl : `${window.location.origin}${rawUrl}`;
                  // oxlint-disable-next-line no-await-in-loop
                  const b64 = await fetchBase64WithAuth(fullUrl);
                  const mimeM = b64.match(/^data:image\/(\w+);base64,/);
                  const ext = (mimeM?.[1] ?? "jpeg") as "png" | "jpeg" | "gif";
                  const imgId = workbook.addImage({ base64: b64.split(",")[1], extension: ext });
                  const gCol = imgIdx % 2;
                  const gRow = Math.floor(imgIdx / 2);
                  const xPx = RESENA_GAP + gCol * (RESENA_IMG_W + RESENA_GAP);
                  const yPx = RESENA_GAP + gRow * (RESENA_IMG_H + RESENA_GAP);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  sheet.addImage(imgId, {
                    tl: { col: RESENA_COL_IDX + xPx / RESENA_COL_W_PX, row: rowZero + yPx / rowHPx } as any,
                    ext: { width: RESENA_IMG_W, height: RESENA_IMG_H },
                  });
                } catch {
                  /* imagen no disponible */
                }
              }
            }
          } catch {
            /* adjuntos no disponibles */
          }
        }

        done++;
        setProgress({ current: done, total: rows.length });
      }

      // ── Auto-fit columnas por contenido (máx 36, mín 6) ──────────────────
      // Columna teléfono (idx 3): ancho fijo para números en una sola línea
      sheet.columns.forEach((col, idx) => {
        if (idx === 7) return; // cédula foto: ancho fijo
        if (idx === 8) {
          // reseña: mínimo el ancho de las fotos (5 cm ≈ 28 u)
          const len = colMaxLen[idx] ?? 0;
          col.width = Math.max(Math.ceil(len * 0.85) + 1, RESENA_COL_W);
          return;
        }
        if (idx === 3) {
          col.width = 18;
          return;
        } // teléfono: una línea
        const len = colMaxLen[idx] ?? 10;
        col.width = Math.min(Math.max(Math.ceil(len * 0.85) + 1, 6), 36);
      });

      // ── Descargar ──────────────────────────────────────────────────────────
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = projectName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      a.download = `reporte-${safeName}-${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setGeneratingType(null);
      setProgress(null);
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

        {/* Filtros */}
        <div className="space-y-2">
          <p className="text-12 text-tertiary">Filtros</p>
          <div className="flex flex-wrap gap-2">
            <FilterDropdown
              label="Estado del país"
              options={VENEZUELA_ESTADOS}
              selected={estadosFilter}
              onChange={toggleEstadoModal}
              onClear={() => setEstadosFilter([])}
              disabled={generating}
            />
            <FilterDropdown
              label="Actividad"
              options={actividadesUnicas}
              selected={actividadFilter}
              onChange={toggleActividadFilter}
              onClear={() => setActividadFilter([])}
              disabled={generating}
            />
          </div>
        </div>

        <div className="rounded-lg border border-subtle bg-surface-2 p-4">
          <p className="text-12 text-tertiary">
            {dateRangeLabel}
            {estadosFilter.length > 0 ? ` · ${estadosFilter.join(", ")}` : ""}
            {actividadFilter.length > 0 ? ` · ${actividadFilter.join(", ")}` : ""}
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
                {generatingType === "excel" ? "Exportando Excel" : "Procesando PDF"} — caso {progress.current} de{" "}
                {progress.total}...
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

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={generating}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleDownloadExcel}
            disabled={rows.length === 0 || generating || loadingIssues}
            loading={generatingType === "excel"}
          >
            {generatingType !== "excel" && <FileSpreadsheet className="mr-2 size-4" />}
            {loadingIssues ? "Cargando..." : `Exportar Excel (${rows.length})`}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleDownload}
            disabled={rows.length === 0 || generating || loadingIssues}
            loading={generatingType === "pdf" || loadingIssues}
          >
            {generatingType !== "pdf" && !loadingIssues && <FileDown className="mr-2 size-4" />}
            {loadingIssues ? "Cargando casos..." : openAfter ? "Generar y abrir PDF" : `Descargar PDF (${rows.length})`}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
