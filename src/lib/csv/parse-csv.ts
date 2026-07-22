// Minimal RFC 4180 CSV parser for import flows. Handles quoted fields,
// escaped quotes (""), embedded delimiters/newlines, and CRLF line endings.
// Comma and semicolon delimiters are supported (semicolon exports are common
// from spreadsheets in comma-decimal locales).

export interface ParseCsvOptions {
  delimiter?: ',' | ';' | '\t'
}

export function parseCsv(
  text: string,
  options: ParseCsvOptions = {},
): Array<Array<string>> {
  const delimiter = options.delimiter ?? detectDelimiter(text)
  const rows: Array<Array<string>> = []
  let row: Array<string> = []
  let field = ''
  let inQuotes = false
  // Strip a UTF-8 BOM so the first header cell matches cleanly.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field === '') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') {
        index += 1
      }
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop rows that are entirely empty (trailing newlines, spacer lines).
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

// Picks the delimiter that appears most in the first non-empty line.
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine =
    text
      .split(/\r?\n/)
      .find((line) => line.trim() !== '')
      ?.replace(/"[^"]*"/g, '') ?? ''
  const candidates: Array<',' | ';' | '\t'> = [',', ';', '\t']

  return candidates.reduce((best, candidate) =>
    countChar(firstLine, candidate) > countChar(firstLine, best)
      ? candidate
      : best,
  )
}

function countChar(text: string, char: string): number {
  return text.split(char).length - 1
}

// Header + record objects keyed by trimmed header names. Duplicate or empty
// headers get positional suffixes so no column silently disappears.
export interface ParsedCsvTable {
  headers: Array<string>
  records: Array<Record<string, string>>
}

export function parseCsvTable(
  text: string,
  options: ParseCsvOptions = {},
): ParsedCsvTable {
  const rows = parseCsv(text, options)

  if (rows.length === 0) {
    return { headers: [], records: [] }
  }

  const seen = new Set<string>()
  const headers = rows[0].map((rawHeader, index) => {
    const base = rawHeader.trim() || `column_${index + 1}`
    const header = seen.has(base) ? `${base}_${index + 1}` : base
    seen.add(header)
    return header
  })

  const records = rows.slice(1).map((cells) =>
    headers.reduce<Record<string, string>>((record, header, index) => {
      return { ...record, [header]: (cells[index] ?? '').trim() }
    }, {}),
  )

  return { headers, records }
}
