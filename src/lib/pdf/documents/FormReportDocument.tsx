import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { colors, formatDate } from "./shared-styles";
import type { FieldProps, PhotoValue, SignatureValue, GpsValue } from "@/lib/forms/types";

// --- Data interface ---

export interface FormReportFieldSection {
  blockId: string;
  type: string;
  title: string;
  props: FieldProps;
}

export interface FormReportData {
  orgName: string;
  orgLogoUrl?: string;
  reportTitle: string;
  subtitle?: string;
  customerName?: string;
  siteName?: string;
  assetName?: string;
  assetSerial?: string;
  workOrderNumber?: string;
  techName: string;
  submittedAt: string;
  coverPageEnabled: boolean;
  sections: FormReportFieldSection[];
  data: Record<string, unknown>;
}

// --- Styles ---

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 50,
    paddingBottom: 70,
    color: colors.text,
  },
  // Cover page
  coverPage: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 50,
    paddingBottom: 70,
    color: colors.text,
    justifyContent: "center",
    alignItems: "center",
  },
  coverLogo: {
    width: 120,
    height: 60,
    objectFit: "contain",
    marginBottom: 24,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    textAlign: "center",
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 32,
  },
  coverInfoBlock: {
    marginTop: 16,
    alignItems: "center",
  },
  coverInfoLabel: {
    fontSize: 9,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  coverInfoValue: {
    fontSize: 12,
    color: colors.text,
    marginBottom: 10,
  },
  coverFooter: {
    position: "absolute",
    bottom: 40,
    left: 50,
    right: 50,
    alignItems: "center",
  },
  coverFooterText: {
    fontSize: 9,
    color: colors.light,
  },

  // Data pages
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  headerSub: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginTop: 16,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  fieldRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldRowAlt: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  fieldLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    width: "35%",
  },
  fieldValue: {
    fontSize: 10,
    color: colors.text,
    width: "65%",
  },
  // Textarea-style (label on top)
  textareaContainer: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  textareaLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    marginBottom: 4,
  },
  textareaValue: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.4,
  },
  // Spec range
  specRange: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 1,
  },
  inSpec: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.success,
  },
  outOfSpec: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.danger,
  },
  // Photo section
  photoContainer: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  photoLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    marginBottom: 6,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoItem: {
    width: 140,
    marginBottom: 8,
  },
  photoImage: {
    width: 140,
    height: 105,
    objectFit: "cover",
    borderRadius: 2,
  },
  photoCaption: {
    fontSize: 7,
    color: colors.muted,
    marginTop: 2,
  },
  // Signature
  signatureContainer: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  signatureImage: {
    width: 200,
    height: 80,
    objectFit: "contain",
    marginVertical: 4,
  },
  signatureMeta: {
    fontSize: 8,
    color: colors.muted,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: colors.light,
  },
});

// --- Helper renderers ---

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function isPhotoArray(val: unknown): val is PhotoValue {
  return (
    Array.isArray(val) &&
    val.length > 0 &&
    typeof val[0] === "object" &&
    val[0] !== null &&
    "url" in val[0]
  );
}

function isSignature(val: unknown): val is SignatureValue {
  return (
    typeof val === "object" &&
    val !== null &&
    "url" in val &&
    "signedBy" in val
  );
}

function isGps(val: unknown): val is GpsValue {
  return (
    typeof val === "object" &&
    val !== null &&
    "lat" in val &&
    "lng" in val
  );
}

// Check if a numeric value is within spec range
function checkInSpec(
  value: number,
  minValue?: number,
  maxValue?: number
): boolean | null {
  if (minValue === undefined && maxValue === undefined) return null;
  if (minValue !== undefined && value < minValue) return false;
  if (maxValue !== undefined && value > maxValue) return false;
  return true;
}

// --- Field renderers ---

function FieldRow({
  label,
  children,
  index,
}: {
  label: string;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <View style={index % 2 === 0 ? s.fieldRow : s.fieldRowAlt}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldValue}>{children}</View>
    </View>
  );
}

