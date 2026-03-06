// Template definition types — shared between web builder, API, and PDF generation

export type CalcOperation = 'SUM' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' | 'AVERAGE' | 'MIN' | 'MAX' | 'COUNT';

export interface FieldProps {
  required?: boolean;
  helpText?: string;
  // NUMERIC_INPUT
  unit?: string;
  minValue?: number;
  maxValue?: number;
  // DROPDOWN, MULTI_SELECT
  options?: string[];
  // CALCULATED
  formula?: CalcOperation;
  inputs?: string[];   // blockId references to other fields
  // PHOTO_CAPTURE
  maxPhotos?: number;
  captionRequired?: boolean;
  // INSTRUCTIONS
  content?: string;    // Read-only text content
}

export interface TemplateField {
  blockId: string;
  type: string;        // ReportBlockType enum value
  title: string;
  props: FieldProps;
  sortOrder: number;
}

export interface CoverPageSettings {
  enabled: boolean;
  showLogo: boolean;
  showCustomerName: boolean;
  subtitle: string;
}

export interface TemplateDefinition {
  version: number;
  settings: {
    requireAllFields: boolean;
    allowPhotoEvidence: boolean;
    coverPage: CoverPageSettings;
  };
  sections: TemplateField[];
}

// Field value types stored in FormResponse.data
export type PhotoValue = {
  url: string;
  caption?: string;
  gps?: { lat: number; lng: number };
}[];

export type SignatureValue = {
  url: string;
  signedBy: string;
  signedAt: string;
};

export type GpsValue = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export type FieldValue =
  | string
  | number
  | boolean
  | string[]         // MULTI_SELECT
  | PhotoValue       // PHOTO_CAPTURE
  | SignatureValue    // SIGNATURE
  | GpsValue         // GPS_CAPTURE
  | null;

export type FormResponseData = Record<string, FieldValue>;

// Input field types (non-layout, non-computed fields that techs fill out)
export const INPUT_FIELD_TYPES = [
  'TEXT_INPUT', 'TEXTAREA', 'NUMERIC_INPUT', 'YES_NO',
  'DROPDOWN', 'MULTI_SELECT', 'DATE_INPUT',
  'PHOTO_CAPTURE', 'SIGNATURE', 'GPS_CAPTURE',
] as const;

export const LAYOUT_FIELD_TYPES = ['SECTION_HEADER', 'INSTRUCTIONS'] as const;

export function isInputField(type: string): boolean {
  return (INPUT_FIELD_TYPES as readonly string[]).includes(type);
}

export function isRequiredField(field: TemplateField, globalRequireAll: boolean): boolean {
  if (!isInputField(field.type)) return false;
  return field.props.required ?? globalRequireAll;
}
