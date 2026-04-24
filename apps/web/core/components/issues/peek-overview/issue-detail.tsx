/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import { EFileAssetType } from "@plane/types";
import type { TNameDescriptionLoader } from "@plane/types";
// components
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
import { useSocialCaseActividades, invalidateSocialCaseActividades } from "@/hooks/use-social-case-actividades";
// plane web components
import { DeDupeIssuePopoverRoot } from "@/plane-web/components/de-dupe/duplicate-popover";
import { IssueTypeSwitcher } from "@/plane-web/components/issues/issue-details/issue-type-switcher";
// plane web hooks
import { useDebouncedDuplicateIssues } from "@/plane-web/hooks/use-debounced-duplicate-issues";
// services
import { WorkItemVersionService } from "@/services/issue";
// local components
import type { TIssueOperations } from "../issue-detail";
import { IssueParentDetail } from "../issue-detail/parent";
import { IssueReaction } from "../issue-detail/reactions";
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
import { FileService } from "@/services/file.service";

const fileService = new FileService();
// services init
const workItemVersionService = new WorkItemVersionService();

type Props = {
  editorRef: React.RefObject<EditorRefApi>;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled: boolean;
  isArchived: boolean;
  isSubmitting: TNameDescriptionLoader;
  setIsSubmitting: (value: TNameDescriptionLoader) => void;
};

