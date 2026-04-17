import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { renderFormattedPayloadDate } from "@plane/utils";
import { extractFromHtml, injectSocialCaseIntoHtml } from "@/components/issues/social-case-form";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectState } from "@/hooks/store/use-project-state";
import type { TIssueOperations } from "@/components/issues/issue-detail/root";

// Campos requeridos para cerrar un caso
const REQUIRED: { key: string; label: string }[] = [
  { key: "nombre", label: "Nombre del ciudadano" },
  { key: "cedula", label: "Cédula" },
  { key: "resultado", label: "Solicitud / Beneficio otorgado" },
  { key: "referencia", label: "Origen de la solicitud" },
  { key: "nombreBeneficiario", label: "Beneficiario" },
  { key: "cedulaBeneficiario", label: "Cédula del beneficiario" },
];

type UseStateChangeParams = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
};

/**
 * Devuelve `handleStateChange(newStateId)`:
 * - Si el nuevo estado es "completed", valida los campos requeridos de la ficha.
 * - Si falta alguno → muestra un toast de error y bloquea el cambio.
 * - Si todo está completo → auto-inyecta fechaCierre con la fecha de hoy y procede.
 */
export function useSocialCaseStateChange({ workspaceSlug, projectId, issueId, issueOperations }: UseStateChangeParams) {
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getStateById } = useProjectState();

  const handleStateChange = async (newStateId: string) => {
    const newState = getStateById(newStateId);
    const isCompletingCase = newState?.group === "completed";

    if (!isCompletingCase) {
      // No es un cierre — cambio normal
      await issueOperations.update(workspaceSlug, projectId, issueId, { state_id: newStateId });
      return;
    }

    // Validar ficha antes de cerrar
    const issue = getIssueById(issueId);
    const data = extractFromHtml(issue?.description_html ?? "");

    const missing: string[] = REQUIRED.filter(({ key }) => !data || !(data as Record<string, string>)[key]?.trim()).map(
      ({ label }) => label
    );

    if (missing.length > 0) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Ficha incompleta",
        message: `Completa estos campos antes de resolver el caso: ${missing.join(", ")}`,
      });
      return;
    }

    // Todo completo → inyectar fechaCierre automática y cambiar estado
    const today = renderFormattedPayloadDate(new Date()) ?? new Date().toISOString().split("T")[0];
    const updatedData = { ...data!, fechaCierre: today };
    const currentHtml = issue?.description_html ?? "<p></p>";
    const newHtml = injectSocialCaseIntoHtml(currentHtml, updatedData);

    await issueOperations.update(workspaceSlug, projectId, issueId, {
      description_html: newHtml,
      state_id: newStateId,
    });
  };

  return { handleStateChange };
}
