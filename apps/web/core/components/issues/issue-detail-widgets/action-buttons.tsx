/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Paperclip } from "lucide-react";
// plane imports
import type { TIssueServiceType, TWorkItemWidgets } from "@plane/types";
// plane web imports
import { WorkItemAdditionalWidgetActionButtons } from "@/plane-web/components/issues/issue-detail-widgets/action-buttons";
// local imports
import { IssueAttachmentActionButton } from "./attachments";
import { IssueDetailWidgetButton } from "./widget-button";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  issueServiceType: TIssueServiceType;
  hideWidgets?: TWorkItemWidgets[];
  extraButtons?: React.ReactNode;
};

export function IssueDetailWidgetActionButtons(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled, issueServiceType, hideWidgets, extraButtons } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hideWidgets?.includes("attachments") && (
        <IssueAttachmentActionButton
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          customButton={
            <IssueDetailWidgetButton
              title="Adjuntar solicitud"
              icon={<Paperclip className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />}
              disabled={disabled}
            />
          }
          disabled={disabled}
          issueServiceType={issueServiceType}
        />
      )}
      <WorkItemAdditionalWidgetActionButtons
        disabled={disabled}
        hideWidgets={hideWidgets ?? []}
        issueServiceType={issueServiceType}
        projectId={projectId}
        workItemId={issueId}
        workspaceSlug={workspaceSlug}
      />
      {extraButtons}
    </div>
  );
}
