import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { getFileURL } from "@plane/utils";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  // Cover
  coverPage: { padding: 48, display: "flex", flexDirection: "column", justifyContent: "center" },
  coverTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 6, color: "#111" },
  coverSub: { fontSize: 11, color: "#555", marginBottom: 32 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  statBox: { flex: 1, backgroundColor: "#f4f4f5", borderRadius: 6, padding: 12 },
  statNum: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#18181b" },
  statLabel: { fontSize: 8, color: "#71717a", marginTop: 2 },
  divider: { borderBottom: "1px solid #e4e4e7", marginVertical: 20 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 10, color: "#3f3f46" },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#18181b",
    color: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #e4e4e7", paddingVertical: 5, paddingHorizontal: 4 },
  tableRowAlt: {
    flexDirection: "row",
    borderBottom: "1px solid #e4e4e7",
    paddingVertical: 5,
    paddingHorizontal: 4,
    backgroundColor: "#fafafa",
  },
  colPhoto: { width: 32 },
  colId: { width: 40 },
  colNombre: { flex: 2 },
  colCedula: { width: 56 },
  colMunicipio: { width: 56 },
  colJornada: { width: 50 },
  colReferencia: { flex: 2 },
  colResultado: { flex: 2 },
  colResponsable: { width: 72 },
  colBeneficiado: { width: 48 },
  colEstado: { width: 52 },
  cellHeader: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#fff" },
  cell: { fontSize: 7, color: "#27272a" },
  photo: { width: 24, height: 32, borderRadius: 3, objectFit: "cover" },
  photoPlaceholder: { width: 24, height: 32, borderRadius: 3, backgroundColor: "#e4e4e7" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: "#a1a1aa" },
  // Detail pages
  detailTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#111", marginBottom: 6 },
  detailSub: { fontSize: 9, color: "#52525b", marginBottom: 14 },
  detailGrid: { flexDirection: "row", gap: 16 },
  detailCol: { flex: 1 },
  detailLabel: { fontSize: 8, color: "#71717a", marginBottom: 2 },
  detailValue: { fontSize: 10, color: "#111", marginBottom: 10 },
  progressWrap: { marginTop: 6, padding: 10, borderRadius: 6, backgroundColor: "#f4f4f5" },
  progressTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#18181b", marginBottom: 8 },
  progressRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  stepDot: { width: 8, height: 8, borderRadius: 999 },
  stepLine: { width: 18, height: 2, marginHorizontal: 4 },
  stepLabel: { fontSize: 7, color: "#52525b", marginTop: 4, maxWidth: 72 },
});

// Tipo con datos ya parseados — se calcula una sola vez en el modal
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
};

