import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

// ── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  black: "#09090b",
  gray900: "#18181b",
  gray700: "#3f3f46",
  gray500: "#71717a",
  gray300: "#d4d4d8",
  gray100: "#f4f4f5",
  gray50: "#fafafa",
  white: "#ffffff",
  blue: "#2563eb",
  green: "#16a34a",
  border: "#e4e4e7",
};

// ── Estilos ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Página
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: C.black, backgroundColor: C.white },

  // ── PORTADA ──
  coverPage: { padding: 48, flexDirection: "column", justifyContent: "flex-start" },
  logo: { width: 32, height: 32, marginBottom: 24 },
  coverTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: C.black,
    marginBottom: 4,
    textAlign: "center",
    hyphens: "none",
  },
  coverSub: { fontSize: 11, color: C.gray500, marginBottom: 28, textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statBox: {
    flex: 1,
    backgroundColor: C.gray100,
    borderRadius: 6,
    padding: 14,
    borderLeft: `3px solid ${C.blue}`,
  },
  statNum: { fontSize: 26, fontFamily: "Helvetica-Bold", color: C.gray900, marginBottom: 2 },
  statLabel: { fontSize: 8, color: C.gray500 },

  // Tabla resumen portada
  summaryGrid: { flexDirection: "row", gap: 20, marginTop: 4 },
  summaryCol: { flex: 1 },
  summaryTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.gray700,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: `1px solid ${C.border}`,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottom: `1px solid ${C.gray100}`,
  },
  summaryKey: { fontSize: 9, color: C.gray700, flex: 1 },
  summaryVal: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.gray900 },

  divider: { borderBottom: `1px solid ${C.border}`, marginVertical: 16 },

  // ── TABLA PRINCIPAL ──
  tableTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.gray900, marginBottom: 2 },
  tableSub: { fontSize: 8, color: C.gray500, marginBottom: 10 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.gray900,
    paddingVertical: 7,
    paddingHorizontal: 5,
    borderRadius: 3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `1px solid ${C.border}`,
    paddingVertical: 6,
    paddingHorizontal: 5,
    backgroundColor: C.white,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottom: `1px solid ${C.border}`,
    paddingVertical: 6,
    paddingHorizontal: 5,
    backgroundColor: C.gray50,
  },
  cellHeader: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.white },
  cell: { fontSize: 7, color: C.gray700 },
  cellBold: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.gray900 },

  // Anchos de columna (sin foto — se reserva para detalle)
  cId: { width: 38 },
  cNombre: { flex: 2 },
  cCedula: { width: 58 },
  cMunicipio: { width: 62 },
  cJornada: { width: 58 },
  cResponsable: { width: 80 },
  cBenef: { width: 36 },
  cReferencia: { flex: 2 },
  cAccion: { flex: 2 },
  cResultado: { flex: 2 },
  cEstado: { width: 60 },

  // Pill de estado
  pill: { borderRadius: 10, paddingVertical: 2, paddingHorizontal: 5, alignSelf: "flex-start" },
  pillText: { fontSize: 6, fontFamily: "Helvetica-Bold" },

  // ── DETALLE ──
  // Banda superior fija con el nombre del proyecto
  detailPageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: `2px solid ${C.blue}`,
  },
  detailPageProject: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.gray900 },
  detailPageTag: { fontSize: 8, color: C.gray500 },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14, gap: 14 },
  detailPhoto: { width: 80, height: 106, borderRadius: 6, objectFit: "cover" },
  detailPhotoPlaceholder: {
    width: 80,
    height: 106,
    borderRadius: 6,
    backgroundColor: C.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  detailPhotoText: { fontSize: 7, color: C.gray500 },
  detailMeta: { flex: 1 },
  detailName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.gray900, marginBottom: 2 },
  detailId: { fontSize: 8, color: C.blue, marginBottom: 10 },
  metaGrid: { flexDirection: "row", gap: 14 },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 7, color: C.gray500, marginBottom: 1 },
  metaValue: { fontSize: 9, color: C.gray900, marginBottom: 8 },

  // Sección de texto en detalle
  detailSection: { marginTop: 10 },
  detailSectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.gray700,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottom: `1px solid ${C.border}`,
  },
  detailText: { fontSize: 9, color: C.gray700, lineHeight: 1.5 },

  // Timeline de estado (vertical)
  timelineWrap: { marginTop: 12, padding: 12, backgroundColor: C.gray100, borderRadius: 6 },
  timelineTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.gray700, marginBottom: 10 },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 0 },
  timelineDotCol: { width: 18, alignItems: "center" },
  timelineDot: { width: 9, height: 9, borderRadius: 999 },
  timelineLine: { width: 1, flex: 1, minHeight: 14 },
  timelineLabel: { flex: 1, paddingLeft: 6, paddingBottom: 10, paddingTop: 0 },
  timelineLabelText: { fontSize: 8, color: C.gray700 },
  timelineLabelActive: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.blue },

  // Adjuntos
  attachPageTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.gray900, marginBottom: 2 },
  attachPageSub: { fontSize: 8, color: C.gray500, marginBottom: 8 },
  attachFileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 4,
    backgroundColor: C.gray100,
    borderRadius: 4,
  },
  attachFileName: { fontSize: 9, color: C.gray700, flex: 1 },
  attachFileNote: { fontSize: 8, color: C.gray500 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `1px solid ${C.border}`,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: C.gray500 },
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type AttachmentInfo = {
  name: string;
  isImage: boolean;
  base64?: string;
};

