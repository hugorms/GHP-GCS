/**
 * Image crop modal — no external dependencies, uses HTML5 Canvas API.
 * Drag to select the crop area. If no area is selected, the full image is used.
 */

import { useState, useRef } from "react";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { Button } from "@plane/propel/button";

type CropBox = { x: number; y: number; w: number; h: number };
type DragStart = { x: number; y: number };

type Props = {
  imageSrc: string;
  fileName: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
};

export const ImageCropModal: React.FC<Props> = ({ imageSrc, fileName, onConfirm, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 0, h: 0 });
  const [dragStart, setDragStart] = useState<DragStart | null>(null);

  const getRelativePos = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getRelativePos(e);
    setDragStart(pos);
    setCrop({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart) return;
    const pos = getRelativePos(e);
    setCrop({
      x: Math.min(dragStart.x, pos.x),
      y: Math.min(dragStart.y, pos.y),
      w: Math.abs(pos.x - dragStart.x),
      h: Math.abs(pos.y - dragStart.y),
    });
  };

  const handleMouseUp = () => setDragStart(null);

  const buildFile = async (): Promise<File> => {
    const img = imgRef.current!;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const hasCrop = crop.w > 2 && crop.h > 2;

    const sx = hasCrop ? (crop.x / 100) * img.naturalWidth : 0;
    const sy = hasCrop ? (crop.y / 100) * img.naturalHeight : 0;
    const sw = hasCrop ? (crop.w / 100) * img.naturalWidth : img.naturalWidth;
    const sh = hasCrop ? (crop.h / 100) * img.naturalHeight : img.naturalHeight;

    canvas.width = sw;
    canvas.height = sh;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(new File([blob!], fileName, { type: "image/jpeg" })), "image/jpeg", 0.95);
    });
  };

  const hasCrop = crop.w > 2 && crop.h > 2;

  return (
    <ModalCore isOpen handleClose={onCancel} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <div className="p-5">
        {/* Header */}
        <h3 className="mb-4 text-h5-medium text-primary">Recortar imagen antes de adjuntar</h3>

        {/* Image + drag overlay */}
        <div
          ref={containerRef}
          className="relative cursor-crosshair overflow-hidden rounded-md select-none"
          style={{ maxHeight: "420px" }}
          role="application"
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="preview"
            className="w-full rounded-md object-contain"
            draggable={false}
          />

          {/* Dark overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-md bg-black/40" />

          {/* Crop selection rect */}
          {hasCrop && (
            <div
              className="pointer-events-none absolute border-2 border-white"
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.w}%`,
                height: `${crop.h}%`,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
              }}
            />
          )}
        </div>

        <p className="text-xs mt-2 text-tertiary">
          {hasCrop
            ? "Area seleccionada. Confirma para adjuntar la region recortada."
            : "Arrastra sobre la imagen para seleccionar el area a recortar. Sin seleccion se adjunta la imagen completa."}
        </p>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between">
          {hasCrop && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setCrop({ x: 0, y: 0, w: 0, h: 0 })}>
              Limpiar seleccion
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={async () => {
                const file = await buildFile();
                onConfirm(file);
              }}
            >
              {hasCrop ? "Adjuntar recortada" : "Adjuntar completa"}
            </Button>
          </div>
        </div>
      </div>
    </ModalCore>
  );
};

export default ImageCropModal;
