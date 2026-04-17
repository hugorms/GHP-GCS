import { useState, useEffect, useRef } from "react";
import { Button } from "@plane/propel/button";
import { cn, getFileURL } from "@plane/utils";
import { VENEZUELA_ESTADOS } from "./social-case-estados";

// ── Types ────────────────────────────────────────────────────────────────────

export type SocialCaseData = {
  numeroCaso: string;
  cedula: string;
  nombre: string;
  telefono: string;
  direccion: string;
  parroquia: string;
  municipio: string;
  entidad: string;
  jornada: string;
  referencia: string;
  accionTomada: string;
  resultado: string;
  // Campos de proceso (se activan en "En proceso")
  mismoBeneficiario: string; // "true" | ""
  // Campos de cierre (se activan al resolver el caso)
  solicitante: string;
  nombreBeneficiario: string;
  cedulaBeneficiario: string;
  observacionCierre: string;
  fechaCierre: string;
};

type Props = {
  issueId?: string;
  // "create-no-save"  → editable, guarda en localStorage, sin botón Guardar (el modal lo hace al crear)
  // "view"            → solo lectura con botón Editar → Guardar ficha (va a la DB)
  mode: "create-no-save" | "view";
  descriptionHtml?: string;
  onSave?: (newDescriptionHtml: string) => Promise<void>;
  /** Callback llamado en tiempo real con los datos del formulario (modo create-no-save) */
  onDataChange?: (data: SocialCaseData) => void;
  /** Si true, el caso ya está resuelto — sección cierre en solo lectura */
  isClosed?: boolean;
  /** Si true, el caso está en proceso — muestra sección de beneficiario y evidencia */
  isEnProceso?: boolean;
  /** Si true, el caso está en articulación — muestra sección cierre editable y botón "Resolver caso" */
  isArticulacion?: boolean;
  /** Llamado al guardar la ficha completa desde articulación para transicionar a Resuelto */
  onComplete?: () => Promise<void>;
  /** Llamado al subir un archivo a un slot específico de evidencia */
  onSlotUpload?: (slotPrefix: string, file: File) => Promise<void>;
  /** Archivos ya subidos por slot al montar (prefix → nombre de archivo) */
  initialSlotFiles?: Record<string, string>;
  /** Sube una nueva foto de perfil y devuelve la URL del asset */
  onPhotoUpload?: (file: File) => Promise<string>;
};

// ── Constants ────────────────────────────────────────────────────────────────

const EMPTY: SocialCaseData = {
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
  mismoBeneficiario: "",
  solicitante: "",
  nombreBeneficiario: "",
  cedulaBeneficiario: "",
  observacionCierre: "",
  fechaCierre: "",
};

export const PENDING_KEY = "social_case_pending";
export const PROFILE_PHOTO_KEY = "profile_photo_pending";

// Regex para identificar la etiqueta de foto de perfil en el description_html
const PHOTO_RE = /<img[^>]*data-profile-photo="1"[^>]*\/?>/;

// Marcador de inicio y fin de la tabla de la ficha dentro del description_html
const TABLE_START = '<table data-social-case="1">';
const TABLE_END = "</table>";
const TABLE_RE = /<table data-social-case="1">[\s\S]*?<\/table>/;

