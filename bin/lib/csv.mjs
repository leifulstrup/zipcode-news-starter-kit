// Minimal RFC 4180 CSV parse/serialize. Zero dependencies, because the kit has
// none at runtime and a shared registry is not a reason to acquire one.
//
// Used by bin/registry.mjs. The registry is CSV rather than JSON on purpose:
// it is meant to be diffed in pull requests and opened in a spreadsheet by a
// publisher who has never written code. That only works if quoting is handled
// correctly, which is what this file is for.
//
// The cases that break naive `split(',')` — all handled, all real in this data:
//
//   name,notes
//   "Los Angeles County, CA",no quoting in the second field
//   Assessor,"padded field; use LIKE, not equality"        <- comma inside quotes
//   Courts,"they call it ""Case.net"" in their own docs"   <- escaped quotes
//   Permits,"line one
//   line two"                                              <- newline inside quotes
//
// parse() returns an array of row objects keyed by the header row.
// serialize() takes (columns, rows) and quotes only fields that need it, so a
// diff stays readable and a row that gained a comma does not reformat the file.

/**
 * Parse RFC 4180 CSV text into row objects keyed by the header row.
 * Tolerates CRLF, a trailing newline, and a UTF-8 BOM.
 * Rows with a different field count than the header are returned anyway, with
 * missing fields as '' — a malformed row should be visible, not silently gone.
 */
export function parse(text) {
  if (!text) return [];
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);   // strip BOM

  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }      // escaped quote
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;                               // CRLF -> LF
    if (ch === '\n') { row.push(field); rows.push(row); field = ''; row = []; continue; }
    field += ch;
  }
  // Final field/row, unless the file ended with a newline and nothing after it.
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.length > 1 || (r[0] ?? '').trim() !== '')  // drop blank lines
    .map(r => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
      return obj;
    });
}

/** Quote a single field only when RFC 4180 requires it. */
export function quote(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialize row objects to CSV with an explicit column order and a header row.
 * LF endings, no BOM, trailing newline — the shape the registry contract wants
 * so that diffs are minimal and stable.
 */
export function serialize(columns, rows) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map(c => quote(r[c])).join(','));
  return lines.join('\n') + '\n';
}
