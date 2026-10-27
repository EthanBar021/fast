/**
 * Packs equal-length numeric columns into one binary blob (Float64, column-major):
 * [version, columnCount, rowCount, ...column0, ...column1, …].
 * Compact and fast to read back compared to JSON for long series.
 */
const VERSION = 1;
const HEADER = 3;

export function encodeColumns(columns: readonly ArrayLike<number>[]): Uint8Array {
  const rows = columns[0]?.length ?? 0;
  if (columns.some((c) => c.length !== rows)) throw new Error('encodeColumns: columns must have the same length');
  const data = new Float64Array(HEADER + rows * columns.length);
  data[0] = VERSION;
  data[1] = columns.length;
  data[2] = rows;
  columns.forEach((column, c) => {
    const offset = HEADER + c * rows;
    for (let i = 0; i < rows; i++) data[offset + i] = column[i];
  });
  return new Uint8Array(data.buffer);
}

export function decodeColumns(bytes: Uint8Array): Float64Array[] {
  if (bytes.byteLength < HEADER * 8 || bytes.byteLength % 8 !== 0) throw new Error('decodeColumns: invalid blob');
  // Copy: the blob may not be 8-byte aligned.
  const data = new Float64Array(bytes.slice().buffer);
  if (data[0] !== VERSION) throw new Error(`decodeColumns: unsupported version ${data[0]}`);
  const count = data[1];
  const rows = data[2];
  if (data.length !== HEADER + count * rows) throw new Error('decodeColumns: truncated blob');
  return Array.from({ length: count }, (_, c) => data.subarray(HEADER + c * rows, HEADER + (c + 1) * rows));
}
