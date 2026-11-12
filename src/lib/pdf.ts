import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDoc = pdfjs.PDFDocumentProxy
export type PdfPage = pdfjs.PDFPageProxy

const asset = (dir: string) => new URL(`pdfjs/${dir}/`, document.baseURI).href

export function openPdf(data: ArrayBuffer): Promise<PdfDoc> {
  return pdfjs.getDocument({
    // pdf.js veriyi worker'a devreder; özgün tampon bozulmasın diye kopyası verilir.
    data: new Uint8Array(data.slice(0)),
    cMapUrl: asset('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: asset('standard_fonts'),
    wasmUrl: asset('wasm'),
    iccUrl: asset('iccs'),
  }).promise
}

export async function pageText(doc: PdfDoc, n: number): Promise<string> {
  const page = await doc.getPage(n)
  const content = await page.getTextContent()
  return content.items.map((it) => ('str' in it ? it.str : '')).join(' ')
}

/** Sayfa üzerinde 0–1 aralığında oranlarla verilen dikdörtgen. */
export interface Region {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Sayfanın bir bölgesini görsel olarak çizer ve data URL döndürür.
 * Yalnızca seçilen bölge çizilir; büyük sayfalarda bellek şişmez.
 */
export async function renderRegion(doc: PdfDoc, pageNo: number, r: Region, maxWidth = 1400): Promise<string> {
  const page = await doc.getPage(pageNo)
  const base = page.getViewport({ scale: 1 })
  const wPt = (r.x1 - r.x0) * base.width
  const hPt = (r.y1 - r.y0) * base.height
  let scale = Math.min(4, maxWidth / wPt)
  if (wPt * hPt * scale * scale > 12_000_000) scale = Math.sqrt(12_000_000 / (wPt * hPt))
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(wPt * scale))
  canvas.height = Math.max(1, Math.round(hPt * scale))
  const ctx = canvas.getContext('2d')!
  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    transform: [1, 0, 0, 1, -r.x0 * viewport.width, -r.y0 * viewport.height],
    background: '#ffffff',
  }).promise
  return canvas.toDataURL('image/jpeg', 0.88)
}