export type ParsedIssueRow = {
  id: string;
  sequenceId: number;
  stateId: string | null;
  stateName: string;
  photoUrl: string | null;
  responsable: string;
  nombre: string;
  cedula: string;
  municipio: string;
  jornada: string;
  referencia: string;
  accionTomada: string;
  resultado: string;
  beneficiado: boolean;
  attachments?: AttachmentInfo[];
};

export type StateFlowStep = { id: string; name: string };

type Props = {
  rows: ParsedIssueRow[];
  projectName: string;
  dateRange: string;
  byState: Record<string, number>;
  byJornada: Record<string, number>;
  conResultado: number;
  generatedAtLabel: string;
  stateFlow: StateFlowStep[];
  includeCover?: boolean;
  includePhotos?: boolean;
  includeDetails?: boolean;
  includeAttachments?: boolean;
  logoUrl?: string | null;
};

// ── Timeline vertical de estados ─────────────────────────────────────────────

const Timeline = ({ stateFlow, currentStateId }: { stateFlow: StateFlowStep[]; currentStateId: string | null }) => {
  const activeIdx = currentStateId ? stateFlow.findIndex((s) => s.id === currentStateId) : -1;

  return (
    <View style={S.timelineWrap}>
      <Text style={S.timelineTitle}>FLUJO DEL CASO</Text>
      {stateFlow.map((step, i) => {
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;
        const isLast = i === stateFlow.length - 1;
        const dotColor = isActive ? C.blue : isDone ? C.green : C.gray300;
        const lineColor = isDone ? C.green : C.gray300;

        return (
          <View key={step.id} style={S.timelineRow}>
            <View style={S.timelineDotCol}>
              <View style={[S.timelineDot, { backgroundColor: dotColor }]} />
              {!isLast && <View style={[S.timelineLine, { backgroundColor: lineColor }]} />}
            </View>
            <View style={S.timelineLabel}>
              <Text style={isActive ? S.timelineLabelActive : S.timelineLabelText}>
                {step.name}
                {isActive ? "  ◀ actual" : ""}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ── Footer ────────────────────────────────────────────────────────────────────

const Footer = ({ projectName, generatedAtLabel }: { projectName: string; generatedAtLabel: string }) => (
  <View style={S.footer} fixed>
    <Text style={S.footerText}>
      {projectName} · Generado el {generatedAtLabel}
    </Text>
    <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
  </View>
);

// ── Componente principal ──────────────────────────────────────────────────────

export const SocialCaseReportPDF = ({
  rows,
  projectName,
  dateRange,
  byState,
  byJornada,
  conResultado,
  generatedAtLabel,
  stateFlow,
  includeCover = true,
  includePhotos = true,
  includeDetails = false,
  includeAttachments = false,
  logoUrl,
}: Props) => {
  const total = rows.length;
  const beneficiados = rows.filter((r) => r.beneficiado).length;
  const pctBenef = total > 0 ? Math.round((beneficiados / total) * 100) : 0;

  return (
    <Document>
      {/* ══ PORTADA ══════════════════════════════════════════════════════════ */}
      {includeCover && (
        <Page size="A4" style={[S.page, S.coverPage]}>
          {logoUrl && (
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Image src={logoUrl} style={{ width: 180, height: 60, objectFit: "contain" }} />
            </View>
          )}
          <Text style={S.coverTitle}>{projectName}</Text>
          <Text style={S.coverSub}>Reporte de Casos Sociales · {dateRange}</Text>

          {/* Stats */}
          <View style={S.statsRow}>
            <View style={S.statBox}>
              <Text style={S.statNum}>{total}</Text>
              <Text style={S.statLabel}>Total de fichas</Text>
            </View>
            <View style={[S.statBox, { borderLeftColor: C.green }]}>
              <Text style={S.statNum}>{conResultado}</Text>
              <Text style={S.statLabel}>Con resultado registrado</Text>
            </View>
            <View style={[S.statBox, { borderLeftColor: "#7c3aed" }]}>
              <Text style={S.statNum}>{pctBenef}%</Text>
              <Text style={S.statLabel}>Tasa de beneficiados</Text>
            </View>
          </View>

          <View style={S.divider} />

          {/* Resumen por estado y jornada */}
          <View style={S.summaryGrid}>
            <View style={S.summaryCol}>
              <Text style={S.summaryTitle}>Por estado</Text>
              {Object.entries(byState).map(([name, count]) => (
                <View key={name} style={S.summaryRow}>
                  <Text style={S.summaryKey}>{name}</Text>
                  <Text style={S.summaryVal}>{count}</Text>
                </View>
              ))}
            </View>
            <View style={S.summaryCol}>
              <Text style={S.summaryTitle}>Por jornada</Text>
              {Object.entries(byJornada).map(([name, count]) => (
                <View key={name} style={S.summaryRow}>
                  <Text style={S.summaryKey}>{name}</Text>
                  <Text style={S.summaryVal}>{count}</Text>
                </View>
              ))}
            </View>
          </View>

          <Footer projectName={projectName} generatedAtLabel={generatedAtLabel} />
        </Page>
      )}

      {/* ══ TABLA DE CASOS ═══════════════════════════════════════════════════ */}
      <Page size="A4" orientation="landscape" style={S.page}>
        <Text fixed style={S.tableTitle}>
          {projectName} — Listado de Casos Sociales
        </Text>
        <Text fixed style={S.tableSub}>
          {dateRange} · {total} registros
        </Text>

        {/* Cabecera */}
        <View fixed style={S.tableHeader}>
          <View style={S.cId}>
            <Text style={S.cellHeader}>ID</Text>
          </View>
          <View style={S.cNombre}>
            <Text style={S.cellHeader}>Nombre completo</Text>
          </View>
          <View style={S.cCedula}>
            <Text style={S.cellHeader}>Cédula</Text>
          </View>
          <View style={S.cMunicipio}>
            <Text style={S.cellHeader}>Municipio</Text>
          </View>
          <View style={S.cJornada}>
            <Text style={S.cellHeader}>Jornada</Text>
          </View>
          <View style={S.cResponsable}>
            <Text style={S.cellHeader}>Responsable</Text>
          </View>
          <View style={S.cBenef}>
            <Text style={S.cellHeader}>Benef.</Text>
          </View>
          <View style={S.cReferencia}>
            <Text style={S.cellHeader}>Referencia</Text>
          </View>
          <View style={S.cAccion}>
            <Text style={S.cellHeader}>Acción tomada</Text>
          </View>
          <View style={S.cResultado}>
            <Text style={S.cellHeader}>Resultado</Text>
          </View>
          <View style={S.cEstado}>
            <Text style={S.cellHeader}>Estado</Text>
          </View>
        </View>

        {/* Filas */}
        {rows.map((row, idx) => (
          <View key={row.id} style={idx % 2 === 0 ? S.tableRow : S.tableRowAlt} wrap={false}>
            <View style={S.cId}>
              <Text style={S.cellBold}>GCS-{row.sequenceId}</Text>
            </View>
            <View style={S.cNombre}>
              <Text style={S.cell}>{row.nombre}</Text>
            </View>
            <View style={S.cCedula}>
              <Text style={S.cell}>{row.cedula}</Text>
            </View>
            <View style={S.cMunicipio}>
              <Text style={S.cell}>{row.municipio}</Text>
            </View>
            <View style={S.cJornada}>
              <Text style={S.cell}>{row.jornada}</Text>
            </View>
            <View style={S.cResponsable}>
              <Text style={S.cell}>{row.responsable}</Text>
            </View>
            <View style={S.cBenef}>
              <Text style={[S.cell, { color: row.beneficiado ? C.green : C.gray500 }]}>
                {row.beneficiado ? "Sí" : "No"}
              </Text>
            </View>
            <View style={S.cReferencia}>
              <Text style={S.cell}>{row.referencia.slice(0, 100)}</Text>
            </View>
            <View style={S.cAccion}>
              <Text style={S.cell}>{row.accionTomada.slice(0, 100)}</Text>
            </View>
            <View style={S.cResultado}>
              <Text style={S.cell}>{row.resultado.slice(0, 100)}</Text>
            </View>
            <View style={S.cEstado}>
              <Text style={S.cell}>{row.stateName}</Text>
            </View>
          </View>
        ))}

        <Footer projectName={projectName} generatedAtLabel={generatedAtLabel} />
      </Page>

      {/* ══ DETALLE POR CASO ═════════════════════════════════════════════════ */}
      {includeDetails &&
        rows.map((row) => {
          const resolvedPhoto = includePhotos && row.photoUrl ? row.photoUrl : null;
          const rowAttachments = includeAttachments ? (row.attachments ?? []) : [];

          return (
            <React.Fragment key={`case-${row.id}`}>
              <Page size="A4" style={S.page}>
                <View style={S.detailPageHeader} fixed>
                  <Text style={S.detailPageProject}>{projectName}</Text>
                  <Text style={S.detailPageTag}>Reporte de Casos Sociales · {dateRange}</Text>
                </View>

                <View style={S.detailHeader}>
                  {resolvedPhoto ? (
                    <Image src={resolvedPhoto} style={S.detailPhoto} />
                  ) : (
                    <View style={S.detailPhotoPlaceholder}>
                      <Text style={S.detailPhotoText}>Sin foto</Text>
                    </View>
                  )}
                  <View style={S.detailMeta}>
                    <Text style={S.detailName}>{row.nombre}</Text>
                    <Text style={S.detailId}>GCS-{row.sequenceId}</Text>
                    <View style={S.metaGrid}>
                      <View style={S.metaCol}>
                        <Text style={S.metaLabel}>Cédula</Text>
                        <Text style={S.metaValue}>{row.cedula}</Text>
                        <Text style={S.metaLabel}>Municipio</Text>
                        <Text style={S.metaValue}>{row.municipio}</Text>
                      </View>
                      <View style={S.metaCol}>
                        <Text style={S.metaLabel}>Jornada</Text>
                        <Text style={S.metaValue}>{row.jornada}</Text>
                        <Text style={S.metaLabel}>Responsable</Text>
                        <Text style={S.metaValue}>{row.responsable}</Text>
                      </View>
                      <View style={S.metaCol}>
                        <Text style={S.metaLabel}>Estado actual</Text>
                        <Text style={S.metaValue}>{row.stateName}</Text>
                        <Text style={S.metaLabel}>Beneficiado</Text>
                        <Text style={[S.metaValue, { color: row.beneficiado ? C.green : C.gray700 }]}>
                          {row.beneficiado ? "Sí" : "No"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={S.divider} />

                <View style={S.detailSection}>
                  <Text style={S.detailSectionTitle}>MOTIVO / REFERENCIA</Text>
                  <Text style={S.detailText}>{row.referencia || "—"}</Text>
                </View>
                <View style={S.detailSection}>
                  <Text style={S.detailSectionTitle}>ACCIÓN TOMADA</Text>
                  <Text style={S.detailText}>{row.accionTomada || "—"}</Text>
                </View>
                <View style={S.detailSection}>
                  <Text style={S.detailSectionTitle}>RESULTADO</Text>
                  <Text style={S.detailText}>{row.resultado || "—"}</Text>
                </View>

                {stateFlow.length > 0 && <Timeline stateFlow={stateFlow} currentStateId={row.stateId} />}

                <Footer projectName={projectName} generatedAtLabel={generatedAtLabel} />
              </Page>

              {/* ── PÁGINAS DE ADJUNTOS ── */}
              {rowAttachments.map((att, attIdx) => (
                <Page key={`att-${row.id}-${att.name}`} size="A4" style={S.page}>
                  {/* Cabecera compacta — sin "fixed" para no romper el flex */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ fontSize: 8, color: C.gray500 }}>
                      GCS-{row.sequenceId} · {row.nombre}
                    </Text>
                    <Text style={{ fontSize: 8, color: C.gray500 }}>
                      Adjunto {attIdx + 1} / {rowAttachments.length}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 7, color: C.gray300, marginBottom: 8 }}>{att.name}</Text>

                  {att.isImage && att.base64 ? (
                    <View style={{ alignItems: "center", marginTop: 8, marginBottom: 36 }}>
                      <Image src={att.base64} style={{ width: 400, height: 520, objectFit: "contain" }} />
                    </View>
                  ) : att.isImage && !att.base64 ? (
                    <View style={[S.attachFileRow, { backgroundColor: "#fee2e2" }]}>
                      <Text style={[S.attachFileName, { color: "#ef4444" }]}>
                        {att.name} — imagen detectada pero no se pudo convertir a base64
                      </Text>
                    </View>
                  ) : (
                    <View style={S.attachFileRow}>
                      <Text style={S.attachFileName}>{att.name}</Text>
                      <Text style={S.attachFileNote}>Ver archivo adjunto por separado</Text>
                    </View>
                  )}

                  <Footer projectName={projectName} generatedAtLabel={generatedAtLabel} />
                </Page>
              ))}
            </React.Fragment>
          );
        })}
    </Document>
  );
};
