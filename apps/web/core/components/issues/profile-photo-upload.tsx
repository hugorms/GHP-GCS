import { useRef, useState, useEffect } from "react";
import { cn, getFileURL } from "@plane/utils";

type Props = {
  photoUrl: string | null; // URL servidor (cuando ya está guardado)
  previewUrl?: string | null; // blob URL local para preview inmediato
  uploading?: boolean;
  onFileSelected: (file: File) => void;
};

export const ProfilePhotoUpload = ({ photoUrl, previewUrl, uploading = false, onFileSelected }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(
    () => () => {
      stopStream();
    },
    []
  );

  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [showCamera]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleBoxClick = async () => {
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        streamRef.current = stream;
        setShowCamera(true);
        return;
      } catch {
        /* sin permiso → galería */
      }
    }
    fileInputRef.current?.click();
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream();
        setShowCamera(false);
        onFileSelected(new File([blob], "captura.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileSelected(file);
    e.target.value = "";
  };

  const displaySrc = previewUrl ?? (photoUrl ? getFileURL(photoUrl) : null);

  return (
    <>
      <div className="flex justify-center pb-3">
        <button
          type="button"
          onClick={handleBoxClick}
          className={cn(
            "relative h-28 w-24 overflow-hidden rounded-md transition-colors focus:outline-none",
            "flex items-center justify-center bg-surface-2",
            displaySrc
              ? "border-custom-border-200 hover:border-custom-primary-100 border border-solid"
              : "border-custom-border-200 hover:border-custom-primary-100 border border-dashed"
          )}
          title="Tomar foto"
        >
          {displaySrc ? (
            <img src={displaySrc} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="text-custom-text-400 h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
          )}

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <svg className="h-6 w-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Modal cámara */}
      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-custom-background-100 border-custom-border-200 shadow-xl mx-4 w-full max-w-sm overflow-hidden rounded-xl border">
            <div className="border-custom-border-200 flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm text-custom-text-100 font-medium">Tomar foto</span>
              <button
                type="button"
                onClick={() => {
                  stopStream();
                  setShowCamera(false);
                }}
                className="text-custom-text-400 hover:text-custom-text-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <video ref={videoRef} autoPlay playsInline muted className="aspect-[3/4] w-full bg-black object-cover" />
            <div className="flex justify-center p-4">
              <button
                type="button"
                onClick={handleCapture}
                className="border-custom-border-300 shadow h-14 w-14 rounded-full border-4 bg-white transition-transform hover:scale-105"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
