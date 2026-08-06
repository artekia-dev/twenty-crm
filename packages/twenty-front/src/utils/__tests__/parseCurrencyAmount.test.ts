import { parseCurrencyAmount } from '~/utils/parseCurrencyAmount';

// The field used to store 1,23 € when somebody typed 1.234,56, and 45 € when
// they typed 45.000. It replaced only the first comma and left the thousands
// separators in, so parseFloat stopped at the second dot. Nothing warned: the
// record just held a number a thousand times smaller than the invoice.
describe('parseCurrencyAmount', () => {
  it('reads Spanish notation', () => {
    expect(parseCurrencyAmount('123,45')).toBe(123.45);
    expect(parseCurrencyAmount('1.234,56')).toBe(1234.56);
    expect(parseCurrencyAmount('1.234.567,89')).toBe(1234567.89);
    expect(parseCurrencyAmount('829,33')).toBe(829.33);
  });

  it('treats a lone dot before three digits as thousands', () => {
    // Money has two decimals. 45.000 is forty-five thousand, never forty-five.
    expect(parseCurrencyAmount('45.000')).toBe(45000);
    expect(parseCurrencyAmount('123.123')).toBe(123123);
  });

  it('still reads the English way when it is unambiguous', () => {
    expect(parseCurrencyAmount('123.45')).toBe(123.45);
    expect(parseCurrencyAmount('1.5')).toBe(1.5);
    expect(parseCurrencyAmount('0.99')).toBe(0.99);
  });

  it('ignores currency symbols and spaces', () => {
    expect(parseCurrencyAmount('1.234,56 €')).toBe(1234.56);
    expect(parseCurrencyAmount(' 829,33')).toBe(829.33);
    expect(parseCurrencyAmount('€45.000')).toBe(45000);
  });

  it('handles plain integers and negatives', () => {
    expect(parseCurrencyAmount('500')).toBe(500);
    expect(parseCurrencyAmount('-1.234,56')).toBe(-1234.56);
  });

  it('gives NaN for anything that is not an amount', () => {
    expect(parseCurrencyAmount('')).toBeNaN();
    expect(parseCurrencyAmount('   ')).toBeNaN();
    expect(parseCurrencyAmount('abc')).toBeNaN();
  });
});
