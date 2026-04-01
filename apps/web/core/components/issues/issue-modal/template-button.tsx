import React, { useState } from "react";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { Button } from "@plane/propel/button";
import { cn } from "@plane/utils";

const STORAGE_KEY = "plane_plantilla_caso_social";

const PLANTILLA_DEFAULT = `DATOS DEL CIUDADANO
Cedula:           V-
Nombre completo:
Telefono:
Direccion:
Parroquia:
Municipio:
Estado:

DATOS DEL CASO
Jornada:
Tipo de caso:
Fecha atencion:

REFERENCIA
(Describe aqui por que llego el caso)

ACCION TOMADA
(Describe aqui que se hizo)

RESULTADO / BENEFICIO
(Describe aqui que se otorgo o por que no se resolvio)

Fecha resolucion:
Responsable:      `;

function textToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => `<p>${line}</p>`)
    .join("\n");
}

function loadTemplate(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? PLANTILLA_DEFAULT;
  } catch {
    return PLANTILLA_DEFAULT;
  }
}

function saveTemplate(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {}
}

type Props = {
  onInsert: (html: string) => void;
};

export const TemplateCasoSocialButton: React.FC<Props> = ({ onInsert }) => {
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const handleOpenEdit = () => {
    setDraft(loadTemplate());
    setEditOpen(true);
  };

  const handleSave = () => {
    saveTemplate(draft);
    setEditOpen(false);
  };

  const handleInsert = () => {
    onInsert(textToHtml(loadTemplate()));
  };

  return (
    <>
      <div className="mb-2 flex items-center gap-1.5">
        <Button type="button" variant="secondary" size="sm" onClick={handleInsert}>
          Insertar plantilla de caso social
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleOpenEdit}>
          Editar plantilla
        </Button>
      </div>

      <ModalCore isOpen={editOpen} handleClose={() => setEditOpen(false)} position={EModalPosition.CENTER} width={EModalWidth.XL}>
        <div className="p-5">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-h5-medium text-primary">Editar plantilla de caso social</h3>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="text-tertiary hover:text-secondary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Textarea */}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className={cn(
              "w-full h-80 resize-y rounded-md border border-subtle-1 bg-layer-2",
              "px-3 py-2 font-mono text-xs text-primary",
              "focus:border-strong focus:outline-none",
              "transition-colors"
            )}
          />

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDraft(PLANTILLA_DEFAULT)}
            >
              Restaurar predeterminada
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={handleSave}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      </ModalCore>
    </>
  );
};

export default TemplateCasoSocialButton;
