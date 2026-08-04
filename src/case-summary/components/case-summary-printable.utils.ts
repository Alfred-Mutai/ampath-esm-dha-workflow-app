import { formatDate, parseDate } from '@openmrs/esm-framework';
import { type CaseSummaryLabInterpretation } from '../types/case-summary.types';

export const EMPTY_VALUE = '—';

export function formatDateSafe(value?: string): string {
  return value ? formatDate(parseDate(value), { time: false }) : EMPTY_VALUE;
}

/**
 * Human label for a lab interpretation. `interpretation` is only ever present
 * on the wire when the result is abnormal — `NORMAL` and unassessable results
 * omit the field entirely (see `CaseSummaryLabInterpretation`) — so every
 * value this can be called with is a real flag to render.
 */
export function interpretationLabel(interpretation: CaseSummaryLabInterpretation): string {
  switch (interpretation) {
    case 'LOW':
      return 'Low';
    case 'HIGH':
      return 'High';
    case 'CRITICALLY_LOW':
      return 'Critically low';
    case 'CRITICALLY_HIGH':
      return 'Critically high';
    case 'OFF_SCALE_LOW':
      return 'Off-scale low';
    case 'OFF_SCALE_HIGH':
      return 'Off-scale high';
  }
}

/** Carbon tag tone for a lab interpretation — red for critical/off-scale, magenta for a plain high/low. */
export function interpretationTagType(interpretation: CaseSummaryLabInterpretation): 'red' | 'magenta' {
  return interpretation === 'LOW' || interpretation === 'HIGH' ? 'magenta' : 'red';
}

/**
 * Splits a SOAP note section's prose into its component sentences for
 * display as a scannable list rather than one dense paragraph. The
 * server-generated text is sentence-terminated prose (`"Chief Complaint:
 * HEADACHE. Onset: MODERATE."`), so splitting after `". "` recovers the
 * original field-level lines without needing the raw fields.
 */
export function splitSoapSentences(text?: string): Array<string> {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}
