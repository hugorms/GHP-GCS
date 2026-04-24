/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import { FileDown } from "lucide-react";
import { Button } from "@plane/propel/button";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import type { TNameDescriptionLoader } from "@plane/types";
import { EFileAssetType, EIssueServiceType } from "@plane/types";
import { getTextContent } from "@plane/utils";
// components
import { DescriptionVersionsRoot } from "@/components/core/description-versions";
import { DescriptionInput } from "@/components/editor/rich-text/description-input";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUser } from "@/hooks/store/user";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import useSize from "@/hooks/use-window-size";
// plane web components
import { DeDupeIssuePopoverRoot } from "@/plane-web/components/de-dupe/duplicate-popover";
import { IssueTypeSwitcher } from "@/plane-web/components/issues/issue-details/issue-type-switcher";
import { useDebouncedDuplicateIssues } from "@/plane-web/hooks/use-debounced-duplicate-issues";
// services
import { WorkItemVersionService } from "@/services/issue";
// local imports
import { IssueDetailWidgets } from "../issue-detail-widgets";
import { NameDescriptionUpdateStatus } from "../issue-update-status";
import { PeekOverviewProperties } from "../peek-overview/properties";
import { IssueTitleInput } from "../title-input";
import {
  SocialCaseForm,
  stripSocialCaseFromHtml,
  injectSocialCaseIntoHtml,
  extractFromHtml,
  extractProfilePhotoFromHtml,
  injectProfilePhotoIntoHtml,
} from "@/components/issues/social-case-form";
import { useSocialCaseStateChange } from "@/hooks/use-social-case-state-change";
import { useSocialCaseFichaExport } from "@/hooks/use-social-case-ficha-export";
import { useSocialCaseActividades, invalidateSocialCaseActividades } from "@/hooks/use-social-case-actividades";
import { SocialCaseSlotButtons } from "@/components/issues/social-case-slot-buttons";
import { IssueAttachmentService } from "@/services/issue/issue_attachment.service";
import { FileService } from "@/services/file.service";

const attachmentService = new IssueAttachmentService();
const fileService = new FileService();
import { IssueActivity } from "./issue-activity";
import { IssueParentDetail } from "./parent";
import { IssueReaction } from "./reactions";
import type { TIssueOperations } from "./root";
// services init
const workItemVersionService = new WorkItemVersionService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  isEditable: boolean;
  isArchived: boolean;
};

