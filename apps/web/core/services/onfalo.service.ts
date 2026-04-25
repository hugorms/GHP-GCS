import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type OnfaloPersonData = {
  nombre: string;
  telefono: string;
  direccion: string;
  fotoUrl: string | null;
};

export class OnfaloService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async lookupCedula(cedula: string): Promise<OnfaloPersonData | null> {
    const num = cedula.replace(/\D/g, "");
    if (!num || num.length < 6) return null;

    return this.get(`/api/cedula-lookup/${num}/`)
      .then((res) => {
        const d = res?.data ?? {};
        const nombre = d.nombre_completo ?? d.nombre ?? [d.nombres, d.apellidos].filter(Boolean).join(" ") ?? "";
        const telefono = d.telefono ?? d.phone ?? d.celular ?? d.movil ?? "";
        const direccion = d.direccion ?? d.address ?? d.domicilio ?? "";
        const fotoUrl = d.foto_url ?? d.foto ?? d.photo_url ?? d.photo ?? d.image ?? null;
        return { nombre, telefono, direccion, fotoUrl };
      })
      .catch(() => null);
  }
}
