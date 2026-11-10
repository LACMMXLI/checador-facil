/** Escapa una celda CSV y neutraliza inyección de fórmulas en Excel (=, +, -, @). */
export function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
export const csvLine = (cells: Array<string | number | null | undefined>) => cells.map(csvCell).join(',');

export function minutesToHHMM(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}