export const PeekOverviewIssueDetails = observer(function PeekOverviewIssueDetails(props: Props) {
  const { editorRef, workspaceSlug, issueId, issueOperations, disabled, isArchived, isSubmitting, setIsSubmitting } =
    props;
  // store hooks
  const { data: currentUser } = useUser();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getProjectById } = useProject();
  const { getStateById, getProjectStates } = useProjectState();
  const { getUserDetails } = useMember();
  // reload confirmation
  const { setShowAlert } = useReloadConfirmations(isSubmitting === "submitting");

  useEffect(() => {
    if (isSubmitting === "submitted") {
      setShowAlert(false);
      setTimeout(async () => {
        setIsSubmitting("saved");
      }, 2000);
    } else if (isSubmitting === "submitting") {
      setShowAlert(true);
    }
  }, [isSubmitting, setShowAlert, setIsSubmitting]);

  // derived values
  const issue = issueId ? getIssueById(issueId) : undefined;
  const projectDetails = issue?.project_id ? getProjectById(issue?.project_id) : undefined;
  const currentState = issue?.state_id ? getStateById(issue.state_id) : undefined;
  const projectStates = issue?.project_id ? getProjectStates(issue.project_id) : undefined;
  // El flujo de casos sociales solo aplica si el proyecto tiene los tres estados esperados.
  const hasSocialCaseWorkflow = Boolean(
    projectStates?.some((s) => s.name?.toLowerCase().includes("proceso")) &&
    projectStates?.some((s) => s.name?.toLowerCase().includes("articulaci")) &&
    projectStates?.some((s) => s.name?.toLowerCase().includes("recib"))
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
  const { handleStateChange } = useSocialCaseStateChange({
    workspaceSlug,
    projectId: issue?.project_id ?? "",
    issueId,
    issueOperations,
  });
  const actividadesDisponibles = useSocialCaseActividades(workspaceSlug, issue?.project_id ?? "");
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

  if (!issue || !issue.project_id) return <></>;

  const issueDescription =
    typeof issue.description_html === "string"
      ? issue.description_html !== ""
        ? stripSocialCaseFromHtml(issue.description_html)
        : "<p></p>"
      : undefined;

  return (
    <div className="space-y-2">
      {issue.parent_id && (
        <IssueParentDetail
          workspaceSlug={workspaceSlug}
          projectId={issue.project_id}
          issueId={issueId}
          issue={issue}
          issueOperations={issueOperations}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <IssueTypeSwitcher issueId={issueId} disabled={isArchived || disabled} />
        {duplicateIssues?.length > 0 && (
          <DeDupeIssuePopoverRoot
            workspaceSlug={workspaceSlug}
            projectId={issue.project_id}
            rootIssueId={issueId}
            issues={duplicateIssues}
            issueOperations={issueOperations}
          />
        )}
      </div>
      <IssueTitleInput
        workspaceSlug={workspaceSlug}
        projectId={issue.project_id}
        issueId={issue.id}
        isSubmitting={isSubmitting}
        setIsSubmitting={(value) => setIsSubmitting(value)}
        issueOperations={issueOperations}
        disabled={disabled || isArchived}
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
                await issueOperations.update(workspaceSlug, issue.project_id ?? "", issueId, {
                  state_id: procesoStateId,
                });
              }
            : isEnProceso && articulacionStateId
              ? async () => {
                  await issueOperations.update(workspaceSlug, issue.project_id ?? "", issueId, {
                    state_id: articulacionStateId,
                  });
                }
              : undefined
        }
        onRetreat={
          isEnProceso && recibidoStateId
            ? async () => {
                await issueOperations.update(workspaceSlug, issue.project_id ?? "", issueId, {
                  state_id: recibidoStateId,
                });
              }
            : isArticulacion && procesoStateId
              ? async () => {
                  await issueOperations.update(workspaceSlug, issue.project_id ?? "", issueId, {
                    state_id: procesoStateId,
                  });
                }
              : undefined
        }
        onSinResolucion={
          sinResolucionStateId && !isClosed && !isSinResolucion
            ? async () => {
                await issueOperations.update(workspaceSlug, issue.project_id ?? "", issueId, {
                  state_id: sinResolucionStateId,
                });
              }
            : undefined
        }
        onReabrir={
          (isClosed || isSinResolucion) && procesoStateId
            ? async () => {
                await issueOperations.update(workspaceSlug, issue.project_id ?? "", issueId, {
                  state_id: procesoStateId,
                });
              }
            : undefined
        }
        onPhotoUpload={async (file) => {
          if (!issue.project_id) return "";
          const response = await fileService.uploadProjectAsset(
            workspaceSlug,
            issue.project_id,
            { entity_identifier: issueId, entity_type: EFileAssetType.ISSUE_DESCRIPTION },
            file
          );
          return response.asset_url ?? "";
        }}
        onSavingChange={(status) => setIsSubmitting(status)}
        actividadesDisponibles={actividadesDisponibles}
      />

      <DescriptionInput
        issueSequenceId={issue.sequence_id}
        containerClassName="-ml-3 border-none"
        disabled={disabled || isArchived}
        editorRef={editorRef}
        entityId={issue.id}
        fileAssetType={EFileAssetType.ISSUE_DESCRIPTION}
        initialValue={issueDescription}
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
        setIsSubmitting={(value) => setIsSubmitting(value)}
        projectId={issue.project_id}
        workspaceSlug={workspaceSlug}
      />

      <div className="flex items-center justify-between gap-2">
        {currentUser && (
          <IssueReaction
            workspaceSlug={workspaceSlug}
            projectId={issue.project_id}
            issueId={issueId}
            currentUser={currentUser}
            disabled={isArchived}
          />
        )}
        {!disabled && (
          <DescriptionVersionsRoot
            className="flex-shrink-0"
            entityInformation={{
              createdAt: issue.created_at ? new Date(issue.created_at) : new Date(),
              createdByDisplayName: getUserDetails(issue.created_by ?? "")?.display_name ?? "",
              id: issueId,
              isRestoreDisabled: disabled || isArchived,
            }}
            fetchHandlers={{
              listDescriptionVersions: (id) =>
                workItemVersionService.listDescriptionVersions(workspaceSlug, issue.project_id?.toString() ?? "", id),
              retrieveDescriptionVersion: (id, versionId) =>
                workItemVersionService.retrieveDescriptionVersion(
                  workspaceSlug,
                  issue.project_id?.toString() ?? "",
                  id,
                  versionId
                ),
            }}
            handleRestore={(descriptionHTML) => editorRef.current?.setEditorValue(descriptionHTML, true)}
            projectId={issue.project_id}
            workspaceSlug={workspaceSlug}
          />
        )}
      </div>
    </div>
  );
});
