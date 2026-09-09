import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const PDF_CAPTURE_SCALE = 1.5
const PDF_JPEG_QUALITY = 0.9

interface IsolatedPdfDocument {
  elements: HTMLElement[]
  iframe: HTMLIFrameElement
}

async function waitForImages (element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'))
  await Promise.all(images.map(async image => {
    if (!image.complete) {
      await new Promise<void>(resolve => {
        image.addEventListener('error', () => resolve(), { once: true })
        image.addEventListener('load', () => resolve(), { once: true })
      })
    }

    if (typeof image.decode === 'function') {
      await image.decode().catch(() => undefined)
    }
  }))
}

function waitForIframeLoad (iframe: HTMLIFrameElement): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    iframe.addEventListener('error', () => reject(new Error('Unable to create the isolated PDF document')), { once: true })
    iframe.addEventListener('load', () => resolve(), { once: true })
    iframe.srcdoc = '<!doctype html><html><head></head><body></body></html>'
  })
}

function copyStyles (sourceDocument: Document, targetDocument: Document): Promise<void[]> {
  const base = targetDocument.createElement('base')
  base.href = sourceDocument.baseURI
  targetDocument.head.append(base)

  const stylesheetLoads: Promise<void>[] = []
  for (const source of sourceDocument.head.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel~="stylesheet"]')) {
    if (source instanceof HTMLStyleElement) {
      targetDocument.head.append(source.cloneNode(true))
      continue
    }

    const stylesheet = targetDocument.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = source.href
    if (source.crossOrigin) {
      stylesheet.crossOrigin = source.crossOrigin
    }
    if (source.media) {
      stylesheet.media = source.media
    }
    stylesheetLoads.push(new Promise<void>((resolve, reject) => {
      stylesheet.addEventListener('error', () => reject(new Error(`Unable to load PDF stylesheet: ${stylesheet.href}`)), { once: true })
      stylesheet.addEventListener('load', () => resolve(), { once: true })
    }))
    targetDocument.head.append(stylesheet)
  }

  return Promise.all(stylesheetLoads)
}

function copyRootAttributes (source: HTMLElement, target: HTMLElement): void {
  target.className = source.className
  for (const attribute of ['dir', 'lang']) {
    const value = source.getAttribute(attribute)
    if (value !== null) {
      target.setAttribute(attribute, value)
    }
  }
}

async function createIsolatedPdfDocument (elements: HTMLElement[]): Promise<IsolatedPdfDocument> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  Object.assign(iframe.style, {
    border: '0',
    height: `${window.innerHeight}px`,
    left: '-100000px',
    pointerEvents: 'none',
    position: 'fixed',
    top: '0',
    visibility: 'hidden',
    width: `${window.innerWidth}px`,
  })
  document.body.append(iframe)

  try {
    await waitForIframeLoad(iframe)
    const isolatedDocument = iframe.contentDocument
    if (!isolatedDocument?.head || !isolatedDocument.body) {
      throw new Error('Unable to access the isolated PDF document')
    }

    copyRootAttributes(document.documentElement, isolatedDocument.documentElement)
    copyRootAttributes(document.body, isolatedDocument.body)
    isolatedDocument.body.style.margin = '0'

    const stylesReady = copyStyles(document, isolatedDocument)
    const renderRoot = isolatedDocument.createElement('div')
    const applicationRoot = elements[0]?.closest<HTMLElement>('.v-application')
    if (applicationRoot) {
      copyRootAttributes(applicationRoot, renderRoot)
    }
    renderRoot.style.display = 'block'
    isolatedDocument.body.append(renderRoot)

    const clonedElements = elements.map(element => {
      const clone = element.cloneNode(true) as HTMLElement
      clone.style.boxSizing = 'border-box'
      clone.style.width = `${element.getBoundingClientRect().width}px`
      renderRoot.append(clone)
      return clone
    })

    await stylesReady
    if (isolatedDocument.fonts) {
      await isolatedDocument.fonts.ready
    }
    await Promise.all(clonedElements.map(element => waitForImages(element)))

    return { elements: clonedElements, iframe }
  } catch (error) {
    iframe.remove()
    throw error
  }
}

export async function downloadDocumentsPdf (elements: HTMLElement[], filename: string): Promise<void> {
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  let isolatedDocument: IsolatedPdfDocument | undefined

  try {
    isolatedDocument = await createIsolatedPdfDocument(elements)
    const pdf = new jsPDF({ compress: true, format: 'a4', orientation: 'portrait', unit: 'mm' })
    const pageWidth = 210
    const pageHeight = 297

    for (const [index, element] of isolatedDocument.elements.entries()) {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: PDF_CAPTURE_SCALE,
        useCORS: true,
      })
      const imageHeight = (canvas.height * pageWidth) / canvas.width
      const image = canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY)

      if (index > 0) {
        pdf.addPage()
      }

      let position = 0
      let remainingHeight = imageHeight
      pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight)
      remainingHeight -= pageHeight

      while (remainingHeight > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight)
        remainingHeight -= pageHeight
      }
    }

    pdf.save(filename)
  } finally {
    isolatedDocument?.iframe.remove()
    if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
      window.scrollTo(scrollX, scrollY)
    }
  }
}

export async function downloadDocumentPdf (element: HTMLElement, filename: string): Promise<void> {
  await downloadDocumentsPdf([element], filename)
}
