'use client'
import type { PalletLabelData } from '@/types'
import { LotBatchDisplay } from './lot-batch-display'
import { StorageDurationDisplay } from './storage-duration-display'
import { LocationBreadcrumb } from '@/components/warehouses/location-breadcrumb'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PalletLabelPDFProps {
  labelData: PalletLabelData
  className?: string
  /**
   * Label size preset
   * - '4x6': Standard 4x6 inch label (default)
   * - '6x4': Landscape 6x4 inch label
   * - 'custom': Custom size (use className for dimensions)
   */
  size?: '4x6' | '6x4' | 'custom'
}

/**
 * Pallet Label PDF Component
 * 
 * Print-friendly pallet label component designed for PDF generation
 * Standard 4x6 inch label format with all traceability information
 * 
 * Usage:
 * - Use with PDF generation libraries (react-pdf, jsPDF, etc.)
 * - Can be printed directly via browser print (window.print())
 * - Designed for standard label printer formats
 */
export function PalletLabelPDF({
  labelData,
  className,
  size = '4x6',
}: PalletLabelPDFProps) {
  // Size-based styling
  const sizeClasses = {
    '4x6': 'w-[4in] h-[6in]', // Portrait 4x6 inch
    '6x4': 'w-[6in] h-[4in]', // Landscape 6x4 inch
    'custom': '',
  }

  return (
    <div
      className={cn(
        'bg-white p-4 border-2 border-black print:border-black',
        sizeClasses[size],
        className
      )}
      style={{
        // Ensure proper sizing for PDF generation
        boxSizing: 'border-box',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-2 mb-3">
        <h1 className="text-xl font-bold uppercase">PALLET LABEL</h1>
      </div>

      <div className="space-y-3 text-sm">
        {/* Warehouse Tracking Number - Prominent */}
        <div className="bg-gray-100 p-2 border border-black rounded">
          <div className="text-xs text-gray-600 uppercase mb-1">Warehouse Tracking</div>
          <div className="text-lg font-bold font-mono">
            {labelData.warehouseTrackingNumber}
          </div>
          {labelData.barcode && (
            <div className="text-xs text-gray-600 mt-1">Barcode: {labelData.barcode}</div>
          )}
          {labelData.qrCode && (
            <div className="text-xs text-gray-600">QR: {labelData.qrCode}</div>
          )}
        </div>

        {/* Customer Information */}
        <div className="border-b border-gray-300 pb-2">
          <div className="font-semibold text-base mb-1">{labelData.customerName}</div>
          {(labelData.customerLotNumber || labelData.customerBatchNumber) && (
            <div className="text-xs mt-1">
              <LotBatchDisplay
                lotNumber={labelData.customerLotNumber}
                batchNumber={labelData.customerBatchNumber}
              />
            </div>
          )}
        </div>

        {/* Dates Section */}
        <div className="grid grid-cols-2 gap-2 border-b border-gray-300 pb-2">
          <div>
            <div className="text-xs text-gray-600">Arrival Date</div>
            <div className="font-semibold">{labelData.arrivalDate}</div>
          </div>
          {labelData.expectedReleaseDate && (
            <div>
              <div className="text-xs text-gray-600">Expected Release</div>
              <div className="font-semibold">{labelData.expectedReleaseDate}</div>
            </div>
          )}
        </div>

        {/* Storage Duration */}
        <div className="border-b border-gray-300 pb-2">
          <StorageDurationDisplay
            days={labelData.daysInWarehouse}
            months={labelData.monthsInWarehouse}
          />
        </div>

        {/* Stock Information */}
        {(labelData.stockDefinition ||
          labelData.numberOfCases ||
          labelData.numberOfUnits ||
          labelData.hsCode) && (
          <div className="border-b border-gray-300 pb-2">
            {labelData.stockDefinition && (
              <div className="mb-1">
                <div className="text-xs text-gray-600">Stock Definition</div>
                <div className="font-semibold text-sm">{labelData.stockDefinition}</div>
              </div>
            )}
            {(labelData.numberOfCases || labelData.numberOfUnits) && (
              <div className="flex gap-4 text-xs mt-1">
                {labelData.numberOfCases && (
                  <div>
                    <span className="text-gray-600">Cases: </span>
                    <span className="font-semibold">{labelData.numberOfCases}</span>
                  </div>
                )}
                {labelData.numberOfUnits && (
                  <div>
                    <span className="text-gray-600">Units: </span>
                    <span className="font-semibold">
                      {labelData.numberOfUnits} {labelData.unitType || ''}
                    </span>
                  </div>
                )}
              </div>
            )}
            {labelData.hsCode && (
              <div className="text-xs mt-1">
                <span className="text-gray-600">HS Code: </span>
                <span className="font-mono font-semibold">{labelData.hsCode}</span>
              </div>
            )}
          </div>
        )}

        {/* Location */}
        <div className="border-b border-gray-300 pb-2">
          <div className="text-xs text-gray-600 mb-1">Location</div>
          <LocationBreadcrumb
            floor={labelData.location.floor}
            region={labelData.location.region}
            hall={labelData.location.hall}
            zone={labelData.location.zone}
            locationCode={labelData.location.locationCode}
            className="text-sm font-semibold"
          />
          {labelData.location.locationCode && (
            <div className="text-xs font-mono text-gray-600 mt-1">
              Code: {labelData.location.locationCode}
            </div>
          )}
        </div>

        {/* Storage Requirements */}
        {labelData.storageRequirements && labelData.storageRequirements.length > 0 && (
          <div className="border-b border-gray-300 pb-2">
            <div className="text-xs text-gray-600 mb-1">Storage Requirements</div>
            <ul className="text-xs space-y-0.5">
              {labelData.storageRequirements.map((req, index) => (
                <li key={index}>• {req}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Status and Additional Info */}
        <div className="flex items-center justify-between pt-1">
          <Badge variant="outline" className="text-xs">
            Status: {labelData.status}
          </Badge>
          {labelData.palletId && (
            <div className="text-xs text-gray-600">Pallet ID: {labelData.palletId}</div>
          )}
        </div>
      </div>

      {/* Footer - QR Code Placeholder Area */}
      {/* In a real implementation, you would render an actual QR code here */}
      <div className="mt-3 pt-2 border-t border-gray-300 text-center">
        <div className="text-xs text-gray-500">
          Scan QR code for full details
        </div>
        {/* QR Code would be rendered here using a QR code library */}
        {/* Example: <QRCodeSVG value={labelData.warehouseTrackingNumber} size={80} /> */}
      </div>
    </div>
  )
}

/**
 * Helper function to generate print styles for the label
 * This can be used with CSS @media print or styled-components
 */
export const palletLabelPrintStyles = `
  @media print {
    @page {
      size: 4in 6in;
      margin: 0;
    }
    
    body {
      margin: 0;
      padding: 0;
    }
    
    .pallet-label-print {
      width: 4in;
      height: 6in;
      page-break-after: always;
    }
  }
`

