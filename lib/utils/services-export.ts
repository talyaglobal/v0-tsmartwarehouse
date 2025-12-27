/**
 * Export utilities for services price list
 */

import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import type { WarehouseService } from '@/types/services'

const categoryLabels: Record<string, string> = {
  receiving: 'Receiving',
  putaway: 'Putaway',
  picking: 'Picking',
  shipping: 'Shipping',
  repalletization: 'Repalletization',
  labeling: 'Labeling',
  inventory: 'Inventory',
  'cross-docking': 'Cross-Docking',
  kitting: 'Kitting',
  returns: 'Returns',
  'quality-control': 'Quality Control',
  'temperature-control': 'Temperature Control',
  hazmat: 'Hazmat',
  'custom-packaging': 'Custom Packaging',
  other: 'Other',
}

const unitTypeLabels: Record<string, string> = {
  'per-item': 'per item',
  'per-pallet': 'per pallet',
  'per-hour': 'per hour',
  'per-order': 'per order',
  'flat-rate': 'flat rate',
}

/**
 * Export services price list to PDF
 */
export function exportServicesToPDF(services: WarehouseService[]): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const startY = 30
  let currentY = startY

  // Header
  doc.setFontSize(18)
  doc.setFont(undefined, 'bold')
  doc.text('Warehouse Services Price List', margin, currentY)
  currentY += 10

  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, currentY)
  currentY += 15

  // Table headers
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  const headers = ['Service Name', 'Category', 'Unit Type', 'Price']
  const colWidths = [70, 50, 45, 25]
  let startX = margin

  headers.forEach((header, index) => {
    doc.text(header, startX, currentY)
    startX += colWidths[index]
  })
  currentY += 8

  // Draw header line
  doc.setLineWidth(0.5)
  doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)
  currentY += 5

  // Table rows
  doc.setFont(undefined, 'normal')
  doc.setFontSize(9)

  services.forEach((service) => {
    // Check if we need a new page
    if (currentY > pageHeight - 30) {
      doc.addPage()
      pageNumber++
      currentY = startY
    }

    const serviceName = service.name
    const category = categoryLabels[service.category] || service.category
    const unitType = unitTypeLabels[service.unitType] || service.unitType
    const price = `$${service.basePrice.toFixed(2)}`

    // Wrap text if needed
    const lines = doc.splitTextToSize(serviceName, colWidths[0] - 2)
    const descriptionLines = service.description
      ? doc.splitTextToSize(service.description, colWidths[0] - 2)
      : []

    const rowHeight = Math.max(8, lines.length * 5, descriptionLines.length * 5) + 2

    startX = margin
    doc.text(lines, startX, currentY + 4)
    if (descriptionLines.length > 0) {
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      doc.text(descriptionLines, startX, currentY + 8)
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
    }
    startX += colWidths[0]

    doc.text(category, startX, currentY + 4)
    startX += colWidths[1]

    doc.text(unitType, startX, currentY + 4)
    startX += colWidths[2]

    doc.text(price, startX, currentY + 4)

    currentY += rowHeight + 3
  })

  // Footer - add page numbers (using internal API)
  const totalPages = (doc as any).internal?.getNumberOfPages?.() || 1
  if (totalPages > 0) {
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )
      doc.setTextColor(0, 0, 0)
    }
  }

  // Save the PDF
  doc.save(`services-price-list-${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Export services price list to Excel
 */
export function exportServicesToExcel(services: WarehouseService[]): void {
  // Prepare data for Excel
  const excelData = services.map((service) => ({
    'Service Code': service.code,
    'Service Name': service.name,
    Description: service.description || '',
    Category: categoryLabels[service.category] || service.category,
    'Unit Type': unitTypeLabels[service.unitType] || service.unitType,
    Price: service.basePrice,
    'Minimum Quantity': service.minQuantity,
    Status: service.isActive ? 'Active' : 'Inactive',
  }))

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(excelData)

  // Set column widths
  const colWidths = [
    { wch: 15 }, // Service Code
    { wch: 30 }, // Service Name
    { wch: 50 }, // Description
    { wch: 20 }, // Category
    { wch: 15 }, // Unit Type
    { wch: 12 }, // Price
    { wch: 18 }, // Minimum Quantity
    { wch: 12 }, // Status
  ]
  ws['!cols'] = colWidths

  // Add the worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Services Price List')

  // Generate Excel file and download
  const filename = `services-price-list-${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(wb, filename)
}

