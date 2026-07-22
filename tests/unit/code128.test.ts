import { describe, expect, it } from 'vitest'
import {
  code128Layout,
  code128Svg,
  code128Symbols,
  code128Widths,
  isEncodableCode128,
} from '#/lib/barcode/code128'

describe('code128Symbols', () => {
  it('encodes alphabetic values in subset B with the spec checksum', () => {
    // START B (104) + A(33)*1 + B(34)*2 + C(35)*3 = 310 → 310 mod 103 = 1
    expect(code128Symbols('ABC')).toEqual([104, 33, 34, 35, 1])
  })

  it('packs even-length numeric values into subset C pairs', () => {
    // START C (105) + 12*1 + 34*2 = 185 → 185 mod 103 = 82
    expect(code128Symbols('1234')).toEqual([105, 12, 34, 82])
  })

  it('spends one subset-B digit before switching to C for odd-length numerics', () => {
    // START B, '1' (17), CODE C (99), 23, 45 → checksum 568 mod 103 = 53
    expect(code128Symbols('12345')).toEqual([104, 17, 99, 23, 45, 53])
  })

  it('keeps short numeric values in subset B', () => {
    expect(code128Symbols('12')[0]).toBe(104)
  })

  it('rejects empty and non-ASCII values', () => {
    expect(() => code128Symbols('')).toThrow()
    expect(() => code128Symbols('café')).toThrow()
  })
})

describe('code128Widths', () => {
  it('emits 6 elements per symbol plus the 7-element stop pattern', () => {
    const symbols = code128Symbols('ABC')
    expect(code128Widths('ABC')).toHaveLength(symbols.length * 6 + 7)
  })

  it('totals 11 modules per symbol plus 13 for the stop pattern', () => {
    const symbols = code128Symbols('1234')
    const totalModules = code128Widths('1234').reduce(
      (sum, width) => sum + width,
      0,
    )
    expect(totalModules).toBe(symbols.length * 11 + 13)
  })
})

describe('code128Layout', () => {
  it('adds a 10-module quiet zone on both sides', () => {
    const totalModules = code128Widths('SKU-001').reduce(
      (sum, width) => sum + width,
      0,
    )
    const layout = code128Layout('SKU-001')
    expect(layout.totalModules).toBe(totalModules + 20)
    expect(layout.bars[0].x).toBe(10)
  })
})

describe('code128Svg', () => {
  it('renders an svg sized from the module count', () => {
    const svg = code128Svg('SKU-001', { moduleWidth: 2, height: 40 })
    expect(svg).toContain('<svg')
    expect(svg).toContain('height="40"')
    expect(svg).toContain('<rect')
  })
})

describe('isEncodableCode128', () => {
  it('accepts printable ASCII and rejects control or non-latin characters', () => {
    expect(isEncodableCode128('ABC-123 x')).toBe(true)
    expect(isEncodableCode128('')).toBe(false)
    expect(isEncodableCode128('tab\tchar')).toBe(false)
    expect(isEncodableCode128('عربى')).toBe(false)
  })
})
