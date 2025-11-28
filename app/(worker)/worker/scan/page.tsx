"use client"

import * as React from "react"
import { WorkerHeader } from "@/components/worker/worker-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QrCode, Camera, Keyboard, Package, MapPin, CheckCircle, AlertCircle } from "lucide-react"

export default function ScanPage() {
  const [manualCode, setManualCode] = React.useState("")
  const [scanResult, setScanResult] = React.useState<{
    type: "success" | "error" | null
    message: string
    data?: {
      sku: string
      name: string
      location: string
      quantity: number
    }
  }>({ type: null, message: "" })

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualCode.trim()) {
      // Simulate scan result
      setScanResult({
        type: "success",
        message: "Item found",
        data: {
          sku: manualCode.toUpperCase(),
          name: "Sample Product",
          location: "Zone A, Rack 01, Level 2",
          quantity: 24,
        },
      })
    }
  }

  const handleCameraScan = () => {
    // Simulate camera scan
    setScanResult({
      type: "success",
      message: "Item scanned successfully",
      data: {
        sku: "SKU-12345",
        name: "Electronic Component Box",
        location: "Zone B, Rack 03, Level 1",
        quantity: 48,
      },
    })
  }

  return (
    <div className="flex flex-col min-h-screen">
      <WorkerHeader title="Scan" />

      <main className="flex-1 p-4 space-y-4">
        <Tabs defaultValue="camera" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="camera">
              <Camera className="mr-2 h-4 w-4" />
              Camera
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Keyboard className="mr-2 h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="camera" className="mt-4">
            <Card>
              <CardContent className="p-4">
                {/* Camera Preview Placeholder */}
                <div className="aspect-square bg-muted rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-primary rounded-lg" />
                  </div>
                  <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">Position barcode within frame</p>
                </div>
                <Button className="w-full mt-4" onClick={handleCameraScan}>
                  <Camera className="mr-2 h-4 w-4" />
                  Simulate Scan
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Enter SKU or Barcode</label>
                    <Input
                      placeholder="e.g., SKU-12345"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="text-lg h-12"
                    />
                  </div>
                  <Button type="submit" className="w-full h-12">
                    <Package className="mr-2 h-4 w-4" />
                    Look Up Item
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Scan Result */}
        {scanResult.type && (
          <Card className={scanResult.type === "success" ? "border-emerald-500" : "border-red-500"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {scanResult.type === "success" ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                {scanResult.message}
              </CardTitle>
            </CardHeader>
            {scanResult.data && (
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">SKU</span>
                  <span className="font-mono font-medium">{scanResult.data.sku}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="font-medium">{scanResult.data.name}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Location</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {scanResult.data.location}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Quantity</span>
                  <span className="font-medium">{scanResult.data.quantity}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button variant="outline">Update Qty</Button>
                  <Button variant="outline">Move Item</Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Recent Scans */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { sku: "SKU-001", time: "2 min ago", location: "A-101" },
                { sku: "SKU-002", time: "15 min ago", location: "B-203" },
                { sku: "SKU-003", time: "1 hr ago", location: "C-105" },
              ].map((scan, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-mono text-sm font-medium">{scan.sku}</p>
                    <p className="text-xs text-muted-foreground">{scan.time}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{scan.location}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
