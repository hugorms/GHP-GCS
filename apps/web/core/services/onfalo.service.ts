import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type OnfaloPersonData = {
  nombre: string;
  telefono: string;
  direccion: string;
  fotoUrl: string | null;
  notFound: boolean;
};

export class OnfaloService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async lookupCedula(rawCedula: string): Promise<OnfaloPersonData | null> {
    const prefixMatch = rawCedula.toUpperCase().match(/^([VEJGP])/);
    const prefix = prefixMatch ? prefixMatch[1] : "V";
    const num = rawCedula.replace(/\D/g, "");
    if (!num || num.length < 6) return null;

    return this.get(`/api/cedula-lookup/${prefix}/${num}/`)
      .then((res) => {
        const d = res?.data ?? {};
        const nombre = d.nombre_completo ?? d.nombre ?? [d.nombres, d.apellidos].filter(Boolean).join(" ") ?? "";
        const telefono = d.telefono ?? d.phone ?? d.celular ?? d.movil ?? "";
        const direccion = d.direccion ?? d.address ?? d.domicilio ?? "";
        const fotoUrl = d.foto_url ?? d.foto ?? d.photo_url ?? d.photo ?? d.image ?? null;
        return { nombre, telefono, direccion, fotoUrl, notFound: false };
      })
      .catch((err) => {
        const status = err?.status ?? err?.response?.status;
        if (status === 404) return { nombre: "", telefono: "", direccion: "", fotoUrl: null, notFound: true };
        return null;
      });
  }
}
