/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useState } from "react";
import { observer } from "mobx-react";
import { useDropzone } from "react-dropzone";
// plane web hooks
import { useFileSize } from "@/plane-web/hooks/use-file-size";
// types
import type { TAttachmentOperations } from "../issue-detail-widgets/attachments/helper";
import { ImageCropModal } from "./image-crop-modal";

type TAttachmentOperationsModal = Pick<TAttachmentOperations, "create">;

type Props = {
  workspaceSlug: string;
  disabled?: boolean;
  attachmentOperations: TAttachmentOperationsModal;
};

export const IssueAttachmentUpload = observer(function IssueAttachmentUpload(props: Props) {
  const { workspaceSlug, disabled = false, attachmentOperations } = props;
  // states
  const [isLoading, setIsLoading] = useState(false);
  const [cropData, setCropData] = useState<{ src: string; file: File } | null>(null);
  // file size
  const { maxFileSize } = useFileSize();

  const uploadFile = useCallback(
    (file: File) => {
      setIsLoading(true);
      attachmentOperations.create(file).finally(() => setIsLoading(false));
    },
    [attachmentOperations]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const currentFile: File = acceptedFiles[0];
      if (!currentFile || !workspaceSlug) return;

      if (/\.(jpg|jpeg|png|webp|gif)$/i.test(currentFile.name)) {
        const reader = new FileReader();
        reader.onload = () => setCropData({ src: reader.result as string, file: currentFile });
        reader.readAsDataURL(currentFile);
      } else {
        uploadFile(currentFile);
      }
    },
    [uploadFile, workspaceSlug]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop,
    maxSize: maxFileSize,
    multiple: false,
    disabled: isLoading || disabled,
  });

  const fileError =
    fileRejections.length > 0 ? `Invalid file type or size (max ${maxFileSize / 1024 / 1024} MB)` : null;

  return (
    <>
      {cropData && (
        <ImageCropModal
          imageSrc={cropData.src}
          fileName={cropData.file.name}
          onConfirm={(croppedFile) => {
            setCropData(null);
            uploadFile(croppedFile);
          }}
          onCancel={() => setCropData(null)}
        />
      )}
      <div
        {...getRootProps()}
        className={`flex h-[60px] items-center justify-center rounded-md border-2 border-dashed bg-accent-primary/5 px-4 text-11 text-accent-primary ${
          isDragActive ? "border-accent-strong bg-accent-primary/10" : "border-subtle"
        } ${isDragReject ? "bg-danger-subtle" : ""} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input {...getInputProps()} />
        <span className="flex items-center gap-2">
          {isDragActive ? (
            <p>Drop here...</p>
          ) : fileError ? (
            <p className="text-center text-danger-primary">{fileError}</p>
          ) : isLoading ? (
            <p className="text-center">Uploading...</p>
          ) : (
            <p className="text-center">Click or drag a file here</p>
          )}
        </span>
      </div>
    </>
  );
});
