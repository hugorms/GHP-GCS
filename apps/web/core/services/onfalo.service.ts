import axios from "axios";
import { API_BASE_URL } from "@plane/constants";

export type OnfaloPersonData = {
  nombre: string;
  telefono: string;
  direccion: string;
  fotoUrl: string | null;
  notFound: boolean;
};

// Proxy Django para fotos — el browser no puede enviar X-Api-Key directamente
const ONFALO_PHOTO_BASE = `${API_BASE_URL}/api/cedula-photo`;

export class OnfaloService {
  async lookupCedula(rawCedula: string): Promise<OnfaloPersonData | null> {
    const prefixMatch = rawCedula.toUpperCase().match(/^([VEJGP])/);
    const prefix = prefixMatch ? prefixMatch[1] : "V";
    const num = rawCedula.replace(/\D/g, "");
    if (!num || num.length < 6) return null;

    try {
      const url = `${API_BASE_URL}/api/cedula-lookup/${prefix}/${num}/`;
      console.log("[OnfaloService] GET", url);
      const res = await axios.get(url, { withCredentials: true });
      console.log("[OnfaloService] raw response:", res.status, res.data);
      // Onfalo response: { type, mode, data: { nombre_completo, fiscalData, photos, ... } }
      const d = res.data?.data ?? res.data ?? {};
      console.log("[OnfaloService] parsed d:", d);
      const nombre =
        d.nombre_completo ??
        [d.identity?.[0]?.firstName, d.identity?.[0]?.firstSurname].filter(Boolean).join(" ") ??
        "";
      const telefonosRaw: string = d.fiscalData?.telefonos ?? "";
      const telefono = telefonosRaw
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
        .join(", ");
      const direccion = d.fiscalData?.direccion ?? d.fiscalData?.address ?? "";
      const photoFile: string | undefined = d.photos?.[0] ?? d.photoPersons?.[0]?.photo?.url;
      const fotoUrl = photoFile ? `${ONFALO_PHOTO_BASE}/${photoFile}` : null;
      return { nombre, telefono, direccion, fotoUrl, notFound: false };
    } catch (err: any) {
      console.error("[OnfaloService] error:", err?.response?.status, err?.message, err?.response?.data);
      const status = err?.response?.status;
      if (status === 404) return { nombre: "", telefono: "", direccion: "", fotoUrl: null, notFound: true };
      return null;
    }
  }
}