// Campos con sus etiquetas legibles para construir la tabla
const FIELDS: { key: keyof SocialCaseData; label: string }[] = [
  { key: "numeroCaso", label: "N\u00famero de caso" },
  { key: "cedula", label: "Cedula" },
  { key: "nombre", label: "Nombre" },
  { key: "telefono", label: "Telefono" },
  { key: "direccion", label: "Direccion" },
  { key: "parroquia", label: "Parroquia" },
  { key: "municipio", label: "Municipio" },
  { key: "entidad", label: "Estado" },
  { key: "jornada", label: "Jornada" },
  { key: "referencia", label: "Referencia" },
  { key: "accionTomada", label: "Accion tomada" },
  { key: "resultado", label: "Resultado" },
  { key: "mismoBeneficiario", label: "Mismo beneficiario" },
  { key: "solicitante", label: "Solicitante" },
  { key: "nombreBeneficiario", label: "Nombre del beneficiario" },
  { key: "cedulaBeneficiario", label: "Cedula del beneficiario" },
  { key: "observacionCierre", label: "Observacion de cierre" },
  { key: "fechaCierre", label: "Fecha de cierre" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Escapa caracteres HTML especiales para evitar XSS al inyectar valores en la tabla */
const escapeHtml = (str: string): string =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Lee la tabla del description_html y reconstruye el objeto SocialCaseData.
 *  Estrategia dual:
 *  1. Primero intenta leer el JSON del <caption> (robusto, ProseMirror lo conserva como texto)
 *  2. Si no, reconstruye campo a campo leyendo data-key de cada <td>
 */
export const extractFromHtml = (html: string): SocialCaseData | null => {
  if (!html?.match(TABLE_RE)) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const table = doc.querySelector('table[data-social-case="1"]');
    if (!table) return null;

    // Estrategia 1: leer JSON del caption
    const caption = table.querySelector("caption");
    if (caption?.textContent) {
      try {
        const parsed = JSON.parse(caption.textContent);
        if (parsed && typeof parsed === "object" && "cedula" in parsed) return parsed as SocialCaseData;
      } catch (_) {}
    }

    // Estrategia 2: reconstruir desde data-key de cada td
    const rows = table.querySelectorAll("tr");
    if (rows.length === 0) return null;
    const result = { ...EMPTY };
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 2) return;
      const key = cells[0].getAttribute("data-key") as keyof SocialCaseData | null;
      if (key && key in result) result[key] = cells[1].textContent ?? "";
    });
    return result;
  } catch {
    return null;
  }
};

/** Construye la tabla HTML con los datos y la inyecta al inicio del description_html.
 *  Incluye un <caption> con el JSON completo como respaldo de lectura
 *  por si ProseMirror reescribe los atributos data-key de las celdas.
 */
/** Elimina la tabla de la ficha del description_html para pasarle al editor solo el texto limpio */
export const stripSocialCaseFromHtml = (html: string): string =>
  (html ?? "").replace(TABLE_RE, "").replace(PHOTO_RE, "");

/** Inyecta la foto de perfil como img oculta al inicio del description_html */
export const injectProfilePhotoIntoHtml = (html: string, src: string): string => {
  const tag = `<img data-profile-photo="1" src="${src}" style="display:none" alt="profile-photo" />`;
  return tag + (html ?? "").replace(PHOTO_RE, "");
};

/** Extrae la URL de la foto de perfil del description_html, o null si no existe */
export const extractProfilePhotoFromHtml = (html: string): string | null => {
  if (!html) return null;
  const match = html.match(PHOTO_RE);
  if (!match) return null;
  const srcMatch = match[0].match(/src="([^"]+)"/);
  if (!srcMatch) return null;
  // Normaliza: si la URL es absoluta de la API, extrae el path relativo
  // para que getFileURL reconstruya con el API_BASE_URL actual (evita problemas de cambio de puerto)
  const url = srcMatch[1];
  const relMatch = url.match(/https?:\/\/[^/]+(\/api\/.+)/);
  return relMatch ? relMatch[1] : url;
};

export const injectSocialCaseIntoHtml = (html: string, data: SocialCaseData): string => {
  const rows = FIELDS.map(
    ({ key, label }) =>
      `<tr><td data-key="${key}" style="font-weight:600;padding:3px 10px 3px 0;white-space:nowrap;color:#6b7280;font-size:12px;">${label}</td>` +
      `<td style="padding:3px 0;font-size:13px;">${escapeHtml(data[key] ?? "")}</td></tr>`
  ).join("");

  // caption oculto con JSON completo — respaldo si ProseMirror reescribe data-key
  const caption = `<caption style="display:none">${JSON.stringify(data)}</caption>`;

  const table = `${TABLE_START}${caption}<tbody>${rows}</tbody>${TABLE_END}`;

  const cleaned = (html ?? "").replace(TABLE_RE, "");
  return table + cleaned;
};

// ── Styles ───────────────────────────────────────────────────────────────────

