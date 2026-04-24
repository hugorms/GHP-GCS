import { useRef, useState } from "react";
import { Paperclip, Check, Loader2 } from "lucide-react";
import { Button } from "@plane/propel/button";
import { extractFromHtml, EVIDENCE_SLOTS } from "./social-case-form";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectState } from "@/hooks/store/use-project-state";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  onSlotUpload: (slotPrefix: string, file: File) => Promise<void>;
};

const SLOT_PREFIXES_LIST = ["[CI_SOL]", "[CI_BEN]", "[ENTREGA]"];

function SlotButton({
  label,
  isDone,
  uploading,
  accept,
  onFile,
}: {
  label: string;
  isDone: boolean;
  uploading: boolean;
  accept: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onFile(file);
          e.target.value = "";
        }}
      />
      <Button
        variant="secondary"
        size="lg"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={isDone ? "border-green-500 text-green-600 dark:text-green-400" : ""}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
        ) : isDone ? (
          <Check className="text-green-500 h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <Paperclip className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
        )}
        <span className="text-body-xs-medium">{uploading ? "Subiendo..." : label}</span>
      </Button>
    </>
  );
}

export function SocialCaseSlotButtons({ workspaceSlug: _workspaceSlug, projectId, issueId, onSlotUpload }: Props) {
  const {
    issue: { getIssueById },
    attachment: { getAttachmentsByIssueId, getAttachmentById },
  } = useIssueDetail();
  const { getProjectStates, getStateById } = useProjectState();

  const [sessionUploads, setSessionUploads] = useState<Record<string, string>>({});
  const [slotUploading, setSlotUploading] = useState<Record<string, boolean>>({});

  const issue = getIssueById(issueId);
  const projectStates = getProjectStates(projectId);
  const currentState = issue?.state_id ? getStateById(issue.state_id) : undefined;

  // Calcular qué slots ya tienen archivo subido leyendo directamente los adjuntos del store
  const storeSlotFiles = (getAttachmentsByIssueId(issueId) ?? []).reduce<Record<string, string>>((acc, attId) => {
    const att = getAttachmentById(attId);
    if (!att) return acc;
    const name = att.attributes?.name ?? "";
    const prefix = SLOT_PREFIXES_LIST.find((p) => name.startsWith(p));
    if (!prefix) return acc;
    if (prefix === "[ENTREGA]") {
      const count = Object.keys(acc).filter((k) => k.startsWith("[ENTREGA]")).length;
      acc[`[ENTREGA]_${count + 1}`] = name;
    } else {
      acc[prefix] = name;
    }
    return acc;
  }, {});

  // Unir estado del store con uploads de la sesión actual
  const slotFiles = { ...storeSlotFiles, ...sessionUploads };

  const hasSocialCaseWorkflow = Boolean(
    projectStates?.some((s) => s.name?.toLowerCase().includes("proceso")) &&
    projectStates?.some((s) => s.name?.toLowerCase().includes("articulaci")) &&
    projectStates?.some((s) => s.name?.toLowerCase().includes("recib"))
  );

  const isClosed = currentState?.group === "completed";
  const isSinResolucion = currentState?.group === "cancelled";
  const isEnProceso = hasSocialCaseWorkflow && Boolean(currentState?.name?.toLowerCase().includes("proceso"));
  const isArticulacion = hasSocialCaseWorkflow && Boolean(currentState?.name?.toLowerCase().includes("articulaci"));

  const data = extractFromHtml(issue?.description_html ?? "");
  const mismoBeneficiario = data?.mismoBeneficiario ?? "false";

  if (!hasSocialCaseWorkflow || !data || isClosed || isSinResolucion || (!isEnProceso && !isArticulacion)) {
    return null;
  }

  const handleSlotUpload = async (prefix: string, file: File) => {
    setSlotUploading((prev) => ({ ...prev, [prefix]: true }));
    try {
      await onSlotUpload(prefix, file);
      setSessionUploads((prev) => ({ ...prev, [prefix]: file.name }));
    } finally {
      setSlotUploading((prev) => ({ ...prev, [prefix]: false }));
    }
  };

  return (
    <>
      {EVIDENCE_SLOTS.filter((slot) => slot.prefix !== "[CI_SOL]" || mismoBeneficiario !== "true").map((slot) => {
        const isRegistro = slot.prefix === "[ENTREGA]";
        const registroCount = isRegistro ? Object.keys(slotFiles).filter((k) => k.startsWith("[ENTREGA]")).length : 0;
        const isDone = isRegistro ? registroCount > 0 : !!slotFiles[slot.prefix];
        const displayLabel = isRegistro && registroCount > 0 ? `${slot.label} (${registroCount})` : slot.label;

        return (
          <SlotButton
            key={slot.prefix}
            label={displayLabel}
            isDone={isDone}
            uploading={!!slotUploading[slot.prefix]}
            accept="image/*,.pdf"
            onFile={(file) => {
              if (isRegistro) {
                const count = Object.keys(slotFiles).filter((k) => k.startsWith("[ENTREGA]")).length;
                handleSlotUpload(`[ENTREGA]_${count + 1}`, file);
              } else {
                handleSlotUpload(slot.prefix, file);
              }
            }}
          />
        );
      })}
    </>
  );
}
