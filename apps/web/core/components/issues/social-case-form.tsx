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
  // "create"          → editable, guarda en localStorage, muestra botón Guardar
  // "create-no-save"  → editable, guarda en localStorage, sin botón Guardar (el modal lo hace)
  // "view"            → solo lectura con botón Editar
  mode: "create" | "create-no-save" | "view";
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

export const PENDING_KEY = "social_case_pending";

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

/** Lee la tabla del description_html y reconstruye el objeto SocialCaseData */
const extractFromHtml = (html: string): SocialCaseData | null => {
  if (!html?.match(TABLE_RE)) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const table = doc.querySelector('table[data-social-case="1"]');
    if (!table) return null;
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

/** Construye la tabla HTML con los datos y la inyecta al inicio del description_html */
export const injectSocialCaseIntoHtml = (html: string, data: SocialCaseData): string => {
  const rows = FIELDS.map(
    ({ key, label }) =>
      `<tr><td data-key="${key}" style="font-weight:600;padding:3px 10px 3px 0;white-space:nowrap;color:#6b7280;font-size:12px;">${label}</td>` +
      `<td style="padding:3px 0;font-size:13px;">${data[key] ?? ""}</td></tr>`
  ).join("");

  const table =
    `${TABLE_START}` +
    `<tbody>${rows}</tbody>` +
    `${TABLE_END}`;

  // Eliminar tabla previa si existe, luego colocar la nueva al inicio
  const cleaned = (html ?? "").replace(TABLE_RE, "");
  return table + cleaned;
};

// ── Styles ───────────────────────────────────────────────────────────────────

const sectionHeadClass = cn(
  "inline-block rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-widest",
  "bg-accent-primary/10 text-accent-primary mb-3"
);

const labelClass = "block text-xs font-medium text-secondary mb-1 uppercase tracking-wide";

const fieldBase = "w-full rounded-md border-[0.5px] text-13 px-2.5 py-1.5 transition-colors";
const fieldEditable = "border-subtle bg-surface-2 text-primary placeholder:text-placeholder focus:border-strong focus:outline-none";
const fieldReadonly = "border-transparent bg-surface-1 text-primary cursor-default outline-none";

// ── Component ────────────────────────────────────────────────────────────────

export const SocialCaseForm = ({ issueId, mode, descriptionHtml = "", onSave }: Props) => {
  const [data, setData] = useState<SocialCaseData>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const migrated = useRef(false);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || mode === "create-no-save") {
      try {
        const stored = localStorage.getItem(PENDING_KEY);
        if (stored) setData(JSON.parse(stored));
      } catch (_) {}
      return;
    }

    // modo view: leer desde description_html
    const extracted = extractFromHtml(descriptionHtml);
    if (extracted) {
      setData(extracted);
      return;
    }

    // si no hay datos en DB pero hay pendientes en localStorage → migrar a DB
    if (!migrated.current && issueId && onSave) {
      try {
        const pending = localStorage.getItem(PENDING_KEY);
        if (pending) {
          migrated.current = true;
          const parsed: SocialCaseData = JSON.parse(pending);
          setData(parsed);
          const newHtml = injectSocialCaseIntoHtml(descriptionHtml, parsed);
          onSave(newHtml).then(() => {
            localStorage.removeItem(PENDING_KEY);
          }).catch(() => {
            migrated.current = false;
          });
        }
      } catch (_) {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId, mode, descriptionHtml]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const update = (field: keyof SocialCaseData, value: string) => {
    setData((prev) => {
      const next = { ...prev, [field]: value };
      if (mode === "create" || mode === "create-no-save") {
        try { localStorage.setItem(PENDING_KEY, JSON.stringify(next)); } catch (_) {}
      }
      return next;
    });
    setSaved(false);
  };

  const save = async () => {
    if (mode === "create") {
      try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(data));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (_) {}
      return;
    }

    if (!onSave) return;
    setSaving(true);
    try {
      const newHtml = injectSocialCaseIntoHtml(descriptionHtml, data);
      await onSave(newHtml);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {
    } finally {
      setSaving(false);
    }
  };

  const isEditable = mode === "create" || mode === "create-no-save" || editing;

  const fc = (editable: boolean) => cn(fieldBase, editable ? fieldEditable : fieldReadonly);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="my-3 overflow-hidden rounded-md border-[0.5px] border-subtle bg-surface-1">

      {/* Cabecera */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-accent-primary/10 px-4 py-2.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-accent-primary">
          Ficha de Caso Social
        </span>
        <span className="text-xs text-accent-primary">{open ? "Ocultar" : "Mostrar"}</span>
      </button>

      {open && (
        <div className="space-y-5 px-4 py-4">

          {/* SECCION 1: DATOS DEL CIUDADANO */}
          <div>
            <span className={sectionHeadClass}>Datos del ciudadano</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Cedula de identidad</label>
                <input disabled={!isEditable} className={fc(isEditable)} placeholder="V-00.000.000" value={data.cedula} onChange={(e) => update("cedula", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Nombre completo</label>
                <input disabled={!isEditable} className={fc(isEditable)} placeholder="Nombre y apellido" value={data.nombre} onChange={(e) => update("nombre", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Telefono</label>
                <input disabled={!isEditable} className={fc(isEditable)} placeholder="0424-000.00.00" value={data.telefono} onChange={(e) => update("telefono", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Direccion</label>
                <input disabled={!isEditable} className={fc(isEditable)} placeholder="Barrio, sector, calle..." value={data.direccion} onChange={(e) => update("direccion", e.target.value)} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Parroquia</label>
                <input disabled={!isEditable} className={fc(isEditable)} placeholder="Parroquia" value={data.parroquia} onChange={(e) => update("parroquia", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Municipio</label>
                <input disabled={!isEditable} className={fc(isEditable)} placeholder="Municipio" value={data.municipio} onChange={(e) => update("municipio", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Estado</label>
                <input disabled={!isEditable} className={fc(isEditable)} placeholder="Estado" value={data.entidad} onChange={(e) => update("entidad", e.target.value)} />
              </div>
            </div>
          </div>

          {/* SECCION 2: DATOS DEL CASO */}
          <div>
            <span className={sectionHeadClass}>Datos del caso</span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Jornada</label>
                <input disabled={!isEditable} className={fc(isEditable)} placeholder="Nombre de la jornada" value={data.jornada} onChange={(e) => update("jornada", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Tipo de caso</label>
                <select disabled={!isEditable} className={fc(isEditable)} value={data.tipoCaso} onChange={(e) => update("tipoCaso", e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {TIPOS.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Fecha de atencion</label>
                <input type="date" disabled={!isEditable} className={fc(isEditable)} value={data.fechaAtencion} onChange={(e) => update("fechaAtencion", e.target.value)} />
              </div>
            </div>
          </div>

          {/* SECCION 3: SEGUIMIENTO */}
          <div>
            <span className={sectionHeadClass}>Seguimiento</span>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Referencia del caso</label>
                <textarea disabled={!isEditable} className={cn(fc(isEditable), "min-h-[64px] resize-y leading-relaxed")} placeholder="Describe por que llego el caso y que solicito el ciudadano..." value={data.referencia} onChange={(e) => update("referencia", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Accion tomada</label>
                <textarea disabled={!isEditable} className={cn(fc(isEditable), "min-h-[64px] resize-y leading-relaxed")} placeholder="Describe que se hizo para atender el caso..." value={data.accionTomada} onChange={(e) => update("accionTomada", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Resultado / Beneficio otorgado</label>
                  <textarea disabled={!isEditable} className={cn(fc(isEditable), "min-h-[52px] resize-y leading-relaxed")} placeholder="Que se otorgo o por que no se pudo resolver..." value={data.resultado} onChange={(e) => update("resultado", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Fecha de resolucion</label>
                  <input type="date" disabled={!isEditable} className={fc(isEditable)} value={data.fechaResolucion} onChange={(e) => update("fechaResolucion", e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* BOTONES */}
          <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-subtle pt-3">
            {mode === "view" && !editing && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Editar
              </Button>
            )}
            {isEditable && mode !== "create-no-save" && (
              <Button type="button" variant="primary" size="sm" loading={saving} onClick={save}>
                {saved ? "Guardado" : "Guardar ficha"}
              </Button>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default SocialCaseForm;
