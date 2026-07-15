import { type AmrsErrorResponse } from '../types';

const tryParseJson = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const isBoilerplate = (msg: string): boolean =>
  /^Server responded with/i.test(msg) || /^Request failed with/i.test(msg) || /^Failed to fetch/i.test(msg);

/**
 * Extract a human-readable message from a failed request.
 *
 * openmrsFetch rejects with an error whose `.message` is boilerplate ("Server
 * responded with 500 …"); the server's real message lives on `.responseBody`
 * (parsed object or JSON string). This walks the common shapes and only falls
 * back to `.message` when it isn't that boilerplate.
 */
const SERVICE_UNAVAILABLE_MESSAGE =
  'The registry service is temporarily unavailable (timed out). Please try again in a moment.';

const looksLikeInfraError = (msg: string): boolean =>
  /proxy|gateway time-?out|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(msg);

export function getReadableErrorMessage(error: any, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) {
    return fallback;
  }

  // Gateway / proxy / timeout failures carry unhelpful bodies (HTML or proxy text)
  // — surface a clear, friendly line instead.
  const status = error.response?.status ?? error.status ?? error.statusCode ?? error.responseBody?.statusCode;
  if (status === 502 || status === 503 || status === 504) {
    return SERVICE_UNAVAILABLE_MESSAGE;
  }

  const rawBody = error.responseBody ?? error.response?.data ?? error.response?.body;
  const body = typeof rawBody === 'string' ? tryParseJson(rawBody) ?? rawBody : rawBody;

  const candidate =
    (typeof body === 'object' && (body?.message || body?.error?.message || body?.error)) ||
    (typeof body === 'string' && body) ||
    undefined;

  if (typeof candidate === 'string' && candidate.trim()) {
    return looksLikeInfraError(candidate) ? SERVICE_UNAVAILABLE_MESSAGE : candidate.trim();
  }
  if (typeof error.message === 'string' && error.message.trim() && !isBoilerplate(error.message)) {
    return looksLikeInfraError(error.message) ? SERVICE_UNAVAILABLE_MESSAGE : error.message.trim();
  }
  return fallback;
}

export function generateErrorMessage(error: any): string[] {
  const errors: string[] = [];
  return errors;
}

export function getErrorMessages(error: AmrsErrorResponse) {
  const errors = [];
  if (error && error.error) {
    if (error.error.error) {
      const globalErrors = error.error.error.globalErrors || null;
      if (globalErrors) {
        for (const err of globalErrors) {
          errors.push(err.message);
        }
      }
    } else if (error.error) {
      if (error.error['globalErrors']) {
        const globalErrors = error.error['globalErrors'] || null;
        if (globalErrors) {
          for (const err of globalErrors) {
            errors.push(err.message);
          }
        }
      } else if (error.error['message']) {
        errors.push(error.error['message']);
      }
    } else {
      errors.push(
        error.error.error.message ||
          'An error occurred while creating the patient. Please try again or contact support',
      );
    }
  }
  return errors;
}
