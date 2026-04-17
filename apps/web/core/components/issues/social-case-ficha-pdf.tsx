import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { SocialCaseData } from "./social-case-form";

// ── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  black: "#09090b",
  gray900: "#18181b",
  gray700: "#3f3f46",
  gray500: "#71717a",
  gray300: "#d4d4d8",
  gray100: "#f4f4f5",
  white: "#ffffff",
  blue: "#1e40af",
  blueLight: "#dbeafe",
  green: "#15803d",
  greenLight: "#dcfce7",
  border: "#e4e4e7",
};

// ── Estilos ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: C.black,
    backgroundColor: C.white,
  },

  // ── ENCABEZADO INSTITUCIONAL ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom: `2px solid ${C.blue}`,
  },
  headerLeft: {
    flexDirection: "column",
    gap: 2,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: C.blue,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 8,
    color: C.gray500,
  },
  headerBadge: {
    backgroundColor: C.blue,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  headerBadgeText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.white,
  },
  headerBadgeSub: {
    fontSize: 7,
    color: "#bfdbfe",
    marginTop: 1,
  },

  // ── DATOS PRINCIPALES (fila superior) ──
  mainRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  photoBox: {
    width: 90,
    height: 118,
    borderRadius: 5,
    backgroundColor: C.gray100,
    justifyContent: "center",
    alignItems: "center",
    border: `1px solid ${C.border}`,
  },
  photoImg: {
    width: 90,
    height: 118,
    borderRadius: 5,
    objectFit: "cover",
  },
  photoPlaceholderText: {
    fontSize: 7,
    color: C.gray500,
    textAlign: "center",
  },
  mainData: {
    flex: 1,
  },
  nombreCiudadano: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: C.gray900,
    marginBottom: 2,
  },
  cedulaCiudadano: {
    fontSize: 9,
    color: C.blue,
    marginBottom: 10,
  },

  // ── GRID DE CAMPOS ──
  fieldGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  fieldItem: {
    width: "47%",
  },
  fieldItemFull: {
    width: "100%",
  },
  fieldLabel: {
    fontSize: 7,
    color: C.gray500,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 9,
    color: C.gray900,
    borderBottom: `1px solid ${C.border}`,
    paddingBottom: 3,
    minHeight: 16,
  },

  // ── SECCIÓN CON TÍTULO ──
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.gray700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingBottom: 4,
    marginBottom: 6,
    borderBottom: `1px solid ${C.border}`,
  },
  sectionTitleBlue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.blue,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingBottom: 4,
    marginBottom: 6,
    borderBottom: `2px solid ${C.blue}`,
  },
  sectionTitleGreen: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.green,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingBottom: 4,
    marginBottom: 6,
    borderBottom: `2px solid ${C.green}`,
  },
  textBlock: {
    fontSize: 9,
    color: C.gray700,
    lineHeight: 1.5,
    minHeight: 14,
  },

  // ── FILA DE FOTOS DE CIERRE ──
  fotosRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  fotoBox: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  fotoImg: {
    width: "100%",
    height: 100,
    borderRadius: 4,
    objectFit: "cover",
    border: `1px solid ${C.border}`,
  },
  fotoPlaceholder: {
    width: "100%",
    height: 100,
    borderRadius: 4,
    backgroundColor: C.gray100,
    border: `1px solid ${C.border}`,
    justifyContent: "center",
    alignItems: "center",
  },
  fotoLabel: {
    fontSize: 7,
    color: C.gray500,
    textAlign: "center",
  },

  // ── SECCIÓN DE CIERRE ──
  closureBox: {
    backgroundColor: C.greenLight,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    border: `1px solid ${C.green}`,
  },

  // ── NÚMERO DE CASO (badge prominente) ──
  casoBadge: {
    backgroundColor: C.blueLight,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  casoBadgeLabel: {
    fontSize: 8,
    color: C.blue,
    fontFamily: "Helvetica-Bold",
  },
  casoBadgeNum: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.blue,
  },

  // ── FOOTER ──
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `1px solid ${C.border}`,
    paddingTop: 5,
  },
  footerText: {
    fontSize: 7,
    color: C.gray500,
  },

  divider: {
    borderBottom: `1px solid ${C.border}`,
    marginVertical: 8,
  },
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type FichaAttachment = {
  name: string;
  isImage: boolean;
  base64?: string;
};

