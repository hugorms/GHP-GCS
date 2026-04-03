import { useState, useEffect, useRef } from "react";
import { Button } from "@plane/propel/button";
import { cn } from "@plane/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type SocialCaseData = {
  cedula: string;
  nombre: string;
  telefono: string;
  direccion: string;
  parroquia: string;
  municipio: string;
  entidad: string;
  jornada: string;
  tipoCaso: string;
  fechaAtencion: string;
  referencia: string;
  accionTomada: string;
  resultado: string;
  fechaResolucion: string;
};

type Props = {
  issueId?: string;
  // "create-no-save"  → editable, guarda en localStorage, sin botón Guardar (el modal lo hace al crear)
  // "view"            → solo lectura con botón Editar → Guardar ficha (va a la DB)
  mode: "create-no-save" | "view";
  descriptionHtml?: string;
  onSave?: (newDescriptionHtml: string) => Promise<void>;
};

// ── Constants ────────────────────────────────────────────────────────────────

const EMPTY: SocialCaseData = {
  cedula: "", nombre: "", telefono: "", direccion: "",
  parroquia: "", municipio: "", entidad: "", jornada: "",
  tipoCaso: "", fechaAtencion: "", referencia: "",
  accionTomada: "", resultado: "", fechaResolucion: "",
};

const TIPOS = [
  "Electrodomesticos", "Alimentacion", "Salud", "Vivienda",
  "Documentacion", "Educacion", "Servicios Publicos",
  "Pensiones y Beneficios", "Otro",
];

// Clave única por pestaña para evitar colisiones entre tabs simultáneos
const _tabId = Math.random().toString(36).slice(2);
export const PENDING_KEY = `social_case_pending_${_tabId}`;

// Marcador de inicio y fin de la tabla de la ficha dentro del description_html
const TABLE_START = '<table data-social-case="1">';
const TABLE_END = "</table>";
const TABLE_RE = /<table data-social-case="1">[\s\S]*?<\/table>/;

// Campos con sus etiquetas legibles para construir la tabla
const FIELDS: { key: keyof SocialCaseData; label: string }[] = [
  { key: "cedula",        label: "Cedula"              },
  { key: "nombre",        label: "Nombre"              },
  { key: "telefono",      label: "Telefono"            },
  { key: "direccion",     label: "Direccion"           },
  { key: "parroquia",     label: "Parroquia"           },
  { key: "municipio",     label: "Municipio"           },
  { key: "entidad",       label: "Estado"              },
  { key: "jornada",       label: "Jornada"             },
  { key: "tipoCaso",      label: "Tipo de caso"        },
  { key: "fechaAtencion", label: "Fecha atencion"      },
  { key: "referencia",    label: "Referencia"          },
  { key: "accionTomada",  label: "Accion tomada"       },
  { key: "resultado",     label: "Resultado"           },
  { key: "fechaResolucion", label: "Fecha resolucion"  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Escapa caracteres HTML especiales para evitar XSS al inyectar valores en la tabla */
const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
  } catch { return null; }
};

/** Construye la tabla HTML con los datos y la inyecta al inicio del description_html.
 *  Incluye un <caption> con el JSON completo como respaldo de lectura
 *  por si ProseMirror reescribe los atributos data-key de las celdas.
 */
/** Elimina la tabla de la ficha del description_html para pasarle al editor solo el texto limpio */
export const stripSocialCaseFromHtml = (html: string): string =>
  (html ?? "").replace(TABLE_RE, "");

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

const sectionHeadClass = "block text-xs text-custom-text-300 uppercase tracking-wider mb-3";

const labelClass = "block text-xs text-custom-text-300 mb-1";

const fieldBase = "w-full rounded-md border-[0.5px] text-13 px-3 py-1.5 transition-colors";
const fieldEditable = "border-subtle bg-surface-2 text-primary placeholder:text-placeholder focus:border-strong focus:outline-none";
const fieldReadonly = "border-transparent bg-transparent text-primary cursor-default outline-none px-0";

// ── Component ────────────────────────────────────────────────────────────────

