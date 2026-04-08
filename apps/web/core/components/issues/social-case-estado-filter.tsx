import { useRef, useState, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@plane/utils";
import { VENEZUELA_ESTADOS } from "./social-case-estados";

type Props = {
  value: string; // "" = Todos
  onChange: (estado: string) => void;
};

export const SocialCaseEstadoFilter = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = value || "Todos los estados";
  const isFiltered = value !== "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "text-xs flex items-center gap-1.5 rounded-md border-[0.5px] px-2.5 py-1.5 font-medium transition-colors",
          isFiltered
            ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
            : "border-custom-border-200 bg-custom-background-100 text-custom-text-200 hover:bg-custom-background-90"
        )}
      >
        <span className="max-w-[120px] truncate">{label}</span>
        {isFiltered ? (
          <X
            className="h-3 w-3 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setOpen(false);
            }}
          />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-custom-border-200 bg-custom-background-100 shadow-lg absolute top-full right-0 z-20 mt-1 w-48 rounded-md border">
          <div className="max-h-72 overflow-y-auto py-1">
            {/* Opción Todos */}
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={cn(
                "text-xs hover:bg-custom-background-90 flex w-full items-center px-3 py-1.5 transition-colors",
                !isFiltered ? "font-semibold text-accent-primary" : "text-custom-text-200"
              )}
            >
              Todos los estados
            </button>
            <div className="border-custom-border-200 my-1 border-t" />
            {VENEZUELA_ESTADOS.map((estado) => (
              <button
                key={estado}
                type="button"
                onClick={() => {
                  onChange(estado);
                  setOpen(false);
                }}
                className={cn(
                  "text-xs hover:bg-custom-background-90 flex w-full items-center px-3 py-1.5 transition-colors",
                  value === estado ? "font-semibold text-accent-primary" : "text-custom-text-200"
                )}
              >
                {estado}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
