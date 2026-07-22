import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseCsv, parseCsvTable } from '#/lib/csv/parse-csv'

describe('parseCsv', () => {
  it('parses simple comma-separated rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('handles quoted fields with embedded delimiters, quotes, and newlines', () => {
    const text = 'sku,name\nA-1,"Widget, ""large""\ntwo lines"'
    expect(parseCsv(text)).toEqual([
      ['sku', 'name'],
      ['A-1', 'Widget, "large"\ntwo lines'],
    ])
  })

  it('handles CRLF line endings and trailing newlines', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('strips a UTF-8 BOM before the first header', () => {
    expect(parseCsv('﻿sku,name\n1,x')[0]).toEqual(['sku', 'name'])
  })

  it('drops fully empty rows', () => {
    expect(parseCsv('a,b\n,\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('supports semicolon-delimited input via detection', () => {
    expect(parseCsv('a;b;c\n1;2;3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })
})

describe('detectDelimiter', () => {
  it('prefers the delimiter that dominates the header row', () => {
    expect(detectDelimiter('a,b,c')).toBe(',')
    expect(detectDelimiter('a;b;c')).toBe(';')
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
  })

  it('ignores delimiters inside quoted headers', () => {
    expect(detectDelimiter('"a;x";"b;y"\n1;2')).toBe(';')
  })
})

describe('parseCsvTable', () => {
  it('maps records by trimmed header names', () => {
    const table = parseCsvTable('sku , name\nA-1, Widget ')
    expect(table.headers).toEqual(['sku', 'name'])
    expect(table.records).toEqual([{ sku: 'A-1', name: 'Widget' }])
  })

  it('fills missing trailing cells with empty strings', () => {
    const table = parseCsvTable('a,b,c\n1,2')
    expect(table.records[0]).toEqual({ a: '1', b: '2', c: '' })
  })

  it('disambiguates duplicate and empty headers', () => {
    const table = parseCsvTable('sku,,sku\n1,2,3')
    expect(table.headers).toEqual(['sku', 'column_2', 'sku_3'])
  })

  it('returns empty output for empty input', () => {
    expect(parseCsvTable('')).toEqual({ headers: [], records: [] })
  })
})