export const SocialCaseForm = ({ issueId, mode, descriptionHtml = "", onSave }: Props) => {
  const [data, setData] = useState<SocialCaseData>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const savedData = useRef<SocialCaseData>(EMPTY);
  // Siempre apunta al descriptionHtml más reciente para evitar cierres obsoletos en save()
  const latestDescHtml = useRef(descriptionHtml);
  useEffect(() => { latestDescHtml.current = descriptionHtml; });

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
          onSave(newHtml).then(() => {
            localStorage.removeItem(PENDING_KEY);
            // Limpiar el guard de sesión una vez confirmado — ya está en DB
            if (migratedKey) sessionStorage.removeItem(migratedKey);
          }).catch(() => {
            if (migratedKey) sessionStorage.removeItem(migratedKey);
          });
        }
      } catch (_) {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId, mode, descriptionHtml, editing]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const update = (field: keyof SocialCaseData, value: string) => {
    setData((prev) => {
      const next = { ...prev, [field]: value };
      if (mode === "create-no-save") {
        try { localStorage.setItem(PENDING_KEY, JSON.stringify(next)); } catch (_) {}
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

  const isEditable = mode === "create-no-save" || editing;

  // En modo lectura muestra texto plano; en edición muestra el input/select/textarea
  const ro = (value: string, placeholder = "—") =>
    <span className="text-sm text-custom-text-100">{value || <span className="text-custom-text-400">{placeholder}</span>}</span>;

  const fc = (editable: boolean) => cn(fieldBase, editable ? fieldEditable : fieldReadonly);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">

      {/* Cabecera */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1 text-left group"
      >
        <span className="text-sm font-medium text-custom-text-200 group-hover:text-custom-text-100 transition-colors">
          Ficha de Caso Social
        </span>
        <span className="text-xs text-custom-text-400 group-hover:text-custom-text-300 transition-colors">
          {open ? "Ocultar" : "Mostrar"}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-5">

          {/* SECCION 1: DATOS DEL CIUDADANO */}
          <div>
            <span className={sectionHeadClass}>Datos del ciudadano</span>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className={labelClass}>Cedula de identidad</label>
                {isEditable
                  ? <input className={fc(true)} placeholder="V-00.000.000" value={data.cedula} onChange={(e) => update("cedula", e.target.value)} />
                  : ro(data.cedula)}
              </div>
              <div>
                <label className={labelClass}>Nombre completo</label>
                {isEditable
                  ? <input className={fc(true)} placeholder="Nombre y apellido" value={data.nombre} onChange={(e) => update("nombre", e.target.value)} />
                  : ro(data.nombre)}
              </div>
              <div>
                <label className={labelClass}>Telefono</label>
                {isEditable
                  ? <input className={fc(true)} placeholder="0424-000.00.00" value={data.telefono} onChange={(e) => update("telefono", e.target.value)} />
                  : ro(data.telefono)}
              </div>
              <div>
                <label className={labelClass}>Direccion</label>
                {isEditable
                  ? <input className={fc(true)} placeholder="Barrio, sector, calle..." value={data.direccion} onChange={(e) => update("direccion", e.target.value)} />
                  : ro(data.direccion)}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <label className={labelClass}>Parroquia</label>
                {isEditable
                  ? <input className={fc(true)} placeholder="Parroquia" value={data.parroquia} onChange={(e) => update("parroquia", e.target.value)} />
                  : ro(data.parroquia)}
              </div>
              <div>
                <label className={labelClass}>Municipio</label>
                {isEditable
                  ? <input className={fc(true)} placeholder="Municipio" value={data.municipio} onChange={(e) => update("municipio", e.target.value)} />
                  : ro(data.municipio)}
              </div>
              <div>
                <label className={labelClass}>Estado</label>
                {isEditable
                  ? <input className={fc(true)} placeholder="Estado" value={data.entidad} onChange={(e) => update("entidad", e.target.value)} />
                  : ro(data.entidad)}
              </div>
            </div>
          </div>

          {/* SECCION 2: DATOS DEL CASO */}
          <div>
            <span className={sectionHeadClass}>Datos del caso</span>
            <div className="grid grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <label className={labelClass}>Jornada</label>
                {isEditable
                  ? <input className={fc(true)} placeholder="Nombre de la jornada" value={data.jornada} onChange={(e) => update("jornada", e.target.value)} />
                  : ro(data.jornada)}
              </div>
              <div>
                <label className={labelClass}>Tipo de caso</label>
                {isEditable
                  ? <select className={fc(true)} value={data.tipoCaso} onChange={(e) => update("tipoCaso", e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {TIPOS.map((t) => (<option key={t} value={t}>{t}</option>))}
                    </select>
                  : ro(data.tipoCaso)}
              </div>
              <div>
                <label className={labelClass}>Fecha de atencion</label>
                {isEditable
                  ? <input type="date" className={fc(true)} value={data.fechaAtencion} onChange={(e) => update("fechaAtencion", e.target.value)} />
                  : ro(data.fechaAtencion)}
              </div>
            </div>
          </div>

          {/* SECCION 3: SEGUIMIENTO */}
          <div>
            <span className={sectionHeadClass}>Seguimiento</span>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Referencia del caso</label>
                {isEditable
                  ? <textarea className={cn(fc(true), "min-h-[64px] resize-y leading-relaxed")} placeholder="Describe por que llego el caso y que solicito el ciudadano..." value={data.referencia} onChange={(e) => update("referencia", e.target.value)} />
                  : ro(data.referencia)}
              </div>
              <div>
                <label className={labelClass}>Accion tomada</label>
                {isEditable
                  ? <textarea className={cn(fc(true), "min-h-[64px] resize-y leading-relaxed")} placeholder="Describe que se hizo para atender el caso..." value={data.accionTomada} onChange={(e) => update("accionTomada", e.target.value)} />
                  : ro(data.accionTomada)}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className={labelClass}>Resultado / Beneficio otorgado</label>
                  {isEditable
                    ? <textarea className={cn(fc(true), "min-h-[52px] resize-y leading-relaxed")} placeholder="Que se otorgo o por que no se pudo resolver..." value={data.resultado} onChange={(e) => update("resultado", e.target.value)} />
                    : ro(data.resultado)}
                </div>
                <div>
                  <label className={labelClass}>Fecha de resolucion</label>
                  {isEditable
                    ? <input type="date" className={fc(true)} value={data.fechaResolucion} onChange={(e) => update("fechaResolucion", e.target.value)} />
                    : ro(data.fechaResolucion)}
                </div>
              </div>
            </div>
          </div>

          {/* BOTONES — solo en modo view */}
          {mode === "view" && (
            <div className="flex items-center justify-end gap-2 pt-1">
              {!editing && (
                <Button type="button" variant="secondary" size="sm" onClick={() => { savedData.current = data; setEditing(true); }}>
                  Editar ficha
                </Button>
              )}
              {editing && (
                <>
                  <Button type="button" variant="tertiary" size="sm" onClick={() => { setData(savedData.current); setEditing(false); }}>
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
