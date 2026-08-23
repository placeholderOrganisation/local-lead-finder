// Minimal CSV read/write — handles quoted fields, commas, and escaped quotes.

/**
 * Parse CSV text into an array of row objects keyed by header.
 * @param {string} text
 * @returns {Array<Record<string,string>>}
 */
export function parseCsv(text) {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((cells) => {
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = cells[i] ?? "";
    });
    return obj;
  });
}

// Parse into a 2D array of raw string cells.
function parseRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // Skip fully blank trailing lines.
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  // Flush last field/row if the file didn't end in a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }
  return rows;
}

/**
 * Serialize rows (array of objects) to CSV using the given column spec.
 * @param {Array<object>} rows
 * @param {Array<[key:string,label:string]>} columns
 * @returns {string}
 */
export function stringifyCsv(rows, columns) {
  const header = columns.map(([, label]) => label).join(",");
  const body = rows.map((r) => columns.map(([key]) => cell(r[key])).join(","));
  return [header, ...body].join("\n") + "\n";
}

function cell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
