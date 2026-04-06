import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { TIssue } from "@plane/types";
import { extractFromHtml, extractProfilePhotoFromHtml } from "@/components/issues/social-case-form";

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
  tableHeader: { flexDirection: "row", backgroundColor: "#18181b", color: "#fff", paddingVertical: 6, paddingHorizontal: 4, borderRadius: 3 },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #e4e4e7", paddingVertical: 5, paddingHorizontal: 4 },
  tableRowAlt: { flexDirection: "row", borderBottom: "1px solid #e4e4e7", paddingVertical: 5, paddingHorizontal: 4, backgroundColor: "#fafafa" },
  colPhoto: { width: 32 },
  colId: { width: 40 },
  colNombre: { flex: 2 },
  colCedula: { width: 56 },
  colMunicipio: { width: 56 },
  colJornada: { width: 50 },
  colReferencia: { flex: 2 },
  colResultado: { flex: 2 },
  colEstado: { width: 52 },
  cellHeader: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#fff" },
  cell: { fontSize: 7, color: "#27272a" },
  photo: { width: 24, height: 32, borderRadius: 3, objectFit: "cover" },
  photoPlaceholder: { width: 24, height: 32, borderRadius: 3, backgroundColor: "#e4e4e7" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#a1a1aa" },
});

type Props = {
  issues: TIssue[];
  projectName: string;
  dateRange: string;
  stateNames: Record<string, string>;
};

export const SocialCaseReportPDF = ({ issues, projectName, dateRange, stateNames }: Props) => {
  // Stats
  const total = issues.length;
  const byState: Record<string, number> = {};
  const byJornada: Record<string, number> = {};

  for (const issue of issues) {
    const stateName = stateNames[issue.state_id ?? ""] ?? "Sin estado";
    byState[stateName] = (byState[stateName] ?? 0) + 1;
    const d = extractFromHtml(issue.description_html ?? "");
    const jornada = d?.jornada || "Sin jornada";
    byJornada[jornada] = (byJornada[jornada] ?? 0) + 1;
  }

  const conResultado = issues.filter((i) => {
    const d = extractFromHtml(i.description_html ?? "");
    return d?.resultado && d.resultado.trim() !== "";
  }).length;

  return (
    <Document>
      {/* ── PORTADA ── */}
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
          <Text style={styles.footerText}>Generado el {new Date().toLocaleDateString("es-VE")}</Text>
          <Text style={styles.footerText}>{projectName}</Text>
        </View>
      </Page>

      {/* ── TABLA DE CASOS ── */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Listado de casos — {dateRange}</Text>

        {/* Header */}
        <View style={styles.tableHeader}>
          <View style={styles.colPhoto}><Text style={styles.cellHeader}>Foto</Text></View>
          <View style={styles.colId}><Text style={styles.cellHeader}>ID</Text></View>
          <View style={styles.colNombre}><Text style={styles.cellHeader}>Nombre</Text></View>
          <View style={styles.colCedula}><Text style={styles.cellHeader}>Cédula</Text></View>
          <View style={styles.colMunicipio}><Text style={styles.cellHeader}>Municipio</Text></View>
          <View style={styles.colJornada}><Text style={styles.cellHeader}>Jornada</Text></View>
          <View style={styles.colReferencia}><Text style={styles.cellHeader}>Referencia</Text></View>
          <View style={styles.colResultado}><Text style={styles.cellHeader}>Resultado</Text></View>
          <View style={styles.colEstado}><Text style={styles.cellHeader}>Estado</Text></View>
        </View>

        {issues.map((issue, idx) => {
          const d = extractFromHtml(issue.description_html ?? "");
          const photoUrl = extractProfilePhotoFromHtml(issue.description_html ?? "");
          const stateName = stateNames[issue.state_id ?? ""] ?? "-";
          const RowStyle = idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
          return (
            <View key={issue.id} style={RowStyle}>
              <View style={styles.colPhoto}>
                {photoUrl
                  ? <Image src={photoUrl} style={styles.photo} />
                  : <View style={styles.photoPlaceholder} />
                }
              </View>
              <View style={styles.colId}><Text style={styles.cell}>GCS-{issue.sequence_id}</Text></View>
              <View style={styles.colNombre}><Text style={styles.cell}>{d?.nombre || "-"}</Text></View>
              <View style={styles.colCedula}><Text style={styles.cell}>{d?.cedula || "-"}</Text></View>
              <View style={styles.colMunicipio}><Text style={styles.cell}>{d?.municipio || "-"}</Text></View>
              <View style={styles.colJornada}><Text style={styles.cell}>{d?.jornada || "-"}</Text></View>
              <View style={styles.colReferencia}><Text style={styles.cell}>{(d?.referencia || "-").slice(0, 80)}</Text></View>
              <View style={styles.colResultado}><Text style={styles.cell}>{(d?.resultado || "-").slice(0, 80)}</Text></View>
              <View style={styles.colEstado}><Text style={styles.cell}>{stateName}</Text></View>
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generado el {new Date().toLocaleDateString("es-VE")}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
