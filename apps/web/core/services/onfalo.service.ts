import axios from "axios";

const ONFALO_BASE = "https://onfalo.api.sp3.com.ve";
const ONFALO_KEY = "sk_mppdgcs_c0385679d3e22938191c47c7c2f45292";
const ONFALO_TENANT = "sp3";

export type OnfaloPersonData = {
  nombre: string;
  telefono: string;
  direccion: string;
  fotoUrl: string | null;
  notFound: boolean;
};

export class OnfaloService {
  async lookupCedula(rawCedula: string): Promise<OnfaloPersonData | null> {
    const prefixMatch = rawCedula.toUpperCase().match(/^([VEJGP])/);
    const prefix = prefixMatch ? prefixMatch[1] : "V";
    const num = rawCedula.replace(/\D/g, "");
    if (!num || num.length < 6) return null;

    try {
      const res = await axios.post(
        `${ONFALO_BASE}/v1/person/search/external/full/${prefix}/${num}`,
        {},
        {
          headers: {
            "X-Api-Key": ONFALO_KEY,
            "X-Tenant-Id": ONFALO_TENANT,
            "Content-Type": "application/json",
          },
        }
      );
      const d = res.data ?? {};
      const nombre = d.nombre_completo ?? d.nombre ?? [d.nombres, d.apellidos].filter(Boolean).join(" ") ?? "";
      const telefono = d.telefono ?? d.phone ?? d.celular ?? d.movil ?? "";
      const direccion = d.direccion ?? d.address ?? d.domicilio ?? "";
      const fotoUrl = d.foto_url ?? d.foto ?? d.photo_url ?? d.photo ?? d.image ?? null;
      return { nombre, telefono, direccion, fotoUrl, notFound: false };
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) return { nombre: "", telefono: "", direccion: "", fotoUrl: null, notFound: true };
      return null;
    }
  }
}