const sectionHeadClass = "block text-xs text-custom-text-300 uppercase tracking-wider mb-2.5";

const labelClass = "block text-xs text-custom-text-300 mb-0.5";

const fieldBase = "w-full rounded-md border-[0.5px] text-13 px-3 py-1.5 transition-colors";
const fieldEditable =
  "border-subtle bg-surface-2 text-primary placeholder:text-placeholder focus:border-strong focus:outline-none";
const fieldReadonly = "border-subtle bg-surface-1 text-primary cursor-default outline-none opacity-75";

// ── Component ────────────────────────────────────────────────────────────────

export const EVIDENCE_SLOTS = [
  { prefix: "[CI_SOL]", label: "Adj. C.I. Solicitante" },
  { prefix: "[CI_BEN]", label: "Adj. C.I. Beneficiario" },
  { prefix: "[ENTREGA]", label: "Adj. Registro Fotográfico" },
] as const;

const ARTICULACION_REQUIRED: (keyof SocialCaseData)[] = [
  "nombre",
  "cedula",
  "resultado",
  "referencia",
  "nombreBeneficiario",
  "cedulaBeneficiario",
];

export const SocialCaseForm = ({
  issueId,
  mode,
  descriptionHtml = "",
  onSave,
  onDataChange,
  isClosed = false,
  isEnProceso = false,
  isArticulacion = false,
  onComplete,
  onSlotUpload,
  initialSlotFiles = {},
  onPhotoUpload,
}: Props) => {
  const [data, setData] = useState<SocialCaseData>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [slotUploading, setSlotUploading] = useState<Record<string, boolean>>({});
  // prefix → nombre del archivo subido (persiste en sesión)
  const [slotFiles, setSlotFiles] = useState<Record<string, string>>(initialSlotFiles);
  const [photoUploading, setPhotoUploading] = useState(false);
  const savedData = useRef<SocialCaseData>(EMPTY);
  // Siempre apunta al descriptionHtml más reciente para evitar cierres obsoletos en save()
  const latestDescHtml = useRef(descriptionHtml);
  useEffect(() => {
    latestDescHtml.current = descriptionHtml;
  });

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create-no-save") {
      try {
        const stored = localStorage.getItem(PENDING_KEY);
        if (stored) setData(JSON.parse(stored));
      } catch (_) {}
      return;
    }

    // modo view: no recargar si el usuario está editando activamente
    if (editing) return;

    // modo view: leer desde description_html
    const extracted = extractFromHtml(descriptionHtml);
    if (extracted) {
      setData(extracted);
      return;
    }

    // si no hay datos en DB pero hay pendientes en localStorage → migrar a DB
    // Usamos sessionStorage por issueId para que el guard sobreviva re-mounts
    const migratedKey = issueId ? `social_case_migrated_${issueId}` : null;
    const alreadyMigrated = migratedKey ? sessionStorage.getItem(migratedKey) === "1" : false;

    if (!alreadyMigrated && issueId && onSave) {
      try {
        const pending = localStorage.getItem(PENDING_KEY);
        if (pending) {
          if (migratedKey) sessionStorage.setItem(migratedKey, "1");
          const parsed: SocialCaseData = JSON.parse(pending);
          setData(parsed);
          const newHtml = injectSocialCaseIntoHtml(latestDescHtml.current, parsed);
          onSave(newHtml)
            .then(() => {
              localStorage.removeItem(PENDING_KEY);
              // Limpiar el guard de sesión una vez confirmado — ya está en DB
              if (migratedKey) sessionStorage.removeItem(migratedKey);
              return undefined;
            })
            .catch(() => {
              if (migratedKey) sessionStorage.removeItem(migratedKey);
            });
        }
      } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId, mode, descriptionHtml, editing]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const NO_CAP = new Set<keyof SocialCaseData>(["numeroCaso", "cedula", "telefono"]);
  const TITLE_CAP = new Set<keyof SocialCaseData>(["nombre"]);

  const capFirst = (f: keyof SocialCaseData, v: string) => {
    if (NO_CAP.has(f)) return v;
    if (TITLE_CAP.has(f)) return v.replace(/\b\w/g, (c) => c.toUpperCase());
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  const update = (field: keyof SocialCaseData, value: string) => {
    const val = capFirst(field, value);
    setData((prev) => {
      const next = { ...prev, [field]: val };
      if (mode === "create-no-save") {
        try {
          localStorage.setItem(PENDING_KEY, JSON.stringify(next));
        } catch (_) {}
        onDataChange?.(next);
      }
      return next;
    });
    setSaved(false);
  };

  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      const newHtml = injectSocialCaseIntoHtml(latestDescHtml.current, data);
      await onSave(newHtml);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {
    } finally {
      setSaving(false);
    }
  };

  const saveAndComplete = async () => {
    if (!onSave || !onComplete) return;
    setSaving(true);
    try {
      const newHtml = injectSocialCaseIntoHtml(latestDescHtml.current, data);
      await onSave(newHtml);
      await onComplete();
      setEditing(false);
    } catch (_) {
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!onPhotoUpload || !onSave) return;
    setPhotoUploading(true);
    try {
      const assetUrl = await onPhotoUpload(file);
      const newHtml = injectProfilePhotoIntoHtml(latestDescHtml.current, assetUrl);
      await onSave(newHtml);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSlotUpload = async (prefix: string, file: File) => {
    if (!onSlotUpload) return;
    setSlotUploading((prev) => ({ ...prev, [prefix]: true }));
    try {
      await onSlotUpload(prefix, file);
      // Guardar nombre permanentemente — sin timeout
      setSlotFiles((prev) => ({ ...prev, [prefix]: file.name }));
    } finally {
      setSlotUploading((prev) => ({ ...prev, [prefix]: false }));
    }
  };

  const articulacionComplete = isArticulacion ? ARTICULACION_REQUIRED.every((k) => data[k]?.trim()) : false;

  const isEditable = mode === "create-no-save" || editing || isArticulacion || isEnProceso;

  const fc = (editable: boolean) => cn(fieldBase, editable ? fieldEditable : fieldReadonly);

  // Foto de perfil actual extraída del HTML
  const currentPhotoUrl = mode === "view" ? extractProfilePhotoFromHtml(descriptionHtml) : null;
  const photoDisplayUrl = currentPhotoUrl ? (getFileURL(currentPhotoUrl) ?? currentPhotoUrl) : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      {/* Foto de perfil — solo en modo view */}
      {mode === "view" && (
        <div className="flex justify-center py-2">
          <div className="relative">
            <div className="border-custom-border-200 shadow-sm h-32 w-24 overflow-hidden rounded-md border">
              {photoDisplayUrl ? (
                <img src={photoDisplayUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <div className="bg-custom-background-90 flex h-full w-full items-center justify-center">
                  <span className="text-xs text-custom-text-400 px-1 text-center">Sin foto</span>
                </div>
              )}
            </div>
            {onPhotoUpload && (
              <label className="border-custom-border-200 bg-custom-background-100 shadow-sm hover:bg-custom-background-80 absolute -right-1 -bottom-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={photoUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                    e.target.value = "";
                  }}
                />
                {photoUploading ? (
                  <span className="text-custom-text-300 text-[9px]">...</span>
                ) : (
                  <svg
                    className="text-custom-text-200 h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z"
                    />
                  </svg>
                )}
              </label>
            )}
          </div>
        </div>
      )}
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 py-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="group flex min-w-0 items-center gap-2 text-left"
        >
          <span className="text-sm font-normal text-custom-text-200 group-hover:text-custom-text-100 whitespace-nowrap transition-colors">
            Datos del ciudadano
          </span>
          <span className="text-xs text-custom-text-400 group-hover:text-custom-text-300 whitespace-nowrap transition-colors">
            {open ? "Ocultar" : "Mostrar"}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs text-custom-text-400 whitespace-nowrap">N° Caso</span>
          <input
            disabled={!isEditable}
            type="text"
            placeholder="000"
            value={data.numeroCaso}
            onChange={(e) => update("numeroCaso", e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "text-xs w-20 rounded-md border-[0.5px] px-2 py-1 text-center transition-colors",
              isEditable
                ? "border-subtle bg-surface-2 text-primary placeholder:text-placeholder focus:border-strong focus:outline-none"
                : "cursor-default border-subtle bg-surface-1 text-primary opacity-75 outline-none"
            )}
          />
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-5">
          <div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <label htmlFor="sc-cedula" className={labelClass}>
                  Cedula de identidad
                </label>
                <input
                  id="sc-cedula"
                  disabled={!isEditable}
                  className={fc(isEditable)}
                  placeholder="V-00.000.000"
                  value={data.cedula}
                  onChange={(e) => update("cedula", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="sc-nombre" className={labelClass}>
                  Nombre completo
                </label>
                <input
                  id="sc-nombre"
                  disabled={!isEditable}
                  autoCapitalize="words"
                  className={fc(isEditable)}
                  placeholder="Nombre y apellido"
                  value={data.nombre}
                  onChange={(e) => update("nombre", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="sc-telefono" className={labelClass}>
                  Telefono
                </label>
                <input
                  id="sc-telefono"
                  disabled={!isEditable}
                  className={fc(isEditable)}
                  placeholder="0424-000.00.00"
                  value={data.telefono}
                  onChange={(e) => update("telefono", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="sc-direccion" className={labelClass}>
                  Dirección de habitación
                </label>
                <input
                  id="sc-direccion"
                  disabled={!isEditable}
                  autoCapitalize="sentences"
                  className={fc(isEditable)}
                  placeholder="Barrio, sector, calle..."
                  value={data.direccion}
                  onChange={(e) => update("direccion", e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-x-6 gap-y-3">
              <div>
                <label htmlFor="sc-parroquia" className={labelClass}>
                  Parroquia
                </label>
                <input
                  id="sc-parroquia"
                  disabled={!isEditable}
                  autoCapitalize="sentences"
                  className={fc(isEditable)}
                  placeholder="Parroquia"
                  value={data.parroquia}
                  onChange={(e) => update("parroquia", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="sc-municipio" className={labelClass}>
                  Municipio
                </label>
                <input
                  id="sc-municipio"
                  disabled={!isEditable}
                  autoCapitalize="sentences"
                  className={fc(isEditable)}
                  placeholder="Municipio"
                  value={data.municipio}
                  onChange={(e) => update("municipio", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="sc-entidad" className={labelClass}>
                  Estado
                </label>
                <select
                  id="sc-entidad"
                  disabled={!isEditable}
                  className={fc(isEditable)}
                  value={data.entidad}
                  onChange={(e) => update("entidad", e.target.value)}
                >
                  <option value="">-- Seleccionar estado --</option>
                  {VENEZUELA_ESTADOS.map((est) => (
                    <option key={est} value={est}>
                      {est}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECCION 2: DATOS DEL CASO */}
          <div>
            <span className={sectionHeadClass}>Datos del caso</span>
            <div>
              <label htmlFor="sc-jornada" className={labelClass}>
                Actividad
              </label>
              <input
                id="sc-jornada"
                disabled={!isEditable}
                autoCapitalize="sentences"
                className={fc(isEditable)}
                placeholder="Nombre de la actividad"
                value={data.jornada}
                onChange={(e) => update("jornada", e.target.value)}
              />
            </div>
          </div>

          {/* SECCION 3: SEGUIMIENTO */}
          <div>
            <span className={sectionHeadClass}>Seguimiento</span>
            <div className="space-y-3">
              <div>
                <label htmlFor="sc-referencia" className={labelClass}>
                  Solicitud / Beneficio
                </label>
                <textarea
                  id="sc-referencia"
                  disabled={!isEditable}
                  autoCapitalize="sentences"
                  className={cn(fc(isEditable), "min-h-[64px] resize-y leading-relaxed")}
                  placeholder="Describe por que llego el caso y que solicito el ciudadano..."
                  value={data.referencia}
                  onChange={(e) => update("referencia", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="sc-accion" className={labelClass}>
                  Accion tomada
                </label>
                <textarea
                  id="sc-accion"
                  disabled={!isEditable}
                  autoCapitalize="sentences"
                  className={cn(fc(isEditable), "min-h-[64px] resize-y leading-relaxed")}
                  placeholder="Describe que se hizo para atender el caso..."
                  value={data.accionTomada}
                  onChange={(e) => update("accionTomada", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="sc-resultado" className={labelClass}>
                  Resultado / Beneficio otorgado
                </label>
                <textarea
                  id="sc-resultado"
                  disabled={!isEditable}
                  autoCapitalize="sentences"
                  className={cn(fc(isEditable), "min-h-[52px] resize-y leading-relaxed")}
                  placeholder="Que se otorgo o por que no se pudo resolver..."
                  value={data.resultado}
                  onChange={(e) => update("resultado", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SECCION 4: EN PROCESO — visible en "En proceso", articulación y resuelto */}
          {(isEnProceso || isArticulacion || isClosed) && (
            <div
              className={cn(
                "space-y-3 rounded-md border p-3",
                isEnProceso && !isArticulacion && !isClosed
                  ? "border-yellow-500/30 bg-yellow-500/5"
                  : isClosed
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-blue-500/30 bg-blue-500/5"
              )}
            >
              <span className={cn(sectionHeadClass, "text-yellow-600 dark:text-yellow-400 mb-0")}>
                Identificación del beneficiario
              </span>

              {/* Checkbox mismo beneficiario */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  disabled={isClosed}
                  checked={data.mismoBeneficiario === "true"}
                  onChange={(e) => update("mismoBeneficiario", e.target.checked ? "true" : "")}
                  className="accent-custom-primary h-4 w-4 rounded border-subtle"
                />
                <span className="text-sm text-custom-text-200">El solicitante es el mismo beneficiario</span>
              </label>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label htmlFor="sc-nombre-beneficiario2" className={labelClass}>
                    Nombre del beneficiario
                  </label>
                  <input
                    id="sc-nombre-beneficiario2"
                    disabled={isClosed}
                    autoCapitalize="words"
                    className={fc(!isClosed)}
                    placeholder="Si es diferente al ciudadano"
                    value={data.nombreBeneficiario}
                    onChange={(e) => update("nombreBeneficiario", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="sc-cedula-beneficiario2" className={labelClass}>
                    Cédula del beneficiario
                  </label>
                  <input
                    id="sc-cedula-beneficiario2"
                    disabled={isClosed}
                    className={fc(!isClosed)}
                    placeholder="V-00.000.000"
                    value={data.cedulaBeneficiario}
                    onChange={(e) => update("cedulaBeneficiario", e.target.value)}
                  />
                </div>
              </div>

              {/* Slots de evidencia */}
              {onSlotUpload && !isClosed && (
                <div>
                  <span className={cn(sectionHeadClass, "mb-2")}>Evidencia fotográfica</span>
                  <div className="flex flex-wrap gap-2">
                    {EVIDENCE_SLOTS.filter(
                      (slot) => slot.prefix !== "[CI_SOL]" || data.mismoBeneficiario !== "true"
                    ).map((slot) => {
                      const isRegistro = slot.prefix === "[ENTREGA]";
                      const uploaded = slotFiles[slot.prefix];
                      const uploading = slotUploading[slot.prefix];
                      // Para REGISTRO: contar cuántas fotos hay (busca key con prefijo [ENTREGA]_N)
                      const registroCount = isRegistro
                        ? Object.keys(slotFiles).filter((k) => k.startsWith("[ENTREGA]")).length
                        : 0;
                      const displayLabel = isRegistro
                        ? registroCount > 0
                          ? `✓ ${slot.label} (${registroCount})`
                          : slot.label
                        : uploaded
                          ? `✓ ${slot.label}`
                          : slot.label;
                      return (
                        <div key={slot.prefix} className="flex flex-col gap-1">
                          <label
                            className={cn(
                              "text-xs flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 transition-colors",
                              uploading
                                ? "border-blue-300 bg-blue-50 text-blue-500 dark:bg-blue-900/20"
                                : (isRegistro ? registroCount > 0 : !!uploaded)
                                  ? "border-green-400 bg-green-50 text-green-600 dark:bg-green-900/20"
                                  : "text-custom-text-200 hover:text-custom-text-100 border-subtle bg-surface-2 hover:border-strong"
                            )}
                          >
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              disabled={uploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (isRegistro) {
                                  // Prefijo único por contador para permitir múltiples
                                  const count = Object.keys(slotFiles).filter((k) => k.startsWith("[ENTREGA]")).length;
                                  const uniquePrefix = `[ENTREGA]_${count + 1}`;
                                  handleSlotUpload(uniquePrefix, file);
                                } else {
                                  handleSlotUpload(slot.prefix, file);
                                }
                                e.target.value = "";
                              }}
                            />
                            {uploading ? "Subiendo..." : displayLabel}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Guardar cambios en modo En proceso */}
              {isEnProceso && !isArticulacion && !isClosed && mode === "view" && (
                <div className="flex justify-end pt-1">
                  <Button type="button" variant="primary" size="sm" loading={saving} onClick={save}>
                    {saved ? "Guardado" : "Guardar"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* SECCION 5: CIERRE DEL CASO — visible en articulación (editable) o resuelto (lectura) */}
          {(isClosed || isArticulacion) && (
            <div
              className={cn(
                "space-y-3 rounded-md border p-3",
                isArticulacion && !isClosed ? "border-blue-500/30 bg-blue-500/5" : "border-green-500/30 bg-green-500/5"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    sectionHeadClass,
                    "mb-0",
                    isArticulacion && !isClosed
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-green-600 dark:text-green-400"
                  )}
                >
                  {isArticulacion && !isClosed ? "Articulación del caso" : "Cierre del caso"}
                </span>
                {isArticulacion && !isClosed && (
                  <span className="text-xs text-custom-text-400">
                    {ARTICULACION_REQUIRED.filter((k) => data[k]?.trim()).length}/{ARTICULACION_REQUIRED.length} campos
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label htmlFor="sc-solicitante" className={labelClass}>
                    Solicitante
                  </label>
                  <input
                    id="sc-solicitante"
                    disabled={!isEditable}
                    autoCapitalize="words"
                    className={fc(isEditable)}
                    placeholder="Nombre del solicitante"
                    value={data.solicitante}
                    onChange={(e) => update("solicitante", e.target.value)}
                  />
                </div>
                {!isArticulacion && (
                  <div>
                    <label htmlFor="sc-fecha-cierre" className={labelClass}>
                      Fecha de cierre
                    </label>
                    <input
                      id="sc-fecha-cierre"
                      type="date"
                      disabled={!isEditable}
                      className={fc(isEditable)}
                      value={data.fechaCierre}
                      onChange={(e) => update("fechaCierre", e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="sc-obs-cierre" className={labelClass}>
                  Observación de cierre
                </label>
                <textarea
                  id="sc-obs-cierre"
                  disabled={!isEditable}
                  autoCapitalize="sentences"
                  className={cn(fc(isEditable), "min-h-[56px] resize-y leading-relaxed")}
                  placeholder="Notas adicionales sobre el cierre del caso..."
                  value={data.observacionCierre}
                  onChange={(e) => update("observacionCierre", e.target.value)}
                />
              </div>

              {/* Botón resolver caso — solo en articulación */}
              {isArticulacion && !isClosed && mode === "view" && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  {!articulacionComplete && (
                    <span className="text-xs text-custom-text-400">
                      Completa los campos requeridos para resolver el caso
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={saving}
                    disabled={!articulacionComplete}
                    onClick={saveAndComplete}
                  >
                    Resolver caso
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* BOTONES — solo en modo view */}
          {mode === "view" && (
            <div className="flex items-center justify-end gap-2 pt-1">
              {!editing && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    savedData.current = data;
                    setEditing(true);
                  }}
                >
                  Editar ficha
                </Button>
              )}
              {editing && (
                <>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="sm"
                    onClick={() => {
                      setData(savedData.current);
                      setEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" variant="primary" size="sm" loading={saving} onClick={save}>
                    {saved ? "Guardado" : "Guardar ficha"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SocialCaseForm;
