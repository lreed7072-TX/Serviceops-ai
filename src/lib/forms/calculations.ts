import { TemplateField, FormResponseData } from './types';

export function computeCalculatedField(
  field: TemplateField,
  data: FormResponseData
): number | null {
  const formula = field.props.formula;
  const inputIds = field.props.inputs;

  if (!formula || !inputIds || inputIds.length === 0) return null;

  const values = inputIds
    .map((id) => data[id])
    .filter((v): v is number => typeof v === 'number');

  if (values.length === 0) return null;

  switch (formula) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0);
    case 'SUBTRACT':
      return values.length >= 2 ? values[0] - values[1] : null;
    case 'MULTIPLY':
      return values.reduce((a, b) => a * b, 1);
    case 'DIVIDE':
      return values.length >= 2 && values[1] !== 0 ? values[0] / values[1] : null;
    case 'AVERAGE':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'MIN':
      return Math.min(...values);
    case 'MAX':
      return Math.max(...values);
    case 'COUNT':
      return values.length;
    default:
      return null;
  }
}

export function computeAllCalculatedFields(
  sections: TemplateField[],
  data: FormResponseData
): FormResponseData {
  const result = { ...data };
  for (const field of sections) {
    if (field.type === 'CALCULATED') {
      const value = computeCalculatedField(field, result);
      if (value !== null) {
        result[field.blockId] = Math.round(value * 100) / 100;
      }
    }
  }
  return result;
}
