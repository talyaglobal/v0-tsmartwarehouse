"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { QrCode, Camera, CheckCircle, Search, MapPin, X } from "@/components/icons"
import { Html5Qrcode } from "html5-qrcode"
import { api } from "@/lib/api/client"

interface ScanResult {
  id: string
  type: string
  location: string
  status: string
  customer: string
}

export default function ScanPage() {
  const [manualCode, setManualCode] = useState("")
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scanAreaId = "qr-reader"

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current = null
          })
          .catch(() => {
            scannerRef.current = null
          })
      }
    }
  }, [])

  const handleScan = async () => {
    if (isScanning) {
      // Stop scanning
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop()
          scannerRef.current = null
          setIsScanning(false)
        } catch (err) {
          console.error("Error stopping scanner:", err)
        }
      }
      return
    }

    try {
      setError(null)
      const scanner = new Html5Qrcode(scanAreaId)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: "environment" }, // Use back camera on mobile
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          // Successfully scanned
          await handleScannedCode(decodedText)
          await scanner.stop()
          scannerRef.current = null
          setIsScanning(false)
        },
        (_errorMessage) => {
          // Ignore scanning errors (they're frequent during scanning)
        }
      )

      setIsScanning(true)
    } catch (err: any) {
      console.error("Error starting scanner:", err)
      setError(err.message || "Failed to start camera. Please check permissions.")
      setIsScanning(false)
      scannerRef.current = null
    }
  }

  const handleScannedCode = async (code: string) => {
    try {
      // Call API to fetch pallet information
      const result = await api.get(`/api/v1/inventory/search?code=${encodeURIComponent(code)}`, {
        successMessage: 'Pallet found',
        errorMessage: 'Pallet not found',
      })
      
      if (result.success && result.data) {
        setScanResult(result.data)
        setError(null)
      } else {
        setError(result.error || "Pallet not found")
        setScanResult(null)
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch pallet information")
      setScanResult(null)
    }
  }

  const handleManualSearch = async () => {
    if (!manualCode.trim()) return

    try {
      setError(null)
      await handleScannedCode(manualCode.trim())
    } catch (err: any) {
      setError(err.message || "Failed to search pallet")
      setScanResult(null)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Scan Pallet</h1>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <X className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanner Area */}
      <Card>
        <CardContent className="pt-6">
          <div
            id={scanAreaId}
            className="aspect-square max-w-xs mx-auto bg-muted rounded-lg flex flex-col items-center justify-center relative overflow-hidden"
          >
            {!isScanning && (
              <>
                <div className="absolute inset-4 border-2 border-dashed border-primary/50 rounded-lg"></div>
                <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center px-4">
                  Position QR code or barcode within the frame
                </p>
              </>
            )}
          </div>
          <Button className="w-full mt-4 gap-2" onClick={handleScan} disabled={!!error && !isScanning}>
            <Camera className="h-4 w-4" />
            {isScanning ? "Stop Scanning" : "Start Camera Scan"}
          </Button>
          {isScanning && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Point camera at QR code or barcode
            </p>
          )}
        </CardContent>
      </Card>

      {/* Manual Entry */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Manual Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter pallet ID..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <Button variant="outline" onClick={handleManualSearch} disabled={!manualCode.trim()}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scan Result */}
      {scanResult && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-700 dark:text-green-400">Pallet Found</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pallet ID</span>
                <span className="font-mono font-medium">{scanResult.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <span>{scanResult.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Customer</span>
                <span>{scanResult.customer}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Location</span>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{scanResult.location}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="secondary" className="capitalize">
                  {scanResult.status}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1 bg-transparent">
                View Details
              </Button>
              <Button className="flex-1">Move Pallet</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
