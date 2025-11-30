"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { QrCode, Camera, CheckCircle, Search, MapPin } from "@/components/icons"

export default function ScanPage() {
  const [manualCode, setManualCode] = useState("")
  const [scanResult, setScanResult] = useState<{
    id: string
    type: string
    location: string
    status: string
    customer: string
  } | null>(null)

  const handleScan = () => {
    // Simulate scan result
    setScanResult({
      id: "PLT-2024-0875",
      type: "Electronics",
      location: "A2-Row 5-Level 3",
      status: "stored",
      customer: "Sarah Johnson",
    })
  }

  const handleManualSearch = () => {
    if (manualCode) {
      setScanResult({
        id: manualCode,
        type: "General",
        location: "B1-Row 2-Level 1",
        status: "stored",
        customer: "Acme Corp",
      })
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Scan Pallet</h1>

      {/* Scanner Area */}
      <Card>
        <CardContent className="pt-6">
          <div className="aspect-square max-w-xs mx-auto bg-muted rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-4 border-2 border-dashed border-primary/50 rounded-lg"></div>
            <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground text-center px-4">
              Position QR code or barcode within the frame
            </p>
          </div>
          <Button className="w-full mt-4 gap-2" onClick={handleScan}>
            <Camera className="h-4 w-4" />
            Scan Code
          </Button>
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
            <Button variant="outline" onClick={handleManualSearch}>
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
