import { useState, useEffect } from "react";
import { Button } from "@plane/propel/button";
import { cn } from "@plane/utils";

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

const EMPTY: SocialCaseData = {
  cedula: "", nombre: "", telefono: "", direccion: "",
  parroquia: "", municipio: "", entidad: "", jornada: "",
  tipoCaso: "", fechaAtencion: "", referencia: "",
  accionTomada: "", resultado: "", fechaResolucion: "",
};

const TIPOS = [
  "Electrodomesticos",
  "Alimentacion",
  "Salud",
  "Vivienda",
  "Documentacion",
  "Educacion",
  "Servicios Publicos",
  "Pensiones y Beneficios",
  "Otro",
];

const storageKey = (id: string) => `social_case_${id}`;

type Props = {
  issueId: string;
};

const fieldClass = cn(
  "w-full rounded-md border-[0.5px] border-subtle bg-surface-2",
  "px-2.5 py-1.5 text-13 text-primary placeholder:text-placeholder",
  "focus:border-strong focus:outline-none transition-colors"
);

const labelClass = "block text-xs font-medium text-secondary mb-1 uppercase tracking-wide";

const sectionHeadClass = cn(
  "inline-block rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-widest",
  "bg-accent-primary/10 text-accent-primary mb-3"
);

export const SocialCaseForm: React.FC<Props> = ({ issueId }) => {
  const [data, setData] = useState<SocialCaseData>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey(issueId));
      if (stored) setData(JSON.parse(stored));
    } catch (_) {}
  }, [issueId]);

  const update = (field: keyof SocialCaseData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const save = () => {
    try {
      localStorage.setItem(storageKey(issueId), JSON.stringify(data));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {}
  };

  const clear = () => {
    setData(EMPTY);
    localStorage.removeItem(storageKey(issueId));
  };

  return (
    <div className="my-3 overflow-hidden rounded-md border-[0.5px] border-subtle bg-surface-1">

      {/* Cabecera clicable */}
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
                <input className={fieldClass} placeholder="V-00.000.000" value={data.cedula} onChange={(e) => update("cedula", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Nombre completo</label>
                <input className={fieldClass} placeholder="Nombre y apellido" value={data.nombre} onChange={(e) => update("nombre", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Telefono</label>
                <input className={fieldClass} placeholder="0424-000.00.00" value={data.telefono} onChange={(e) => update("telefono", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Direccion</label>
                <input className={fieldClass} placeholder="Barrio, sector, calle..." value={data.direccion} onChange={(e) => update("direccion", e.target.value)} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Parroquia</label>
                <input className={fieldClass} placeholder="Parroquia" value={data.parroquia} onChange={(e) => update("parroquia", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Municipio</label>
                <input className={fieldClass} placeholder="Municipio" value={data.municipio} onChange={(e) => update("municipio", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Estado</label>
                <input className={fieldClass} placeholder="Estado" value={data.entidad} onChange={(e) => update("entidad", e.target.value)} />
              </div>
            </div>
          </div>

          {/* SECCION 2: DATOS DEL CASO */}
          <div>
            <span className={sectionHeadClass}>Datos del caso</span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Jornada</label>
                <input className={fieldClass} placeholder="Nombre de la jornada" value={data.jornada} onChange={(e) => update("jornada", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Tipo de caso</label>
                <select
                  className={fieldClass}
                  value={data.tipoCaso}
                  onChange={(e) => update("tipoCaso", e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Fecha de atencion</label>
                <input type="date" className={fieldClass} value={data.fechaAtencion} onChange={(e) => update("fechaAtencion", e.target.value)} />
              </div>
            </div>
          </div>

          {/* SECCION 3: SEGUIMIENTO */}
          <div>
            <span className={sectionHeadClass}>Seguimiento</span>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Referencia del caso</label>
                <textarea
                  className={cn(fieldClass, "min-h-[64px] resize-y leading-relaxed")}
                  placeholder="Describe por que llego el caso y que solicito el ciudadano..."
                  value={data.referencia}
                  onChange={(e) => update("referencia", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Accion tomada</label>
                <textarea
                  className={cn(fieldClass, "min-h-[64px] resize-y leading-relaxed")}
                  placeholder="Describe que se hizo para atender el caso..."
                  value={data.accionTomada}
                  onChange={(e) => update("accionTomada", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Resultado / Beneficio otorgado</label>
                  <textarea
                    className={cn(fieldClass, "min-h-[52px] resize-y leading-relaxed")}
                    placeholder="Que se otorgo o por que no se pudo resolver..."
                    value={data.resultado}
                    onChange={(e) => update("resultado", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Fecha de resolucion</label>
                  <input type="date" className={fieldClass} value={data.fechaResolucion} onChange={(e) => update("fechaResolucion", e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* BOTONES */}
          <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-subtle pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={clear}>
              Limpiar
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={save}>
              {saved ? "Guardado" : "Guardar ficha"}
            </Button>
          </div>

        </div>
      )}
    </div>
  );
};

export default SocialCaseForm;
