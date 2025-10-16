
export function escapeCell(value: unknown, delimiter: string, quote = '"', alwaysQuote = false): string {
  let v = value == null ? "" : String(value);
  v = v.replace(/\r\n|\r|\n/g, "\n");
  const mustQuote =
    alwaysQuote ||
    v.includes(delimiter) ||
    v.includes(quote) ||
    /\s/.test(delimiter) ||
    /\n/.test(v);

  return mustQuote ? quote + v.replaceAll(quote, quote + quote) + quote : v;
}

export function toDelimited(matrix: string[][], delimiter: string, alwaysQuote: boolean): string {
  return matrix.map(r => r.map(v => escapeCell(v, delimiter, '"', alwaysQuote)).join(delimiter)).join("\n");
}
