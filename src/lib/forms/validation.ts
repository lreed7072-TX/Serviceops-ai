import { TemplateDefinition, FormResponseData, isInputField, isRequiredField } from './types';

export interface ValidationError {
  blockId: string;
  field: string;
  message: string;
}

export function validateFormResponse(
  template: TemplateDefinition,
  data: FormResponseData
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of template.sections) {
    if (!isInputField(field.type)) continue;

    const value = data[field.blockId];
    const required = isRequiredField(field, template.settings.requireAllFields);

    // Check required
    if (required && (value === null || value === undefined || value === '')) {
      errors.push({
        blockId: field.blockId,
        field: field.title,
        message: `${field.title} is required`,
      });
      continue;
    }

    // Skip further validation if empty and not required
    if (value === null || value === undefined || value === '') continue;

    // Numeric range check
    if (field.type === 'NUMERIC_INPUT' && typeof value === 'number') {
      if (field.props.minValue !== undefined && value < field.props.minValue) {
        errors.push({
          blockId: field.blockId,
          field: field.title,
          message: `${field.title} is below minimum (${field.props.minValue})`,
        });
      }
      if (field.props.maxValue !== undefined && value > field.props.maxValue) {
        errors.push({
          blockId: field.blockId,
          field: field.title,
          message: `${field.title} is above maximum (${field.props.maxValue})`,
        });
      }
    }
  }

  return errors;
}

export function getCompletionProgress(
  template: TemplateDefinition,
  data: FormResponseData
): { filled: number; total: number } {
  let filled = 0;
  let total = 0;

  for (const field of template.sections) {
    if (!isInputField(field.type)) continue;
    if (isRequiredField(field, template.settings.requireAllFields)) {
      total++;
      const value = data[field.blockId];
      if (value !== null && value !== undefined && value !== '') {
        filled++;
      }
    }
  }

  return { filled, total };
}
