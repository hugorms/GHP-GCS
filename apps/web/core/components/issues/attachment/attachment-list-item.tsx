/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { observer } from "mobx-react";
import { X, Download } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { TrashIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssueServiceType } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
// ui
import { CustomMenu } from "@plane/ui";
import { convertBytesToSize, getFileExtension, getFileName, getFileURL, renderFormattedDate } from "@plane/utils";
// components
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { getFileIcon } from "@/components/icons";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { usePlatformOS } from "@/hooks/use-platform-os";

type TIssueAttachmentsListItem = {
  attachmentId: string;
  disabled?: boolean;
  issueServiceType?: TIssueServiceType;
};

// ── Lightbox ─────────────────────────────────────────────────────────────────
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return createPortal(
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa de imagen"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* Botones de acción */}
      <div
        role="toolbar"
        className="absolute top-4 right-4 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <a
          href={src}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20"
          title="Descargar"
        >
          <Download className="h-4 w-4" />
        </a>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20"
          title="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* Imagen — stopPropagation para no cerrar al hacer clic sobre ella */}
      <img
        src={src}
        alt={alt}
        className="shadow-2xl max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

// ── Slot badge helpers ────────────────────────────────────────────────────────
const SLOT_BADGE_MAP: Record<string, string> = {
  "[CI_SOL]": "C.I. Solicitante",
  "[CI_BEN]": "C.I. Beneficiario",
  "[ENTREGA]": "Registro Fotográfico",
};
const SLOT_PREFIXES = Object.keys(SLOT_BADGE_MAP);

function getSlotInfo(rawName: string) {
  let strippedName = rawName;
  let firstPrefix: string | undefined;
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of SLOT_PREFIXES) {
      if (strippedName.startsWith(`${p}_`)) {
        if (!firstPrefix) firstPrefix = p;
        strippedName = strippedName.slice(p.length + 1);
        changed = true;
        break;
      }
    }
  }
  return {
    badge: firstPrefix ? SLOT_BADGE_MAP[firstPrefix] : null,
    cleanName: getFileName(strippedName),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export const IssueAttachmentsListItem = observer(function IssueAttachmentsListItem(props: TIssueAttachmentsListItem) {
  const { t } = useTranslation();
  const { attachmentId, disabled, issueServiceType = EIssueServiceType.ISSUES } = props;
  const { getUserDetails } = useMember();
  const {
    attachment: { getAttachmentById },
    toggleDeleteAttachmentModal,
  } = useIssueDetail(issueServiceType);
  const { isMobile } = usePlatformOS();

  const [lightboxOpen, setLightboxOpen] = useState(false);

  const attachment = attachmentId ? getAttachmentById(attachmentId) : undefined;
  if (!attachment) return <></>;

  const fileExtension = getFileExtension(attachment.attributes.name ?? "");
  const fileIcon = getFileIcon(fileExtension, 18);
  const fileURL = getFileURL(attachment.asset_url ?? "");
  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(attachment.attributes.name ?? "");
  const { badge: slotBadge, cleanName: cleanFileName } = getSlotInfo(attachment.attributes.name ?? "");

  return (
    <>
      {lightboxOpen && fileURL && (
        <ImageLightbox src={fileURL} alt={cleanFileName} onClose={() => setLightboxOpen(false)} />
      )}

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isImage) {
            setLightboxOpen(true);
          } else {
            window.open(fileURL ?? "", "_blank");
          }
        }}
      >
        <div
          className={`group flex items-center justify-between gap-3 pr-2 hover:bg-surface-2 ${
            isImage ? "h-[80px] pl-3" : "h-11 pl-9"
          }`}
        >
          <div className="flex items-center gap-3 truncate text-13">
            <div className={`flex-shrink-0 overflow-hidden rounded ${isImage ? "h-[64px] w-[86px]" : ""}`}>
              {isImage && fileURL ? (
                <img src={fileURL} alt={cleanFileName} className="h-full w-full rounded object-cover" />
              ) : (
                fileIcon
              )}
            </div>
            <div className="flex flex-col gap-1 truncate">
              <Tooltip tooltipContent={`${cleanFileName}.${fileExtension}`} isMobile={isMobile}>
                <p className="truncate font-medium text-secondary">{`${cleanFileName}.${fileExtension}`}</p>
              </Tooltip>
              <div className="flex items-center gap-2">
                <span className="text-xs flex-shrink-0 text-placeholder">
                  {convertBytesToSize(attachment.attributes.size)}
                </span>
                {slotBadge && (
                  <span className="bg-custom-background-80 text-custom-text-300 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">
                    {slotBadge}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {attachment.created_by && (
              <Tooltip
                isMobile={isMobile}
                tooltipContent={`${
                  getUserDetails(attachment.created_by)?.display_name ?? ""
                } uploaded on ${renderFormattedDate(attachment.updated_at)}`}
              >
                <div className="flex items-center justify-center">
                  <ButtonAvatars showTooltip userIds={attachment.created_by} />
                </div>
              </Tooltip>
            )}

            <CustomMenu ellipsis closeOnSelect placement="bottom-end" disabled={disabled}>
              <CustomMenu.MenuItem onClick={() => toggleDeleteAttachmentModal(attachmentId)}>
                <div className="flex items-center gap-2">
                  <TrashIcon className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>{t("common.actions.delete")}</span>
                </div>
              </CustomMenu.MenuItem>
            </CustomMenu>
          </div>
        </div>
      </button>
    </>
  );
});
