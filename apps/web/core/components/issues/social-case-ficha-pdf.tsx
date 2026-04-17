import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { SocialCaseData } from "./social-case-form";

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  black: "#000000",
  gray700: "#374151",
  gray500: "#6b7280",
  gray100: "#f3f4f6",
  white: "#ffffff",
  border: "#9ca3af",
  borderLight: "#d1d5db",
  headerBg: "#1e3a5f",
  headerText: "#ffffff",
};

// ── Estilos ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: C.black,
    backgroundColor: C.white,
  },

  // ── ENCABEZADO ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderBottom: `2px solid ${C.headerBg}`,
    paddingBottom: 8,
  },
  headerLogoBox: {
    width: 60,
    height: 40,
    backgroundColor: C.gray100,
    border: `1px solid ${C.borderLight}`,
    justifyContent: "center",
    alignItems: "center",
  },
  headerLogoImg: {
    width: 60,
    height: 40,
    objectFit: "contain",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  headerOrgName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.headerBg,
    textTransform: "uppercase",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: C.headerBg,
    textTransform: "uppercase",
    letterSpacing: 2,
    textAlign: "center",
    marginTop: 4,
  },

  // ── TABLA DE CAMPOS ──
  table: {
    border: `1px solid ${C.border}`,
    marginBottom: 0,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `1px solid ${C.border}`,
  },
  tableRowLast: {
    flexDirection: "row",
  },
  cellLabel: {
    width: "35%",
    backgroundColor: C.headerBg,
    padding: 5,
    justifyContent: "center",
  },
  cellLabelText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.headerText,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cellValue: {
    flex: 1,
    padding: 5,
    justifyContent: "center",
    borderLeft: `1px solid ${C.border}`,
  },
  cellValueText: {
    fontSize: 9,
    color: C.black,
  },

  // ── TABLA DE 4 FOTOS ──
  photoTable: {
    border: `1px solid ${C.border}`,
    marginTop: 12,
  },
  photoTableHeader: {
    flexDirection: "row",
    backgroundColor: C.headerBg,
    borderBottom: `1px solid ${C.border}`,
  },
  photoTableHeaderCell: {
    flex: 1,
    padding: 5,
    alignItems: "center",
    justifyContent: "center",
    borderRight: `1px solid ${C.borderLight}`,
  },
  photoTableHeaderCellLast: {
    flex: 1,
    padding: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  photoTableHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.headerText,
    textTransform: "uppercase",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  photoTableBody: {
    flexDirection: "row",
  },
  photoCell: {
    flex: 1,
    height: 160,
    borderRight: `1px solid ${C.border}`,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.gray100,
  },
  photoCellLast: {
    flex: 1,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.gray100,
  },
  photoCellImg: {
    width: "100%",
    height: 160,
    objectFit: "contain",
  },
  photoCellPlaceholderText: {
    fontSize: 7,
    color: C.gray500,
    textAlign: "center",
  },

  // ── FOOTER ──
  footer: {
    position: "absolute",
    bottom: 18,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `1px solid ${C.borderLight}`,
    paddingTop: 4,
  },
  footerText: {
    fontSize: 7,
    color: C.gray500,
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
  logoUrl?: string | null;
  startDate?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convierte YYYY-MM-DD → DD-MM-YYYY. Devuelve el original si no coincide el patrón. */
function formatDate(date: string): string {
  if (!date) return "";
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : date;
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={last ? S.tableRowLast : S.tableRow}>
      <View style={S.cellLabel}>
        <Text style={S.cellLabelText}>{label}</Text>
      </View>
      <View style={S.cellValue}>
        <Text style={S.cellValueText}>{value || "—"}</Text>
      </View>
    </View>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function SocialCaseFichaPDF({
  data,
  projectName,
  stateName,
  sequenceId,
  responsable: _responsable,
  photoUrl,
  attachments = [],
  generatedAtLabel,
  logoUrl,
  startDate,
}: SocialCaseFichaProps) {
  // Matching por prefijo de nombre de archivo
  const KNOWN_PREFIXES = ["[CI_SOL]", "[CI_BEN]", "[ENTREGA]"];
  const byPrefix = (prefix: string) => attachments.find((a) => a.isImage && a.base64 && a.name.startsWith(prefix));
  // SOLICITUD: primer adjunto imagen sin prefijo reservado
  const solicitudImg = attachments.find(
    (a) => a.isImage && a.base64 && !KNOWN_PREFIXES.some((p) => a.name.startsWith(p))
  );
  // REGISTRO FOTOGRÁFICO: todos los adjuntos con prefijo [ENTREGA]
  const registroImgs = attachments.filter((a) => a.isImage && a.base64 && a.name.startsWith("[ENTREGA]"));

  // Si mismoBeneficiario="true" → 3 columnas (sin C.I. SOLICITANTE)
  const mismoBeneficiario = data.mismoBeneficiario === "true";

  type FotoSlot = { label: string; imgs: (typeof attachments)[number][] };
  const fotoSlots: FotoSlot[] = [
    { label: "SOLICITUD", imgs: solicitudImg ? [solicitudImg] : [] },
    ...(mismoBeneficiario
      ? []
      : [{ label: "C.I. DEL SOLICITANTE", imgs: byPrefix("[CI_SOL]") ? [byPrefix("[CI_SOL]")!] : [] }]),
    { label: "C.I. DEL BENEFICIARIO", imgs: byPrefix("[CI_BEN]") ? [byPrefix("[CI_BEN]")!] : [] },
    { label: "REGISTRO FOTOGRÁFICO", imgs: registroImgs },
  ];

  const numeroCaso = data.numeroCaso ? `#${data.numeroCaso}` : `GCS-${sequenceId}`;

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* ── ENCABEZADO ── */}
        <View style={S.header}>
          {/* Logo izquierdo */}
          {logoUrl ? (
            <Image src={logoUrl} style={{ width: 150, height: 50, objectFit: "contain" }} />
          ) : (
            <View style={S.headerLogoBox}>
              <Text style={{ fontSize: 6, color: C.gray500, textAlign: "center" }}>LOGO</Text>
            </View>
          )}

          {/* Centro: nombre organización + título */}
          <View style={S.headerCenter}>
            <Text style={S.headerOrgName}>{projectName}</Text>
            <Text style={S.headerTitle}>Ficha Resumen</Text>
          </View>

          {/* Logo derecho (foto perfil ciudadano) */}
          {photoUrl ? (
            <Image src={photoUrl} style={{ width: 60, height: 40, objectFit: "contain" }} />
          ) : (
            <View style={S.headerLogoBox}>
              <Text style={{ fontSize: 6, color: C.gray500, textAlign: "center" }}>SIN{"\n"}FOTO</Text>
            </View>
          )}
        </View>

        {/* ── TABLA DE CAMPOS ── */}
        <View style={S.table}>
          <Row label="Solicitante" value={data.solicitante || data.nombre} />
          <Row label="Beneficiario" value={data.nombreBeneficiario || data.nombre} />
          <Row label="C.I. Beneficiario" value={data.cedulaBeneficiario || data.cedula} />
          <Row label="Solicitud / Beneficio" value={data.resultado} />
          <Row label="Actividad" value={data.jornada} />
          <Row label="Fecha de actividad" value={formatDate(startDate ?? "")} />
          <Row label="Dirección de habitación" value={data.direccion} />
          <Row label="Acción tomada" value={data.accionTomada} />
          <Row
            label="Estado del caso"
            value={data.fechaCierre ? `${stateName} (${formatDate(data.fechaCierre)})` : stateName}
          />
          <Row label="Número de caso" value={numeroCaso} last />
        </View>

        {/* ── TABLA DE 4 FOTOS ── */}
        <View style={S.photoTable}>
          {/* Encabezado de columnas */}
          <View style={S.photoTableHeader}>
            {fotoSlots.map((slot, i) => (
              <View
                key={slot.label}
                style={i < fotoSlots.length - 1 ? S.photoTableHeaderCell : S.photoTableHeaderCellLast}
              >
                <Text style={S.photoTableHeaderText}>{slot.label}</Text>
              </View>
            ))}
          </View>

          {/* Celdas de imagen */}
          <View style={S.photoTableBody}>
            {fotoSlots.map((slot, i) => {
              const cellStyle = i < fotoSlots.length - 1 ? S.photoCell : S.photoCellLast;
              if (slot.imgs.length === 0) {
                return (
                  <View key={slot.label} style={cellStyle}>
                    <Text style={S.photoCellPlaceholderText}>Sin{"\n"}imagen</Text>
                  </View>
                );
              }
              if (slot.imgs.length === 1) {
                return (
                  <View key={slot.label} style={cellStyle}>
                    <Image src={slot.imgs[0].base64 as string} style={S.photoCellImg} />
                  </View>
                );
              }
              // Collage: grilla de 2 columnas, todas del mismo tamaño
              const rows = Math.ceil(slot.imgs.length / 2);
              const imgHeight = Math.floor(160 / rows);
              return (
                <View key={slot.label} style={{ ...cellStyle, flexDirection: "row", flexWrap: "wrap", height: 160 }}>
                  {slot.imgs.map((img) => (
                    <Image
                      key={img.name}
                      src={img.base64 as string}
                      style={{ width: "50%", height: imgHeight, objectFit: "contain" }}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>{projectName} · Ficha Técnica Individual</Text>
          <Text style={S.footerText}>Generado el {generatedAtLabel}</Text>
        </View>
      </Page>
    </Document>
  );
}
