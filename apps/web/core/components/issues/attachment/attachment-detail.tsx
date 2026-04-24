/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { CloseIcon } from "@plane/propel/icons";
// ui
import { Tooltip } from "@plane/propel/tooltip";
import {
  convertBytesToSize,
  getFileExtension,
  getFileName,
  getFileURL,
  renderFormattedDate,
  truncateText,
} from "@plane/utils";
// icons
//
import { getFileIcon } from "@/components/icons";
// components
import { IssueAttachmentDeleteModal } from "@/components/issues/attachment/delete-attachment-modal";
// helpers
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { usePlatformOS } from "@/hooks/use-platform-os";
// types
import type { TAttachmentHelpers } from "../issue-detail-widgets/attachments/helper";

type TAttachmentOperationsRemoveModal = Exclude<TAttachmentHelpers, "create">;

type TIssueAttachmentsDetail = {
  attachmentId: string;
  attachmentHelpers: TAttachmentOperationsRemoveModal;
  disabled?: boolean;
};

export const IssueAttachmentsDetail = observer(function IssueAttachmentsDetail(props: TIssueAttachmentsDetail) {
  // props
  const { attachmentId, attachmentHelpers, disabled } = props;
  // store hooks
  const { getUserDetails } = useMember();
  const {
    attachment: { getAttachmentById },
  } = useIssueDetail();
  // state
  const [isDeleteIssueAttachmentModalOpen, setIsDeleteIssueAttachmentModalOpen] = useState(false);
  // derived values
  const attachment = attachmentId ? getAttachmentById(attachmentId) : undefined;
  const fileExtension = getFileExtension(attachment?.asset_url ?? "");
  const fileIcon = getFileIcon(fileExtension, 28);
  const fileURL = getFileURL(attachment?.asset_url ?? "");
  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(attachment?.attributes.name ?? "");
  // hooks
  const { isMobile } = usePlatformOS();

  if (!attachment) return <></>;

  // Badge de origen — detecta y limpia todos los prefijos encadenados (ej. [CI_BEN]_[CI_SOL]_...)
  const SLOT_BADGE_MAP: Record<string, string> = {
    "[CI_SOL]": "C.I. Solicitante",
    "[CI_BEN]": "C.I. Beneficiario",
    "[ENTREGA]": "Registro Fotográfico",
  };
  const SLOT_PREFIXES = Object.keys(SLOT_BADGE_MAP);
  const rawName = attachment.attributes.name ?? "";
  let strippedName = rawName;
  let firstSlotPrefix: string | undefined;
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of SLOT_PREFIXES) {
      if (strippedName.startsWith(`${p}_`)) {
        if (!firstSlotPrefix) firstSlotPrefix = p;
        strippedName = strippedName.slice(p.length + 1);
        changed = true;
        break;
      }
    }
  }
  const slotBadge = firstSlotPrefix ? SLOT_BADGE_MAP[firstSlotPrefix] : null;
  const cleanFileName = getFileName(strippedName);

  return (
    <>
      {isDeleteIssueAttachmentModalOpen && (
        <IssueAttachmentDeleteModal
          isOpen={isDeleteIssueAttachmentModalOpen}
          onClose={() => setIsDeleteIssueAttachmentModalOpen(false)}
          attachmentOperations={attachmentHelpers.operations}
          attachmentId={attachmentId}
        />
      )}
      <div
        className={`flex items-center justify-between gap-1 rounded-md border-[2px] border-subtle bg-surface-1 text-13 ${
          isImage ? "h-[80px] px-2 py-2" : "h-[60px] px-4 py-2"
        }`}
      >
        <Link href={fileURL ?? ""} target="_blank" rel="noopener noreferrer">
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 overflow-hidden rounded ${isImage ? "h-[64px] w-[86px]" : "h-7 w-7"}`}>
              {isImage && fileURL ? (
                <img src={fileURL} alt={cleanFileName} className="h-full w-full rounded object-cover" />
              ) : (
                fileIcon
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Tooltip tooltipContent={cleanFileName} isMobile={isMobile}>
                  <span className="text-13">{truncateText(cleanFileName, 10)}</span>
                </Tooltip>
                <Tooltip
                  isMobile={isMobile}
                  tooltipContent={`${
                    getUserDetails(attachment.updated_by)?.display_name ?? ""
                  } uploaded on ${renderFormattedDate(attachment.updated_at)}`}
                >
                  <span>
                    <AlertCircle className="h-3 w-3" />
                  </span>
                </Tooltip>
              </div>

              <div className="flex items-center gap-2 text-11 text-secondary">
                <span>{fileExtension.toUpperCase()}</span>
                <span>{convertBytesToSize(attachment.attributes.size)}</span>
                {slotBadge && (
                  <span className="bg-custom-background-80 text-custom-text-300 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">
                    {slotBadge}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>

        {!disabled && (
          <button type="button" onClick={() => setIsDeleteIssueAttachmentModalOpen(true)}>
            <CloseIcon className="h-4 w-4 text-secondary hover:text-primary" />
          </button>
        )}
      </div>
    </>
  );
});
