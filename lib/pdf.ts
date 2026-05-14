import { PDFDocument, type PDFPage } from "pdf-lib"

export async function getPdfPageCount(file: File): Promise<number> {
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return doc.getPageCount()
}

/**
 * Parse a free-form page range string like "1, 3-5, 7" into a sorted, deduplicated
 * list of 0-indexed page numbers. Returns null if the input is syntactically invalid
 * or references pages outside [1, total].
 * Empty / whitespace-only input returns null (meaning "all pages").
 */
export function parsePageRangeStr(input: string, total: number): number[] | null {
  if (!input.trim()) return null

  const indices: number[] = []

  for (const part of input.split(",")) {
    const t = part.trim()
    if (!t) continue

    const range = t.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    const single = t.match(/^(\d+)$/)

    if (range) {
      const from = parseInt(range[1], 10)
      const to = parseInt(range[2], 10)
      if (from < 1 || to > total || from > to) return null
      for (let i = from; i <= to; i++) indices.push(i - 1)
    } else if (single) {
      const p = parseInt(single[1], 10)
      if (p < 1 || p > total) return null
      indices.push(p - 1)
    } else {
      return null
    }
  }

  return indices
}

/**
 * Deduplicates and sorts a list of 0-indexed page numbers, then serialises them
 * back into compact 1-indexed range notation, e.g. [0,0,1,2,4] → "1-3, 5".
 */
export function normalizePageRangeStr(indices: number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b)
  if (sorted.length === 0) return ""

  const parts: string[] = []
  let start = sorted[0]
  let end = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      parts.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`)
      start = sorted[i]
      end = sorted[i]
    }
  }
  parts.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`)

  return parts.join(", ")
}

export async function extractPages(file: File, zeroIndexedPages: number[]): Promise<File> {
  const bytes = await file.arrayBuffer()
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const newDoc = await PDFDocument.create()

  const copied = await newDoc.copyPages(srcDoc, zeroIndexedPages)
  copied.forEach((page: PDFPage) => newDoc.addPage(page))

  const newBytes = await newDoc.save()
  return new File([newBytes.buffer as ArrayBuffer], file.name, { type: "application/pdf" })
}
