import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export async function downloadDocumentPdf (element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  })
  const pdf = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' })
  const pageWidth = 210
  const pageHeight = 297
  const imageHeight = (canvas.height * pageWidth) / canvas.width
  const image = canvas.toDataURL('image/png')

  let position = 0
  let remainingHeight = imageHeight
  pdf.addImage(image, 'PNG', 0, position, pageWidth, imageHeight)
  remainingHeight -= pageHeight

  while (remainingHeight > 0) {
    position -= pageHeight
    pdf.addPage()
    pdf.addImage(image, 'PNG', 0, position, pageWidth, imageHeight)
    remainingHeight -= pageHeight
  }

  pdf.save(filename)
}