export type SocialCaseFichaProps = {
  data: SocialCaseData;
  projectName: string;
  stateName: string;
  sequenceId: number;
  responsable: string;
  photoUrl: string | null;
  attachments?: FichaAttachment[];
  generatedAtLabel: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <View style={full ? S.fieldItemFull : S.fieldItem}>
      <Text style={S.fieldLabel}>{label}</Text>
      <Text style={S.fieldValue}>{value || "—"}</Text>
    </View>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function SocialCaseFichaPDF({
  data,
  projectName,
  stateName,
  sequenceId,
  responsable,
  photoUrl,
  attachments = [],
  generatedAtLabel,
}: SocialCaseFichaProps) {
  const fotosEntrega = attachments.filter((a) => a.isImage && a.base64);

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* ENCABEZADO INSTITUCIONAL */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={S.headerTitle}>Ficha Técnica</Text>
            <Text style={S.headerSub}>{projectName}</Text>
          </View>
          <View style={S.headerBadge}>
            <Text style={S.headerBadgeText}>CASO RESUELTO</Text>
            <Text style={S.headerBadgeSub}>{stateName}</Text>
          </View>
        </View>

        {/* BADGE NÚMERO DE CASO */}
        <View style={S.casoBadge}>
          <Text style={S.casoBadgeLabel}>N° DE CASO</Text>
          <Text style={S.casoBadgeNum}>{data.numeroCaso ? `#${data.numeroCaso}` : `GCS-${sequenceId}`}</Text>
          <Text style={[S.casoBadgeLabel, { marginLeft: "auto" }]}>RESPONSABLE</Text>
          <Text style={S.casoBadgeLabel}>{responsable}</Text>
        </View>

        {/* FILA PRINCIPAL: FOTO + DATOS CIUDADANO */}
        <View style={S.mainRow}>
          {/* Foto de perfil */}
          <View>
            {photoUrl ? (
              <Image src={photoUrl} style={S.photoImg} />
            ) : (
              <View style={S.photoBox}>
                <Text style={S.photoPlaceholderText}>Sin{"\n"}foto</Text>
              </View>
            )}
          </View>

          {/* Datos del ciudadano */}
          <View style={S.mainData}>
            <Text style={S.nombreCiudadano}>{data.nombre || "—"}</Text>
            <Text style={S.cedulaCiudadano}>{data.cedula || "—"}</Text>
            <View style={S.fieldGrid}>
              <Field label="Teléfono" value={data.telefono} />
              <Field label="Jornada" value={data.jornada} />
              <Field label="Municipio" value={data.municipio} />
              <Field label="Parroquia" value={data.parroquia} />
              <Field label="Estado" value={data.entidad} />
              <Field label="Solicitante" value={data.solicitante} />
              <Field label="Dirección" value={data.direccion} full />
            </View>
          </View>
        </View>

        <View style={S.divider} />

        {/* SECCIÓN: SEGUIMIENTO */}
        <View style={S.section}>
          <Text style={S.sectionTitleBlue}>Seguimiento del caso</Text>
          <View style={S.fieldGrid}>
            <Field label="Referencia / Origen" value={data.referencia} full />
            <Field label="Acción tomada" value={data.accionTomada} full />
            <Field label="Resultado / Beneficio otorgado" value={data.resultado} full />
          </View>
        </View>

        {/* SECCIÓN: CIERRE */}
        <View style={S.closureBox}>
          <Text style={S.sectionTitleGreen}>Cierre del caso</Text>
          <View style={S.fieldGrid}>
            <Field label="Beneficiario" value={data.nombreBeneficiario || data.nombre} />
            <Field label="Cédula del beneficiario" value={data.cedulaBeneficiario || data.cedula} />
            <Field label="Fecha de cierre" value={data.fechaCierre} />
            <Field label="Estado del caso" value={stateName} />
            {data.observacionCierre ? (
              <Field label="Observación de cierre" value={data.observacionCierre} full />
            ) : null}
          </View>
        </View>

        {/* FOTOS DE ENTREGA (adjuntos imagen) */}
        {fotosEntrega.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Evidencia fotográfica de entrega</Text>
            <View style={S.fotosRow}>
              {fotosEntrega.slice(0, 3).map((foto) => (
                <View key={foto.name} style={S.fotoBox}>
                  <Image src={foto.base64 as string} style={S.fotoImg} />
                  <Text style={S.fotoLabel}>{foto.name}</Text>
                </View>
              ))}
              {/* Placeholders si hay menos de 3 fotos */}
              {Array.from({ length: Math.max(0, 2 - fotosEntrega.length) }, (_, i) => (
                <View key={`placeholder-foto-${i}`} style={S.fotoBox}>
                  <View style={S.fotoPlaceholder}>
                    <Text style={S.fotoLabel}>Sin imagen</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* FOOTER */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>{projectName} · Ficha Técnica Individual</Text>
          <Text style={S.footerText}>Generado el {generatedAtLabel}</Text>
        </View>
      </Page>
    </Document>
  );
}
