/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useMemo } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// types
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
// components
import { SPREADSHEET_COLUMNS } from "@/plane-web/components/issues/issue-layouts/utils";
import { shouldRenderColumn } from "@/helpers/issue-filter.helper";
import { buildIssueOpsFromUpdate, useSocialCaseStateChange } from "@/hooks/use-social-case-state-change";
import { WithDisplayPropertiesHOC } from "../properties/with-display-properties-HOC";

type Props = {
  displayProperties: IIssueDisplayProperties;
  issueDetail: TIssue;
  disableUserActions: boolean;
  property: keyof IIssueDisplayProperties;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  isEstimateEnabled: boolean;
};

export const IssueColumn = observer(function IssueColumn(props: Props) {
  const { displayProperties, issueDetail, disableUserActions, property, updateIssue } = props;
  // router
  const tableCellRef = useRef<HTMLTableCellElement | null>(null);
  const { workspaceSlug } = useParams();

  const socialCaseOps = useMemo(() => buildIssueOpsFromUpdate(updateIssue), [updateIssue]);
  const { handleStateChange } = useSocialCaseStateChange({
    workspaceSlug: workspaceSlug?.toString() ?? "",
    projectId: issueDetail.project_id ?? "",
    issueId: issueDetail.id,
    issueOperations: socialCaseOps,
  });

  const shouldRenderProperty = shouldRenderColumn(property);

  const Column = SPREADSHEET_COLUMNS[property];

  if (!Column) return null;

  const handleUpdateIssue = async (issue: TIssue, data: Partial<TIssue>) => {
    // Cambios de estado pasan por validación de caso social
    if (data.state_id != null && data.state_id !== issue.state_id) {
      await handleStateChange(data.state_id);
      return;
    }
    if (updateIssue) await updateIssue(issue.project_id, issue.id, data);
  };

  return (
    <WithDisplayPropertiesHOC
      displayProperties={displayProperties}
      displayPropertyKey={property}
      shouldRenderProperty={() => shouldRenderProperty}
    >
      <td
        tabIndex={0}
        className="h-11 min-w-36 border-r-[1px] border-subtle text-13 after:absolute after:bottom-[-1px] after:w-full after:border after:border-subtle"
        ref={tableCellRef}
      >
        <Column
          issue={issueDetail}
          onChange={handleUpdateIssue}
          disabled={disableUserActions}
          onClose={() => tableCellRef?.current?.focus()}
        />
      </td>
    </WithDisplayPropertiesHOC>
  );
});
