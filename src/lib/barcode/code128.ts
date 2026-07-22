// Code 128 barcode encoder (subsets B and C) with no external dependencies.
// Produces module widths / SVG markup for label printing. Values must be
// printable ASCII (32–126); numeric payloads compress into subset C.

const CODE128_WIDTHS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
] as const

const STOP_WIDTHS = '2331112'

const START_B = 104
const START_C = 105
const CODE_C = 99

export function isEncodableCode128(value: string): boolean {
  if (value.length === 0 || value.length > 80) {
    return false
  }

  return [...value].every((char) => {
    const code = char.charCodeAt(0)
    return code >= 32 && code <= 126
  })
}

// Symbol values for the full barcode: start code, data (with subset switches),
// checksum, stop. Exposed for unit testing the checksum math.
export function code128Symbols(value: string): Array<number> {
  if (!isEncodableCode128(value)) {
    throw new Error(
      'Barcode values must be 1–80 printable ASCII characters (codes 32–126).',
    )
  }

  const digitsOnly = /^\d+$/.test(value)
  const symbols: Array<number> = []

  if (digitsOnly && value.length >= 4) {
    // Subset C packs digit pairs. An odd-length value spends one digit in
    // subset B first so the remainder is even (covers EAN-13 style payloads).
    let rest = value

    if (value.length % 2 === 1) {
      symbols.push(START_B, value.charCodeAt(0) - 32, CODE_C)
      rest = value.slice(1)
    } else {
      symbols.push(START_C)
    }

    for (let index = 0; index < rest.length; index += 2) {
      symbols.push(Number(rest.slice(index, index + 2)))
    }
  } else {
    symbols.push(START_B)
    for (const char of value) {
      symbols.push(char.charCodeAt(0) - 32)
    }
  }

  const checksum =
    symbols.reduce(
      (sum, symbol, index) => sum + symbol * Math.max(1, index),
      0,
    ) % 103

  return [...symbols, checksum]
}

// Alternating bar/space module widths, starting with a bar. Includes the stop
// pattern; quiet zones are left to the renderer.
export function code128Widths(value: string): Array<number> {
  const widths: Array<number> = []

  for (const symbol of code128Symbols(value)) {
    for (const width of CODE128_WIDTHS[symbol]) {
      widths.push(Number(width))
    }
  }

  for (const width of STOP_WIDTHS) {
    widths.push(Number(width))
  }

  return widths
}

export interface Code128Bar {
  x: number
  width: number
}

export interface Code128Layout {
  bars: Array<Code128Bar>
  // Total width in modules, including a 10-module quiet zone on each side.
  totalModules: number
}

export function code128Layout(value: string): Code128Layout {
  const QUIET_ZONE = 10
  const widths = code128Widths(value)
  const bars: Array<Code128Bar> = []
  let cursor = QUIET_ZONE

  widths.forEach((width, index) => {
    if (index % 2 === 0) {
      bars.push({ x: cursor, width })
    }
    cursor += width
  })

  return { bars, totalModules: cursor + QUIET_ZONE }
}

export interface Code128SvgOptions {
  // Pixel width of one module (bar unit). Defaults to 2.
  moduleWidth?: number
  // Bar height in pixels. Defaults to 48.
  height?: number
  barColor?: string
}

export function code128Svg(
  value: string,
  options: Code128SvgOptions = {},
): string {
  const moduleWidth = options.moduleWidth ?? 2
  const height = options.height ?? 48
  const barColor = options.barColor ?? '#000000'
  const layout = code128Layout(value)
  const totalWidth = layout.totalModules * moduleWidth

  const rects = layout.bars
    .map(
      (bar) =>
        `<rect x="${bar.x * moduleWidth}" y="0" width="${bar.width * moduleWidth}" height="${height}" fill="${barColor}"/>`,
    )
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" role="img" aria-label="Barcode">${rects}</svg>`
}