const Progress = ({ stateFlow, currentStateId }: { stateFlow: StateFlowStep[]; currentStateId: string | null }) => {
  const idx = currentStateId ? stateFlow.findIndex((s) => s.id === currentStateId) : -1;
  const activeIndex = idx >= 0 ? idx : stateFlow.length - 1;

  return (
    <View style={styles.progressWrap}>
      <Text style={styles.progressTitle}>Estado del caso</Text>
      <View style={styles.progressRow}>
        {stateFlow.map((step, i) => {
          const isDone = i < activeIndex;
          const isActive = i === activeIndex && idx >= 0;

          const dotColor = isActive ? "#2563eb" : isDone ? "#16a34a" : "#a1a1aa";
          const lineColor = i < activeIndex ? "#16a34a" : "#d4d4d8";

          return (
            <View key={step.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <View style={{ alignItems: "center" }}>
                <View style={[styles.stepDot, { backgroundColor: dotColor }]} />
                <Text style={styles.stepLabel}>{step.name}</Text>
              </View>
              {i < stateFlow.length - 1 && <View style={[styles.stepLine, { backgroundColor: lineColor }]} />}
            </View>
          );
        })}
      </View>
    </View>
  );
};

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
}: Props) => {
  const total = rows.length;

  return (
    <Document>
      {/* ── PORTADA ── */}
      {includeCover && (
        <Page size="A4" style={[styles.page, styles.coverPage]}>
          <Text style={styles.coverTitle}>{projectName}</Text>
          <Text style={styles.coverSub}>Reporte de Casos Sociales — {dateRange}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{total}</Text>
              <Text style={styles.statLabel}>Total de fichas</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{conResultado}</Text>
              <Text style={styles.statLabel}>Con resultado registrado</Text>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Por estado</Text>
          {Object.entries(byState).map(([name, count]) => (
            <View key={name} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ fontSize: 9, color: "#52525b" }}>{name}</Text>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{count}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Por jornada</Text>
          {Object.entries(byJornada).map(([name, count]) => (
            <View key={name} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ fontSize: 9, color: "#52525b" }}>{name}</Text>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{count}</Text>
            </View>
          ))}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Generado el {generatedAtLabel}</Text>
            <Text style={styles.footerText}>{projectName}</Text>
          </View>
        </Page>
      )}

      {/* ── TABLA DE CASOS ── */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text fixed style={[styles.sectionTitle, { marginBottom: 6 }]}>
          Listado de casos — {dateRange}
        </Text>

        <View fixed style={styles.tableHeader}>
          <View style={styles.colPhoto}>
            <Text style={styles.cellHeader}>Foto</Text>
          </View>
          <View style={styles.colId}>
            <Text style={styles.cellHeader}>ID</Text>
          </View>
          <View style={styles.colNombre}>
            <Text style={styles.cellHeader}>Nombre</Text>
          </View>
          <View style={styles.colCedula}>
            <Text style={styles.cellHeader}>Cédula</Text>
          </View>
          <View style={styles.colMunicipio}>
            <Text style={styles.cellHeader}>Municipio</Text>
          </View>
          <View style={styles.colJornada}>
            <Text style={styles.cellHeader}>Jornada</Text>
          </View>
          <View style={styles.colResponsable}>
            <Text style={styles.cellHeader}>Responsable</Text>
          </View>
          <View style={styles.colBeneficiado}>
            <Text style={styles.cellHeader}>Benef.</Text>
          </View>
          <View style={styles.colReferencia}>
            <Text style={styles.cellHeader}>Referencia</Text>
          </View>
          <View style={styles.colResultado}>
            <Text style={styles.cellHeader}>Acción</Text>
          </View>
          <View style={styles.colResultado}>
            <Text style={styles.cellHeader}>Resultado</Text>
          </View>
          <View style={styles.colEstado}>
            <Text style={styles.cellHeader}>Estado</Text>
          </View>
        </View>

        {rows.map((row, idx) => {
          const RowStyle = idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
          const resolvedPhoto = includePhotos && row.photoUrl ? (getFileURL(row.photoUrl) ?? row.photoUrl) : null;
          return (
            <View key={row.id} style={RowStyle} wrap={false}>
              <View style={styles.colPhoto}>
                {resolvedPhoto ? (
                  <Image src={resolvedPhoto} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder} />
                )}
              </View>
              <View style={styles.colId}>
                <Text style={styles.cell}>GCS-{row.sequenceId}</Text>
              </View>
              <View style={styles.colNombre}>
                <Text style={styles.cell}>{row.nombre}</Text>
              </View>
              <View style={styles.colCedula}>
                <Text style={styles.cell}>{row.cedula}</Text>
              </View>
              <View style={styles.colMunicipio}>
                <Text style={styles.cell}>{row.municipio}</Text>
              </View>
              <View style={styles.colJornada}>
                <Text style={styles.cell}>{row.jornada}</Text>
              </View>
              <View style={styles.colResponsable}>
                <Text style={styles.cell}>{row.responsable}</Text>
              </View>
              <View style={styles.colBeneficiado}>
                <Text style={styles.cell}>{row.beneficiado ? "Sí" : "No"}</Text>
              </View>
              <View style={styles.colReferencia}>
                <Text style={styles.cell}>{row.referencia.slice(0, 80)}</Text>
              </View>
              <View style={styles.colResultado}>
                <Text style={styles.cell}>{row.accionTomada.slice(0, 80)}</Text>
              </View>
              <View style={styles.colResultado}>
                <Text style={styles.cell}>{row.resultado.slice(0, 80)}</Text>
              </View>
              <View style={styles.colEstado}>
                <Text style={styles.cell}>{row.stateName}</Text>
              </View>
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generado el {generatedAtLabel}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>

      {/* ── DETALLE POR CASO (OPCIONAL) ── */}
      {includeDetails &&
        rows.map((row) => {
          const resolvedPhoto = includePhotos && row.photoUrl ? (getFileURL(row.photoUrl) ?? row.photoUrl) : null;
          return (
            <Page key={`detail-${row.id}`} size="A4" style={styles.page}>
              <Text style={styles.detailTitle}>Caso GCS-{row.sequenceId}</Text>
              <Text style={styles.detailSub}>
                {projectName} · {dateRange}
              </Text>

              <View style={styles.detailGrid}>
                <View style={{ width: 86 }}>
                  {resolvedPhoto ? (
                    <Image src={resolvedPhoto} style={{ width: 72, height: 96, borderRadius: 6, objectFit: "cover" }} />
                  ) : (
                    <View style={{ width: 72, height: 96, borderRadius: 6, backgroundColor: "#e4e4e7" }} />
                  )}
                </View>

                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Nombre</Text>
                  <Text style={styles.detailValue}>{row.nombre}</Text>

                  <Text style={styles.detailLabel}>Cédula</Text>
                  <Text style={styles.detailValue}>{row.cedula}</Text>

                  <Text style={styles.detailLabel}>Municipio</Text>
                  <Text style={styles.detailValue}>{row.municipio}</Text>

                  <Text style={styles.detailLabel}>Jornada</Text>
                  <Text style={styles.detailValue}>{row.jornada}</Text>
                </View>

                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Responsable</Text>
                  <Text style={styles.detailValue}>{row.responsable}</Text>

                  <Text style={styles.detailLabel}>Estado actual</Text>
                  <Text style={styles.detailValue}>{row.stateName}</Text>

                  <Text style={styles.detailLabel}>Beneficiado</Text>
                  <Text style={styles.detailValue}>{row.beneficiado ? "Sí" : "No"}</Text>
                </View>
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={styles.detailLabel}>Referencia</Text>
                <Text style={{ fontSize: 10, color: "#111", marginBottom: 10 }}>{row.referencia}</Text>

                <Text style={styles.detailLabel}>Acción tomada</Text>
                <Text style={{ fontSize: 10, color: "#111", marginBottom: 10 }}>{row.accionTomada}</Text>

                <Text style={styles.detailLabel}>Resultado</Text>
                <Text style={{ fontSize: 10, color: "#111" }}>{row.resultado}</Text>
              </View>

              {stateFlow.length > 0 && <Progress stateFlow={stateFlow} currentStateId={row.stateId} />}

              <View style={styles.footer} fixed>
                <Text style={styles.footerText}>Generado el {generatedAtLabel}</Text>
                <Text
                  style={styles.footerText}
                  render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
                />
              </View>
            </Page>
          );
        })}
    </Document>
  );
};