function renderField(
  field: FormReportFieldSection,
  data: Record<string, unknown>,
  rowIndex: number
): React.ReactNode {
  const val = data[field.blockId];

  switch (field.type) {
    case "SECTION_HEADER":
      return (
        <Text key={field.blockId} style={s.sectionHeader}>
          {field.title}
        </Text>
      );

    case "INSTRUCTIONS":
      // Skip in PDF output
      return null;

    case "TEXT_INPUT":
    case "DROPDOWN":
      return (
        <FieldRow key={field.blockId} label={field.title} index={rowIndex}>
          <Text>{renderValue(val)}</Text>
        </FieldRow>
      );

    case "TEXTAREA":
      return (
        <View
          key={field.blockId}
          style={[
            s.textareaContainer,
            rowIndex % 2 === 1 ? { backgroundColor: colors.background } : {},
          ]}
        >
          <Text style={s.textareaLabel}>{field.title}</Text>
          <Text style={s.textareaValue}>{renderValue(val)}</Text>
        </View>
      );

    case "NUMERIC_INPUT": {
      const numVal = typeof val === "number" ? val : null;
      const unit = field.props.unit || "";
      const specResult =
        numVal !== null
          ? checkInSpec(numVal, field.props.minValue, field.props.maxValue)
          : null;
      const specRangeText =
        field.props.minValue !== undefined || field.props.maxValue !== undefined
          ? `Spec: ${field.props.minValue ?? "-"} – ${field.props.maxValue ?? "-"} ${unit}`.trim()
          : null;
      return (
        <FieldRow key={field.blockId} label={field.title} index={rowIndex}>
          <Text>
            {numVal !== null ? `${numVal} ${unit}`.trim() : "-"}
          </Text>
          {specRangeText && (
            <Text style={s.specRange}>{specRangeText}</Text>
          )}
          {specResult !== null && (
            <Text style={specResult ? s.inSpec : s.outOfSpec}>
              {specResult ? "IN SPEC" : "OUT OF SPEC"}
            </Text>
          )}
        </FieldRow>
      );
    }

    case "YES_NO": {
      const boolVal = typeof val === "boolean" ? val : null;
      return (
        <FieldRow key={field.blockId} label={field.title} index={rowIndex}>
          {boolVal !== null ? (
            <Text
              style={{
                fontFamily: "Helvetica-Bold",
                color: boolVal ? colors.success : colors.danger,
              }}
            >
              {boolVal ? "\u2713 YES" : "\u2717 NO"}
            </Text>
          ) : (
            <Text>-</Text>
          )}
        </FieldRow>
      );
    }

    case "MULTI_SELECT": {
      const arrVal = Array.isArray(val) ? (val as string[]) : null;
      return (
        <FieldRow key={field.blockId} label={field.title} index={rowIndex}>
          <Text>{arrVal && arrVal.length > 0 ? arrVal.join(", ") : "-"}</Text>
        </FieldRow>
      );
    }

    case "DATE_INPUT":
      return (
        <FieldRow key={field.blockId} label={field.title} index={rowIndex}>
          <Text>
            {typeof val === "string" && val ? formatDate(val) : "-"}
          </Text>
        </FieldRow>
      );

    case "CALCULATED": {
      const calcVal = typeof val === "number" ? val : null;
      const calcUnit = field.props.unit || "";
      return (
        <FieldRow key={field.blockId} label={field.title} index={rowIndex}>
          <Text>
            {calcVal !== null ? `${calcVal} ${calcUnit}`.trim() : "-"}
            {"  "}
          </Text>
          <Text style={{ fontSize: 8, color: colors.muted, fontStyle: "italic" }}>
            (calculated)
          </Text>
        </FieldRow>
      );
    }

    case "PHOTO_CAPTURE": {
      if (!isPhotoArray(val)) {
        return (
          <FieldRow key={field.blockId} label={field.title} index={rowIndex}>
            <Text>No photos</Text>
          </FieldRow>
        );
      }
      return (
        <View
          key={field.blockId}
          style={[
            s.photoContainer,
            rowIndex % 2 === 1 ? { backgroundColor: colors.background } : {},
          ]}
        >
          <Text style={s.photoLabel}>{field.title}</Text>
          <View style={s.photoGrid}>
            {val.map((photo, i) => (
              <View key={`${field.blockId}-photo-${i}`} style={s.photoItem}>
                <Image src={photo.url} style={s.photoImage} />
                {photo.caption && (
                  <Text style={s.photoCaption}>{photo.caption}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      );
    }

    case "SIGNATURE": {
      if (!isSignature(val)) {
        return (
          <FieldRow key={field.blockId} label={field.title} index={rowIndex}>
            <Text>No signature</Text>
          </FieldRow>
        );
      }
      return (
        <View
          key={field.blockId}
          style={[
            s.signatureContainer,
            rowIndex % 2 === 1 ? { backgroundColor: colors.background } : {},
          ]}
        >
          <Text style={s.photoLabel}>{field.title}</Text>
          <Image src={val.url} style={s.signatureImage} />
          <Text style={s.signatureMeta}>
            Signed by {val.signedBy} on {formatDate(val.signedAt)}
          </Text>
        </View>
      );
    }

    case "GPS_CAPTURE": {
      if (!isGps(val)) {
        return (
          <FieldRow key={field.blockId} label={field.title} index={rowIndex}>
            <Text>No location</Text>
          </FieldRow>
        );
      }
      return (
        <FieldRow key={field.blockId} label={field.title} index={rowIndex}>
          <Text>
            {val.lat.toFixed(6)}, {val.lng.toFixed(6)}
          </Text>
          {val.accuracy !== undefined && (
            <Text style={{ fontSize: 8, color: colors.muted }}>
              Accuracy: {val.accuracy.toFixed(0)}m
            </Text>
          )}
        </FieldRow>
      );
    }

    default:
      return (
        <FieldRow key={field.blockId} label={field.title} index={rowIndex}>
          <Text>{renderValue(val)}</Text>
        </FieldRow>
      );
  }
}

// --- Main document component ---

export function FormReportDocument({ data }: { data: FormReportData }) {
  // Track row index for alternating backgrounds (reset on each section header)
  let rowIndex = 0;

  return (
    <Document>
      {/* Optional cover page */}
      {data.coverPageEnabled && (
        <Page size="LETTER" style={s.coverPage}>
          {data.orgLogoUrl && (
            <Image src={data.orgLogoUrl} style={s.coverLogo} />
          )}
          <Text style={s.coverTitle}>{data.reportTitle}</Text>
          {data.subtitle && (
            <Text style={s.coverSubtitle}>{data.subtitle}</Text>
          )}

          <View style={s.coverInfoBlock}>
            {data.customerName && (
              <>
                <Text style={s.coverInfoLabel}>Customer</Text>
                <Text style={s.coverInfoValue}>{data.customerName}</Text>
              </>
            )}
            {data.siteName && (
              <>
                <Text style={s.coverInfoLabel}>Site</Text>
                <Text style={s.coverInfoValue}>{data.siteName}</Text>
              </>
            )}
            {data.assetName && (
              <>
                <Text style={s.coverInfoLabel}>Asset</Text>
                <Text style={s.coverInfoValue}>
                  {data.assetName}
                  {data.assetSerial ? ` (S/N: ${data.assetSerial})` : ""}
                </Text>
              </>
            )}
            {data.workOrderNumber && (
              <>
                <Text style={s.coverInfoLabel}>Work Order</Text>
                <Text style={s.coverInfoValue}>{data.workOrderNumber}</Text>
              </>
            )}
            <Text style={s.coverInfoLabel}>Technician</Text>
            <Text style={s.coverInfoValue}>{data.techName}</Text>
            <Text style={s.coverInfoLabel}>Date</Text>
            <Text style={s.coverInfoValue}>{formatDate(data.submittedAt)}</Text>
          </View>

          <View style={s.coverFooter}>
            <Text style={s.coverFooterText}>{data.orgName}</Text>
          </View>
        </Page>
      )}

      {/* Data pages */}
      <Page size="LETTER" style={s.page} wrap>
        {/* Page header */}
        <View style={s.header} fixed>
          <View>
            <Text style={s.headerTitle}>{data.reportTitle}</Text>
            <Text style={s.headerSub}>
              {data.techName} | {formatDate(data.submittedAt)}
            </Text>
          </View>
          {data.workOrderNumber && (
            <View>
              <Text style={{ fontSize: 10, color: colors.muted, textAlign: "right" }}>
                {data.workOrderNumber}
              </Text>
            </View>
          )}
        </View>

        {/* Render all fields */}
        {data.sections.map((field) => {
          // Reset row counter on section headers
          if (field.type === "SECTION_HEADER") {
            rowIndex = 0;
          }
          // Skip instructions in PDF
          if (field.type === "INSTRUCTIONS") {
            return null;
          }
          const currentIndex = rowIndex;
          if (field.type !== "SECTION_HEADER") {
            rowIndex++;
          }
          return renderField(field, data.data, currentIndex);
        })}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {data.orgName}
            {data.workOrderNumber ? ` - ${data.workOrderNumber}` : ""}
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
          <Text style={s.footerText}>
            Generated {new Date().toLocaleDateString("en-US")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
