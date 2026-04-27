import axios from "axios";
import { API_BASE_URL } from "@plane/constants";

export type OnfaloPersonData = {
  nombre: string;
  telefono: string;
  direccion: string;
  parroquia: string;
  municipio: string;
  entidad: string;
  fotoUrl: string | null;
  notFound: boolean;
};

// Proxy Django para fotos — el browser no puede enviar X-Api-Key directamente
const ONFALO_PHOTO_BASE = `${API_BASE_URL}/api/cedula-photo`;

const firstNonEmptyAll = (...vals: (string | null | undefined)[]): string => {
  for (const v of vals) {
    if (!v) continue;
    const parts = String(v)
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return "";
};

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
      console.log("[OnfaloService] fiscalData JSON:", JSON.stringify(d.fiscalData));
      console.log("[OnfaloService] ivssData[0] JSON:", JSON.stringify(d.ivssData?.[0]));
      console.log("[OnfaloService] nominaRecords[0] JSON:", JSON.stringify(d.nominaRecords?.[0]));
      console.log("[OnfaloService] dataTelecom JSON:", JSON.stringify(d.dataTelecom));
      console.log("[OnfaloService] identity[0] JSON:", JSON.stringify(d.identity?.[0]));

      const telefono = firstNonEmptyAll(
        d.dataTelecom?.suscriptorPhones?.[0]?.numero,
        d.dataTelecom?.suscriptorPhones?.[0]?.phone,
        d.dataTelecom?.suscriptorPhones?.[0]?.telefono,
        d.dataTelecom?.relationPhones?.[0]?.numero,
        d.dataTelecom?.relationPhones?.[0]?.phone,
        d.dataTelecom?.relationPhones?.[0]?.telefono,
        d.fiscalData?.telefonos,
        d.fiscalData?.telefono,
        d.fiscalData?.celular,
        d.fiscalData?.movil,
        d.fiscalData?.phone,
        d.ivssData?.[0]?.telefono,
        d.ivssData?.[0]?.celular,
        d.ivssData?.[0]?.phone,
        d.ivssData?.[0]?.movil,
        d.nominaRecords?.[0]?.telefono,
        d.nominaRecords?.[0]?.celular,
        d.nominaRecords?.[0]?.phone,
        d.identity?.[0]?.telefono,
        d.identity?.[0]?.celular,
        d.identity?.[0]?.phone,
        d.telefono,
        d.phone,
        d.celular,
        d.movil
      );
      console.log("[OnfaloService] telefono resolved:", telefono);
      const direccion = d.fiscalData?.direccion ?? d.fiscalData?.address ?? "";
      const parroquia = d.fiscalData?.parroquia ?? "";
      const municipio = d.fiscalData?.municipio ?? "";
      const entidad = d.fiscalData?.estado ?? d.fiscalData?.entidad ?? "";
      const photoFile: string | undefined = d.photos?.[0] ?? d.photoPersons?.[0]?.photo?.url;
      const fotoUrl = photoFile ? `${ONFALO_PHOTO_BASE}/${photoFile}` : null;
      return { nombre, telefono, direccion, parroquia, municipio, entidad, fotoUrl, notFound: false };
    } catch (err: any) {
      console.error("[OnfaloService] error:", err?.response?.status, err?.message, err?.response?.data);
      const status = err?.response?.status;
      if (status === 404)
        return {
          nombre: "",
          telefono: "",
          direccion: "",
          parroquia: "",
          municipio: "",
          entidad: "",
          fotoUrl: null,
          notFound: true,
        };
      return null;
    }
  }
}
