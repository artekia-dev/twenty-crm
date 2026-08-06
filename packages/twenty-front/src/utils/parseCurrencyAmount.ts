// Reads an amount the way a person types it, in Spanish notation.
//
// The previous version did `amountText.replace(',', '.')` and `parseFloat`.
// That replaces only the FIRST comma and leaves thousands separators in place,
// so typing 1.234,56 became "1.234.56" and parseFloat stopped at 1.234 — the
// field silently stored 1,23 € instead of 1.234,56 €. Typing 45.000 stored 45.
//
// The rules below are the ones a Spanish keyboard produces:
//   - a comma is always the decimal separator; dots around it are thousands
//   - with no comma, a lone dot followed by exactly three digits is a
//     thousands separator, because money has two decimals and nobody writes
//     45.000 meaning forty-five
//   - a lone dot followed by one or two digits stays a decimal separator, so
//     123.45 keeps working for anyone who types the English way
export const parseCurrencyAmount = (amountText: string): number => {
  const cleaned = amountText
    .replace(/[\s  ]/g, '')
    .replace(/[€$£¥]/g, '')
    .trim();

  if (cleaned === '') return NaN;

  const lastComma = cleaned.lastIndexOf(',');

  if (lastComma !== -1) {
    const whole = cleaned.slice(0, lastComma).replace(/[.,]/g, '');
    const fraction = cleaned.slice(lastComma + 1).replace(/[.,]/g, '');

    return parseFloat(`${whole}.${fraction}`);
  }

  const dots = cleaned.split('.').length - 1;

  if (dots > 1) return parseFloat(cleaned.replace(/\./g, ''));

  if (dots === 1) {
    const [, fraction = ''] = cleaned.split('.');

    if (fraction.length === 3) return parseFloat(cleaned.replace('.', ''));
  }

  return parseFloat(cleaned);
};
