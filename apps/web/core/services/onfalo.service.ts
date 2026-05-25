import axios from "axios";
import { API_BASE_URL } from "@plane/constants";
import { VENEZUELA_ESTADOS } from "@/components/issues/social-case-estados";

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

const ONFALO_PHOTO_BASE = `${API_BASE_URL.replace(/\/$/, "")}/api/cedula-photo`;

const firstNonEmptyAll = (...vals: unknown[]): string => {
  for (const v of vals) {
    if (Array.isArray(v)) {
      const flat = (v as unknown[])
        .filter((x) => typeof x === "string" || typeof x === "number")
        .map(String)
        .join(", ");
      if (flat) return flat;
      continue;
    }
    if (!v || (typeof v !== "string" && typeof v !== "number")) continue;
    const parts = String(v)
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return "";
};

// Normaliza nombre de estado: elimina tildes, mayúsculas, resuelve aliases históricos
const ESTADO_ALIASES: Record<string, string> = {
  VARGAS: "LA GUAIRA",
  "DTTO CAPITAL": "DISTRITO CAPITAL",
  "DISTRITO FEDERAL": "DISTRITO CAPITAL",
};
const stripAccents = (s: string) =>
  s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const normalizeEstado = (raw: string): string => {
  if (!raw) return "";
  const normalized = stripAccents(raw);
  if (ESTADO_ALIASES[normalized]) return ESTADO_ALIASES[normalized];
  return VENEZUELA_ESTADOS.find((e) => stripAccents(e) === normalized) ?? "";
};

export class OnfaloService {
  async lookupCedula(rawCedula: string): Promise<OnfaloPersonData | null> {
    const prefixMatch = rawCedula.toUpperCase().match(/^([VEJGP])/);
    const prefix = prefixMatch ? prefixMatch[1] : "V";
    const num = rawCedula.replace(/\D/g, "");
    if (!num || num.length < 6) return null;

    try {
      const res = await axios.get(`${API_BASE_URL}/api/cedula-lookup/${prefix}/${num}/`, {
        withCredentials: true,
      });
      // Onfalo wraps the person object under response.data.data
      const d = res.data?.data ?? res.data ?? {};
      const nombre =
        (d.nombre_completo || null) ??
        ([d.identity?.[0]?.firstName, d.identity?.[0]?.firstSurname].filter(Boolean).join(" ") || null) ??
        "";
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
      const direccion = d.fiscalData?.direccion ?? d.fiscalData?.address ?? "";
      const parroquia = d.fiscalData?.parroquia ?? "";
      const municipio = d.fiscalData?.municipio ?? "";
      const rawEstado: string = d.fiscalData?.estado ?? d.fiscalData?.entidad ?? "";
      const entidad = normalizeEstado(rawEstado);
      // photos[0] puede ser string o { url: string } dependiendo del endpoint de Onfalo
      const rawPhoto = d.photos?.[0] ?? d.photoPersons?.[0]?.photo?.url;
      const photoFile: string | undefined =
        typeof rawPhoto === "string"
          ? rawPhoto
          : rawPhoto && typeof rawPhoto === "object" && typeof (rawPhoto as any).url === "string"
            ? (rawPhoto as any).url
            : undefined;
      const fotoUrl = photoFile ? `${ONFALO_PHOTO_BASE}/${photoFile}` : null;
      return { nombre, telefono, direccion, parroquia, municipio, entidad, fotoUrl, notFound: false };
    } catch (err: any) {
      const httpStatus = err?.response?.status;
      if (httpStatus === 404 || httpStatus === 503 || httpStatus === 502 || httpStatus === 500)
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
