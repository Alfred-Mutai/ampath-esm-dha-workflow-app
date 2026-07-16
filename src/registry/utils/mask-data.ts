export const maskValue = (value: string): string => {
  let arrValue = value.split('');
  for (let i = 0; i < value.length; i++) {
    if (i % 2 === 0) {
      arrValue[i] = '*';
    }
  }
  const maskedValue = arrValue.join('');
  return maskedValue;
};

/**
 * Mask a CR / identifier number, revealing only the last few characters and
 * replacing the rest with bullets — e.g. "1002938475" -> "••••••8475".
 */
export const maskCrNumber = (value: string, visible = 4): string => {
  if (!value) {
    return '';
  }
  if (value.length <= visible) {
    return '•'.repeat(value.length);
  }
  return `${'•'.repeat(value.length - visible)}${value.slice(-visible)}`;
};

/**
 * Mask a phone number, keeping the first 5 and last 3 digits visible — e.g.
 * "254728830041" -> "25472****041".
 */
export const maskPhone = (value: string): string => {
  if (!value) {
    return '';
  }
  const digits = value.replace(/\s+/g, '');
  if (digits.length <= 8) {
    return digits;
  }
  return `${digits.slice(0, 5)}${'*'.repeat(digits.length - 8)}${digits.slice(-3)}`;
};

export const maskExceptFirstAndLast = (value: string): string => {
  let arrValue = value.split('');
  for (let i = 0; i < value.length; i++) {
    if (!(i == 0 || i === value.length - 1)) {
      arrValue[i] = '*';
    }
  }
  const maskedValue = arrValue.join('');
  return maskedValue;
};

export const maskAllButFirstAndLastThree = (value: string): string => {
  let arrValue = value.split('');
  for (let i = 0; i < value.length; i++) {
    if (i > 3 && i < value.length - 3) {
      arrValue[i] = '*';
    }
  }
  const maskedValue = arrValue.join('');
  return maskedValue;
};