export const IssueMainContent = observer(function IssueMainContent(props: Props) {
  const { workspaceSlug, projectId, issueId, issueOperations, isEditable, isArchived } = props;
  // refs
  const editorRef = useRef<EditorRefApi>(null);
  // states
  const [isSubmitting, setIsSubmitting] = useState<TNameDescriptionLoader>("saved");
  // hooks
  const windowSize = useSize();
  const { data: currentUser } = useUser();
  const { getUserDetails } = useMember();
  const {
    issue: { getIssueById },
    peekIssue,
  } = useIssueDetail();
  const { getProjectById } = useProject();
  const { getStateById, getProjectStates } = useProjectState();
  const { setShowAlert } = useReloadConfirmations(isSubmitting === "submitting");
  // derived values
  const projectDetails = getProjectById(projectId);
  const issue = issueId ? getIssueById(issueId) : undefined;
  const currentState = issue?.state_id ? getStateById(issue.state_id) : undefined;
  const { handleStateChange } = useSocialCaseStateChange({ workspaceSlug, projectId, issueId, issueOperations });
  const { exportFicha, isExporting } = useSocialCaseFichaExport({ workspaceSlug, projectId, issueId });
  const actividadesDisponibles = useSocialCaseActividades(workspaceSlug, projectId);
  const projectStates = getProjectStates(projectId);
  // El flujo de casos sociales solo aplica si el proyecto tiene los tres estados esperados.
  // Esto evita que proyectos genéricos con nombres de estado similares activen la UI de casos.
  const hasSocialCaseWorkflow = Boolean(
    projectStates?.some((s) => s.name?.toLowerCase().includes("proceso")) &&
    projectStates?.some((s) => s.name?.toLowerCase().includes("articulaci")) &&
    projectStates?.some((s) => s.name?.toLowerCase().includes("recib"))
  );
  const isSocialCase = useMemo(
    () => hasSocialCaseWorkflow && extractFromHtml(issue?.description_html ?? "") !== null,
    [hasSocialCaseWorkflow, issue?.description_html]
  );
  const isClosed = currentState?.group === "completed";
  const isSinResolucion = currentState?.group === "cancelled";
  const isArticulacion = hasSocialCaseWorkflow && Boolean(currentState?.name?.toLowerCase().includes("articulaci"));
  const isEnProceso = hasSocialCaseWorkflow && Boolean(currentState?.name?.toLowerCase().includes("proceso"));
  const isRecibido =
    hasSocialCaseWorkflow &&
    Boolean(
      !isClosed &&
      !isSinResolucion &&
      !isArticulacion &&
      !isEnProceso &&
      currentState?.name?.toLowerCase().includes("recib")
    );
  const completedStateId = projectStates?.find(
    (s) => s.group === "completed" && !s.name?.toLowerCase().includes("sin")
  )?.id;
  const sinResolucionStateId = projectStates?.find(
    (s) => s.name?.toLowerCase().includes("sin") && s.name?.toLowerCase().includes("resoluci")
  )?.id;
  const procesoStateId = projectStates?.find((s) => s.name?.toLowerCase().includes("proceso"))?.id;
  const articulacionStateId = projectStates?.find((s) => s.name?.toLowerCase().includes("articulaci"))?.id;
  const recibidoStateId = projectStates?.find((s) => s.name?.toLowerCase().includes("recib"))?.id;
  // debounced duplicate issues swr
  const { duplicateIssues } = useDebouncedDuplicateIssues(
    workspaceSlug,
    projectDetails?.workspace.toString(),
    projectDetails?.id,
    {
      name: issue?.name,
      description_html: getTextContent(issue?.description_html),
      issueId: issue?.id,
    }
  );

  useEffect(() => {
    if (isSubmitting === "submitted") {
      setShowAlert(false);
      setTimeout(async () => setIsSubmitting("saved"), 2000);
    } else if (isSubmitting === "submitting") setShowAlert(true);
  }, [isSubmitting, setShowAlert, setIsSubmitting]);

  if (!issue || !issue.project_id) return <></>;

  const isPeekModeActive = Boolean(peekIssue);

  return (
    <>
      <div className="space-y-4 rounded-lg">
        {issue.parent_id && (
          <IssueParentDetail
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issueId}
            issue={issue}
            issueOperations={issueOperations}
          />
        )}

        <div className="mb-2.5 flex items-center justify-between gap-4">
          <IssueTypeSwitcher issueId={issueId} disabled={isArchived || !isEditable} />
          <div className="flex items-center gap-3">
            <NameDescriptionUpdateStatus isSubmitting={isSubmitting} />
            {duplicateIssues?.length > 0 && (
              <DeDupeIssuePopoverRoot
                workspaceSlug={workspaceSlug}
                projectId={issue.project_id}
                rootIssueId={issueId}
                issues={duplicateIssues}
                issueOperations={issueOperations}
                renderDeDupeActionModals={!isPeekModeActive}
              />
            )}
          </div>
        </div>

        <IssueTitleInput
          workspaceSlug={workspaceSlug}
          projectId={issue.project_id}
          issueId={issue.id}
          isSubmitting={isSubmitting}
          setIsSubmitting={(value) => setIsSubmitting(value)}
          issueOperations={issueOperations}
          disabled={isArchived || !isEditable}
          value={issue.name}
          containerClassName="-ml-3"
        />

        <SocialCaseForm
          issueId={issue.id}
          mode="view"
          descriptionHtml={issue.description_html ?? ""}
          isClosed={isClosed}
          isSinResolucion={isSinResolucion}
          isEnProceso={isEnProceso}
          isArticulacion={isArticulacion}
          isRecibido={isRecibido}
          onSave={async (newHtml) => {
            if (!workspaceSlug || !issue.project_id) return;
            await issueOperations.update(workspaceSlug.toString(), issue.project_id, issue.id, {
              description_html: newHtml,
            });
            invalidateSocialCaseActividades(workspaceSlug.toString(), issue.project_id);
          }}
          onComplete={
            completedStateId
              ? async () => {
                  await handleStateChange(completedStateId);
                }
              : undefined
          }
          onAdvance={
            isRecibido && procesoStateId
              ? async () => {
                  await issueOperations.update(workspaceSlug, projectId, issueId, { state_id: procesoStateId });
                }
              : isEnProceso && articulacionStateId
                ? async () => {
                    await issueOperations.update(workspaceSlug, projectId, issueId, { state_id: articulacionStateId });
                  }
                : undefined
          }
          onRetreat={
            isEnProceso && recibidoStateId
              ? async () => {
                  await issueOperations.update(workspaceSlug, projectId, issueId, { state_id: recibidoStateId });
                }
              : isArticulacion && procesoStateId
                ? async () => {
                    await issueOperations.update(workspaceSlug, projectId, issueId, { state_id: procesoStateId });
                  }
                : undefined
          }
          onSinResolucion={
            sinResolucionStateId && !isClosed && !isSinResolucion
              ? async () => {
                  await issueOperations.update(workspaceSlug, projectId, issueId, { state_id: sinResolucionStateId });
                }
              : undefined
          }
          onReabrir={
            (isClosed || isSinResolucion) && procesoStateId
              ? async () => {
                  await issueOperations.update(workspaceSlug, projectId, issueId, { state_id: procesoStateId });
                }
              : undefined
          }
          onPhotoUpload={async (file) => {
            const response = await fileService.uploadProjectAsset(
              workspaceSlug,
              projectId,
              { entity_identifier: issueId, entity_type: EFileAssetType.ISSUE_DESCRIPTION },
              file
            );
            return response.asset_url ?? "";
          }}
          onSavingChange={(status) => setIsSubmitting(status)}
          actividadesDisponibles={actividadesDisponibles}
        />

        {isSocialCase && (
          <div className="flex">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={exportFicha}
              disabled={isExporting}
              loading={isExporting}
            >
              {!isExporting && <FileDown className="mr-1.5 size-3.5" />}
              Exportar PDF
            </Button>
          </div>
        )}

        <DescriptionInput
          issueSequenceId={issue.sequence_id}
          containerClassName="-ml-6 border-none p-0! pl-6!"
          disabled={isArchived || !isEditable}
          editorRef={editorRef}
          entityId={issue.id}
          fileAssetType={EFileAssetType.ISSUE_DESCRIPTION}
          initialValue={stripSocialCaseFromHtml(issue.description_html ?? "")}
          key={issue.id}
          onSubmit={async (value, isMigrationUpdate) => {
            if (!issue.id || !issue.project_id) return;
            // Re-inyectar la ficha y la foto de perfil en el HTML antes de guardar
            const existingData = extractFromHtml(issue.description_html ?? "");
            const existingPhotoUrl = extractProfilePhotoFromHtml(issue.description_html ?? "");
            let finalHtml = existingData
              ? injectSocialCaseIntoHtml(value.description_html ?? "<p></p>", existingData)
              : (value.description_html ?? "<p></p>");
            if (existingPhotoUrl) finalHtml = injectProfilePhotoIntoHtml(finalHtml, existingPhotoUrl);
            await issueOperations.update(workspaceSlug, issue.project_id, issue.id, {
              description_html: finalHtml,
              ...(isMigrationUpdate ? { skip_activity: "true" } : {}),
            });
          }}
          projectId={issue.project_id}
          setIsSubmitting={(value) => setIsSubmitting(value)}
          workspaceSlug={workspaceSlug}
        />

        <div className="flex items-center justify-between gap-2">
          {currentUser && (
            <IssueReaction
              className="flex-shrink-0"
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              currentUser={currentUser}
              disabled={isArchived}
            />
          )}
          {isEditable && (
            <DescriptionVersionsRoot
              className="flex-shrink-0"
              entityInformation={{
                createdAt: issue.created_at ? new Date(issue.created_at) : new Date(),
                createdByDisplayName: getUserDetails(issue.created_by ?? "")?.display_name ?? "",
                id: issueId,
                isRestoreDisabled: !isEditable || isArchived,
              }}
              fetchHandlers={{
                listDescriptionVersions: (id) =>
                  workItemVersionService.listDescriptionVersions(workspaceSlug, projectId, id),
                retrieveDescriptionVersion: (id, versionId) =>
                  workItemVersionService.retrieveDescriptionVersion(workspaceSlug, projectId, id, versionId),
              }}
              handleRestore={(descriptionHTML) => editorRef.current?.setEditorValue(descriptionHTML, true)}
              projectId={projectId}
              workspaceSlug={workspaceSlug}
            />
          )}
        </div>
      </div>

      <IssueDetailWidgets
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        issueId={issueId}
        disabled={!isEditable || isArchived}
        renderWidgetModals={!isPeekModeActive}
        issueServiceType={EIssueServiceType.ISSUES}
        extraActionButtons={
          <SocialCaseSlotButtons
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issueId}
            onSlotUpload={async (slotPrefix, file) => {
              const prefixedFile = new File([file], `${slotPrefix}_${file.name}`, { type: file.type });
              await attachmentService.uploadIssueAttachment(workspaceSlug, projectId, issueId, prefixedFile);
            }}
          />
        }
      />

      {windowSize[0] < 768 && (
        <PeekOverviewProperties
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          issueOperations={issueOperations}
          disabled={!isEditable || isArchived}
        />
      )}

      <IssueActivity workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={isArchived} />
    </>
  );
});
