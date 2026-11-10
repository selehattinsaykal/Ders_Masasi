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
