"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Save,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Box,
  Truck,
  MapPin,
  Wrench,
  Users,
  AlertTriangle,
  Sun,
  Ruler,
  Settings,
  Home,
  Plus,
  RotateCw,
  Trash2,
  Copy,
  Lock,
  Unlock,
  DoorOpen,
  Square,
  Layers,
  Target,
  Calculator,
  Info,
} from "lucide-react"

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================
// Unit system: Imperial (feet/inches) for US market
// Coordinates stored in PIXELS, converted to feet for display

const PIXELS_PER_FOOT = 10  // 10 pixels = 1 foot
const GRID_SIZE_PX = PIXELS_PER_FOOT  // 1 foot grid
const SNAP_SIZE_PX = PIXELS_PER_FOOT / 2  // 6 inch snap

// Default warehouse: 100ft x 80ft = 1000px x 800px
const DEFAULT_VERTICES = [
  { id: "v1", x: 100, y: 100 },      // top-left (offset by 100px margin)
  { id: "v2", x: 1100, y: 100 },     // top-right (100ft = 1000px)
  { id: "v3", x: 1100, y: 900 },     // bottom-right (80ft = 800px)
  { id: "v4", x: 100, y: 900 },      // bottom-left
]

// OSHA Compliant Placement Rules (reference values in feet)
// wallClearance: 1.5 ft, mainAisleWidth: 12 ft, crossAisleWidth: 10 ft
// dockAreaDepth: 14 ft, fireExitClearance: 6 ft

// Colors
const COLORS = {
  background: "#0f172a",
  wall: "#64748b",
  wallSelected: "#3b82f6",
  wallHover: "#60a5fa",
  floor: "#1e293b",
  floorFill: "#334155",
  grid: "#334155",
  gridMajor: "#475569",
  vertex: "#3b82f6",
  vertexHover: "#60a5fa",
  vertexSelected: "#22c55e",
  collision: "#ef4444",
  valid: "#22c55e",
  measurement: "#f8fafc",
  measurementBg: "rgba(0, 0, 0, 0.75)",
}

// ============================================================================
// EQUIPMENT CATALOG
// ============================================================================

interface CatalogItem {
  id: string
  name: string
  category: string
  width: number   // feet
  depth: number   // feet
  height: number  // feet
  color: string
  icon: string
  palletCapacity?: number
  description?: string
}

const EQUIPMENT_CATALOG: Record<string, CatalogItem[]> = {
  racking: [
    { id: "selective_rack", name: "Selective Pallet Rack", category: "racking", width: 4, depth: 4, height: 16, color: "#f97316", icon: "📦", palletCapacity: 12, description: "Standard pallet racking" },
    { id: "drive_in_rack", name: "Drive-In Rack", category: "racking", width: 10, depth: 4, height: 18, color: "#ea580c", icon: "📦", palletCapacity: 24, description: "High-density storage" },
    { id: "push_back_rack", name: "Push-Back Rack", category: "racking", width: 8, depth: 4, height: 16, color: "#c2410c", icon: "📦", palletCapacity: 16, description: "LIFO storage system" },
    { id: "cantilever_rack", name: "Cantilever Rack", category: "racking", width: 12, depth: 4, height: 10, color: "#9a3412", icon: "📦", description: "For long items" },
    { id: "carton_flow_rack", name: "Carton Flow Rack", category: "racking", width: 8, depth: 3, height: 7, color: "#7c2d12", icon: "📦", description: "FIFO picking" },
  ],
  loading: [
    { id: "dock_leveler", name: "Dock Leveler", category: "loading", width: 8, depth: 6, height: 0.5, color: "#6366f1", icon: "🚛", description: "Truck loading bay" },
    { id: "loading_ramp", name: "Loading Ramp", category: "loading", width: 10, depth: 12, height: 1, color: "#4f46e5", icon: "🚛", description: "Ground-level loading" },
    { id: "staging_area", name: "Staging Area", category: "loading", width: 20, depth: 15, height: 0, color: "#fed7aa", icon: "📍", description: "Temporary storage zone" },
    { id: "cross_dock", name: "Cross-Dock Zone", category: "loading", width: 25, depth: 20, height: 0, color: "#fbbf24", icon: "🔄", description: "Direct transfer zone" },
  ],
  zones: [
    { id: "bulk_storage", name: "Bulk Storage Zone", category: "zones", width: 30, depth: 20, height: 0, color: "#93c5fd", icon: "📍", description: "Large item storage" },
    { id: "picking_area", name: "Picking Area", category: "zones", width: 15, depth: 10, height: 0, color: "#86efac", icon: "🎯", description: "Order picking zone" },
    { id: "packing_station", name: "Packing Station", category: "zones", width: 5, depth: 3, height: 3, color: "#7dd3fc", icon: "📦", description: "Packing workstation" },
    { id: "returns_area", name: "Returns Area", category: "zones", width: 10, depth: 8, height: 0, color: "#fca5a5", icon: "↩️", description: "Returns processing" },
    { id: "hazmat_storage", name: "Hazmat Storage", category: "zones", width: 10, depth: 10, height: 0, color: "#fda4af", icon: "☣️", description: "Hazardous materials" },
  ],
  equipment: [
    { id: "forklift_charger", name: "Forklift Charging Station", category: "equipment", width: 7, depth: 5, height: 4, color: "#10b981", icon: "🔋", description: "EV charging" },
    { id: "fire_extinguisher", name: "Fire Extinguisher Cabinet", category: "equipment", width: 3, depth: 1, height: 4, color: "#ef4444", icon: "🧯", description: "Fire safety" },
    { id: "electrical_panel", name: "Electrical Panel", category: "equipment", width: 2, depth: 1.5, height: 5, color: "#6b7280", icon: "⚡", description: "Power distribution" },
    { id: "hvac_unit", name: "HVAC Unit", category: "equipment", width: 6, depth: 6, height: 8, color: "#06b6d4", icon: "❄️", description: "Climate control" },
  ],
  personnel: [
    { id: "office_area", name: "Office Area", category: "personnel", width: 15, depth: 12, height: 10, color: "#a78bfa", icon: "🏢", description: "Administrative office" },
    { id: "break_room", name: "Break Room", category: "personnel", width: 12, depth: 10, height: 10, color: "#f472b6", icon: "☕", description: "Employee rest area" },
    { id: "restroom", name: "Restroom", category: "personnel", width: 8, depth: 6, height: 10, color: "#60a5fa", icon: "🚻", description: "Facilities" },
    { id: "locker_room", name: "Locker Room", category: "personnel", width: 10, depth: 8, height: 10, color: "#34d399", icon: "🔐", description: "Employee lockers" },
    { id: "first_aid", name: "First Aid Station", category: "personnel", width: 4, depth: 3, height: 4, color: "#f87171", icon: "🏥", description: "Medical supplies" },
  ],
  safety: [
    { id: "aisle_marking", name: "Aisle Marking", category: "safety", width: 12, depth: 0.5, height: 0, color: "#fbbf24", icon: "〰️", description: "Floor marking" },
    { id: "pedestrian_crossing", name: "Pedestrian Crossing", category: "safety", width: 6, depth: 4, height: 0, color: "#f59e0b", icon: "🚶", description: "Zebra crossing" },
    { id: "forklift_path", name: "Forklift Path", category: "safety", width: 10, depth: 0.5, height: 0, color: "#eab308", icon: "🚜", description: "Vehicle route" },
    { id: "hazard_zone", name: "Hazard Zone", category: "safety", width: 8, depth: 8, height: 0, color: "#dc2626", icon: "⚠️", description: "Danger area" },
    { id: "fire_exit_route", name: "Fire Exit Route", category: "safety", width: 4, depth: 0.5, height: 0, color: "#22c55e", icon: "🚨", description: "Emergency path" },
  ],
  pallets: [
    { id: "euro_pallet", name: "Euro Pallet (80×120 cm)", category: "pallets", width: 2.62, depth: 3.94, height: 0.47, color: "#d97706", icon: "📦", description: "EU Standard" },
    { id: "gma_pallet", name: "GMA Pallet (48\"×40\")", category: "pallets", width: 4, depth: 3.33, height: 0.5, color: "#b45309", icon: "📦", description: "US Standard" },
    { id: "half_pallet", name: "Half Pallet (40×60 cm)", category: "pallets", width: 1.31, depth: 1.97, height: 0.47, color: "#92400e", icon: "📦", description: "Smaller items" },
  ],
}

const DOOR_TYPES = [
  { id: "dock_door", name: "Dock Door", width: 10, icon: "🚛" },
  { id: "personnel_door", name: "Personnel Door", width: 3.5, icon: "🚪" },
  { id: "emergency_exit", name: "Emergency Exit", width: 4, icon: "🚨" },
  { id: "rollup_door", name: "Roll-Up Industrial Door", width: 14, icon: "⬛" },
]

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  shapes: <Home className="w-5 h-5" />,
  racking: <Box className="w-5 h-5" />,
  loading: <Truck className="w-5 h-5" />,
  zones: <MapPin className="w-5 h-5" />,
  equipment: <Wrench className="w-5 h-5" />,
  personnel: <Users className="w-5 h-5" />,
  safety: <AlertTriangle className="w-5 h-5" />,
  lighting: <Sun className="w-5 h-5" />,
  measure: <Ruler className="w-5 h-5" />,
  settings: <Settings className="w-5 h-5" />,
  pallets: <Layers className="w-5 h-5" />,
  doors: <DoorOpen className="w-5 h-5" />,
}

// ============================================================================
// TYPES
// ============================================================================

interface Vertex {
  id: string
  x: number  // pixels
  y: number  // pixels
}

interface Wall {
  id: string
  from: string
  to: string
  lengthPx: number
  lengthFt: number
}

interface PlacedItem {
  id: string
  itemId: string
  x: number       // pixels
  y: number       // pixels
  widthPx: number
  depthPx: number
  widthFt: number
  depthFt: number
  height: number  // feet
  rotation: number
  color: string
  name: string
  locked: boolean
}

interface Door {
  id: string
  type: string
  wallId: string
  position: number
  width: number
}

interface WarehouseData {
  id: string
  name: string
  ceilingHeight: number
  vertices: Vertex[]
  walls: Wall[]
  items: PlacedItem[]
  doors: Door[]
}

interface FloorPlanEditorProps {
  warehouseId: string
  warehouseName?: string
  initialData?: WarehouseData
  onSave?: (data: WarehouseData) => void
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function pxToFeet(px: number): number {
  return px / PIXELS_PER_FOOT
}

function feetToPx(feet: number): number {
  return feet * PIXELS_PER_FOOT
}

function formatFeetInches(feet: number): string {
  if (!isFinite(feet) || isNaN(feet)) return "0 ft"
  const wholeFeet = Math.floor(feet)
  const inches = Math.round((feet - wholeFeet) * 12)
  if (inches === 0 || inches === 12) return `${inches === 12 ? wholeFeet + 1 : wholeFeet} ft`
  if (wholeFeet === 0) return `${inches} in`
  return `${wholeFeet}' ${inches}"`
}

function snapToGrid(value: number): number {
  return Math.round(value / SNAP_SIZE_PX) * SNAP_SIZE_PX
}

function getDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

function getWallAngle(from: Vertex, to: Vertex): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

function isPointInPolygon(point: { x: number; y: number }, vertices: Vertex[]): boolean {
  if (!vertices || vertices.length < 3) return false
  
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y
    const xj = vertices[j].x, yj = vertices[j].y
    
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

function checkCollision(item1: PlacedItem, item2: PlacedItem): boolean {
  const r1 = {
    left: item1.x,
    right: item1.x + item1.widthPx,
    top: item1.y,
    bottom: item1.y + item1.depthPx,
  }
  const r2 = {
    left: item2.x,
    right: item2.x + item2.widthPx,
    top: item2.y,
    bottom: item2.y + item2.depthPx,
  }
  
  return !(r1.left >= r2.right || r1.right <= r2.left || r1.top >= r2.bottom || r1.bottom <= r2.top)
}

// Shoelace formula for polygon area (in pixels)
function calculatePolygonAreaPx(vertices: Vertex[]): number {
  if (!vertices || vertices.length < 3) return 0
  
  let area = 0
  const n = vertices.length
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += vertices[i].x * vertices[j].y
    area -= vertices[j].x * vertices[i].y
  }
  
  return Math.abs(area / 2)
}

// Convert pixel area to square feet
function calculatePolygonAreaSqFt(vertices: Vertex[]): number {
  const areaPx = calculatePolygonAreaPx(vertices)
  return areaPx / (PIXELS_PER_FOOT * PIXELS_PER_FOOT)
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FloorPlanEditor({ warehouseId, warehouseName, initialData, onSave }: FloorPlanEditorProps) {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d")
  const [activeCategory, setActiveCategory] = useState("racking")
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [showMeasurements, setShowMeasurements] = useState(true)
  
  const [ceilingHeight, setCeilingHeight] = useState(28)
  const [vertices, setVertices] = useState<Vertex[]>(DEFAULT_VERTICES)
  const [items, setItems] = useState<PlacedItem[]>([])
  const [doors, setDoors] = useState<Door[]>([])
  
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null)
  const [editingWallLength, setEditingWallLength] = useState<string>("")
  
  const [draggedCatalogItem, setDraggedCatalogItem] = useState<CatalogItem | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [isValidPlacement, setIsValidPlacement] = useState(true)
  
  const [isDraggingVertex, setIsDraggingVertex] = useState(false)
  const [isDraggingItem, setIsDraggingItem] = useState(false)
  
  const [history, setHistory] = useState<{ vertices: Vertex[]; items: PlacedItem[] }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  
  const [saving, setSaving] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // -------------------------------------------------------------------------
  // Derived State
  // -------------------------------------------------------------------------
  const walls = useMemo((): Wall[] => {
    if (!vertices || vertices.length < 2) return []
    
    const result: Wall[] = []
    for (let i = 0; i < vertices.length; i++) {
      const from = vertices[i]
      const to = vertices[(i + 1) % vertices.length]
      const lengthPx = getDistance(from, to)
      result.push({
        id: `wall_${from.id}_${to.id}`,
        from: from.id,
        to: to.id,
        lengthPx,
        lengthFt: pxToFeet(lengthPx),
      })
    }
    return result
  }, [vertices])
  
  const totalAreaSqFt = useMemo(() => {
    const area = calculatePolygonAreaSqFt(vertices)
    return isFinite(area) && !isNaN(area) ? area : 0
  }, [vertices])
  
  const itemsAreaSqFt = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.widthFt * item.depthFt), 0)
  }, [items])
  
  const openAreaSqFt = useMemo(() => {
    return Math.max(0, totalAreaSqFt - itemsAreaSqFt)
  }, [totalAreaSqFt, itemsAreaSqFt])
  
  const utilizationRate = useMemo(() => {
    if (totalAreaSqFt === 0) return 0
    const rate = (itemsAreaSqFt / totalAreaSqFt) * 100
    return isFinite(rate) && !isNaN(rate) ? rate : 0
  }, [totalAreaSqFt, itemsAreaSqFt])
  
  const palletCapacity = useMemo(() => {
    return items.reduce((sum, item) => {
      const catalogItem = Object.values(EQUIPMENT_CATALOG).flat().find(c => c.id === item.itemId)
      return sum + (catalogItem?.palletCapacity || 0)
    }, 0)
  }, [items])
  
  // -------------------------------------------------------------------------
  // History Management
  // -------------------------------------------------------------------------
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ vertices: [...vertices], items: [...items] })
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex, vertices, items])
  
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setVertices(prevState.vertices)
      setItems(prevState.items)
      setHistoryIndex(historyIndex - 1)
    }
  }, [history, historyIndex])
  
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setVertices(nextState.vertices)
      setItems(nextState.items)
      setHistoryIndex(historyIndex + 1)
    }
  }, [history, historyIndex])
  
  // -------------------------------------------------------------------------
  // Canvas Drawing
  // -------------------------------------------------------------------------
  const draw2D = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    const { width, height } = canvas
    
    // Apply zoom transform
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0)
    const scaledWidth = width / zoom
    const scaledHeight = height / zoom
    
    // Clear and draw background
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, scaledWidth, scaledHeight)
    
    // Draw grid
    if (showGrid) {
      // Minor grid (1 foot)
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.3
      
      for (let x = 0; x <= scaledWidth; x += GRID_SIZE_PX) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, scaledHeight)
        ctx.stroke()
      }
      for (let y = 0; y <= scaledHeight; y += GRID_SIZE_PX) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(scaledWidth, y)
        ctx.stroke()
      }
      
      // Major grid (10 feet)
      ctx.strokeStyle = COLORS.gridMajor
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      
      for (let x = 0; x <= scaledWidth; x += GRID_SIZE_PX * 10) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, scaledHeight)
        ctx.stroke()
      }
      for (let y = 0; y <= scaledHeight; y += GRID_SIZE_PX * 10) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(scaledWidth, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    
    // Draw floor polygon (filled area)
    if (vertices.length >= 3) {
      ctx.beginPath()
      ctx.moveTo(vertices[0].x, vertices[0].y)
      for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y)
      }
      ctx.closePath()
      
      // Fill floor
      ctx.fillStyle = COLORS.floorFill
      ctx.globalAlpha = 0.8
      ctx.fill()
      ctx.globalAlpha = 1
    }
    
    // Draw walls with thickness
    walls.forEach((wall) => {
      const from = vertices.find(v => v.id === wall.from)
      const to = vertices.find(v => v.id === wall.to)
      if (!from || !to) return
      
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.strokeStyle = selectedWallId === wall.id ? COLORS.wallSelected : COLORS.wall
      ctx.lineWidth = selectedWallId === wall.id ? 6 : 4
      ctx.lineCap = "round"
      ctx.stroke()
      
      // Wall dimension labels
      if (showMeasurements) {
        const midX = (from.x + to.x) / 2
        const midY = (from.y + to.y) / 2
        const angle = Math.atan2(to.y - from.y, to.x - from.x)
        
        // Offset label perpendicular to wall
        const offsetDist = 20
        const offsetX = midX - Math.sin(angle) * offsetDist
        const offsetY = midY + Math.cos(angle) * offsetDist
        
        const text = formatFeetInches(wall.lengthFt)
        ctx.font = "bold 12px Inter, system-ui, sans-serif"
        const textWidth = ctx.measureText(text).width
        
        // Draw label background
        ctx.fillStyle = COLORS.measurementBg
        ctx.fillRect(offsetX - textWidth / 2 - 6, offsetY - 10, textWidth + 12, 20)
        
        // Draw label text
        ctx.fillStyle = COLORS.measurement
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(text, offsetX, offsetY)
      }
    })
    
    // Draw doors
    doors.forEach(door => {
      const wall = walls.find(w => w.id === door.wallId)
      if (!wall) return
      
      const from = vertices.find(v => v.id === wall.from)
      const to = vertices.find(v => v.id === wall.to)
      if (!from || !to) return
      
      const doorX = from.x + (to.x - from.x) * door.position
      const doorY = from.y + (to.y - from.y) * door.position
      const angle = getWallAngle(from, to)
      const doorWidthPx = feetToPx(door.width)
      
      ctx.save()
      ctx.translate(doorX, doorY)
      ctx.rotate(angle)
      
      // Draw door opening (break in wall)
      ctx.fillStyle = COLORS.background
      ctx.fillRect(-doorWidthPx / 2, -6, doorWidthPx, 12)
      
      // Draw door frame
      ctx.strokeStyle = "#fbbf24"
      ctx.lineWidth = 2
      ctx.strokeRect(-doorWidthPx / 2, -6, doorWidthPx, 12)
      
      ctx.restore()
      
      // Door icon
      const doorType = DOOR_TYPES.find(d => d.id === door.type)
      if (doorType) {
        ctx.font = "16px sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(doorType.icon, doorX, doorY - 20)
      }
    })
    
    // Draw placed items
    items.forEach(item => {
      const isSelected = selectedItemId === item.id
      
      ctx.save()
      ctx.translate(item.x + item.widthPx / 2, item.y + item.depthPx / 2)
      ctx.rotate((item.rotation * Math.PI) / 180)
      
      // Item fill
      ctx.fillStyle = item.color
      ctx.globalAlpha = isSelected ? 1 : 0.85
      ctx.fillRect(-item.widthPx / 2, -item.depthPx / 2, item.widthPx, item.depthPx)
      
      // Item border
      ctx.strokeStyle = isSelected ? "#fff" : "rgba(0,0,0,0.4)"
      ctx.lineWidth = isSelected ? 3 : 1
      ctx.strokeRect(-item.widthPx / 2, -item.depthPx / 2, item.widthPx, item.depthPx)
      ctx.globalAlpha = 1
      
      // Item label
      ctx.fillStyle = "#fff"
      ctx.font = "bold 10px Inter, system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      
      let displayName = item.name
      const maxWidth = item.widthPx - 10
      while (ctx.measureText(displayName).width > maxWidth && displayName.length > 3) {
        displayName = displayName.slice(0, -4) + "..."
      }
      
      // Text shadow for readability
      ctx.fillStyle = "rgba(0,0,0,0.5)"
      ctx.fillText(displayName, 1, 1)
      ctx.fillStyle = "#fff"
      ctx.fillText(displayName, 0, 0)
      
      // Lock indicator
      if (item.locked) {
        ctx.fillText("🔒", 0, item.depthPx / 2 - 12)
      }
      
      ctx.restore()
    })
    
    // Draw dragging item preview
    if (draggedCatalogItem && dragPosition) {
      const widthPx = feetToPx(draggedCatalogItem.width)
      const depthPx = feetToPx(draggedCatalogItem.depth)
      
      ctx.fillStyle = isValidPlacement ? COLORS.valid : COLORS.collision
      ctx.globalAlpha = 0.5
      ctx.fillRect(dragPosition.x, dragPosition.y, widthPx, depthPx)
      
      ctx.strokeStyle = isValidPlacement ? COLORS.valid : COLORS.collision
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(dragPosition.x, dragPosition.y, widthPx, depthPx)
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }
    
    // Draw vertex handles (on top of everything)
    vertices.forEach(v => {
      const isSelected = selectedVertexId === v.id
      const radius = isSelected ? 10 : 8
      
      // Outer ring
      ctx.beginPath()
      ctx.arc(v.x, v.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? COLORS.vertexSelected : COLORS.vertex
      ctx.fill()
      
      // White border
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Inner dot
      ctx.beginPath()
      ctx.arc(v.x, v.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.fill()
    })
    
    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }, [vertices, walls, items, doors, selectedVertexId, selectedItemId, selectedWallId, 
      draggedCatalogItem, dragPosition, isValidPlacement, zoom, showGrid, showMeasurements])
  
  // -------------------------------------------------------------------------
  // Canvas Event Handlers
  // -------------------------------------------------------------------------
  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    }
  }, [zoom])
  
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e)
    
    // Check vertex click (with larger hit area)
    for (const v of vertices) {
      if (getDistance(pos, v) < 15) {
        setSelectedVertexId(v.id)
        setSelectedItemId(null)
        setSelectedWallId(null)
        setIsDraggingVertex(true)
        return
      }
    }
    
    // Check item click
    for (const item of items) {
      if (pos.x >= item.x && pos.x <= item.x + item.widthPx &&
          pos.y >= item.y && pos.y <= item.y + item.depthPx) {
        setSelectedItemId(item.id)
        setSelectedVertexId(null)
        setSelectedWallId(null)
        if (!item.locked) {
          setIsDraggingItem(true)
        }
        return
      }
    }
    
    // Check wall click
    for (const wall of walls) {
      const from = vertices.find(v => v.id === wall.from)
      const to = vertices.find(v => v.id === wall.to)
      if (!from || !to) continue
      
      // Point to line distance calculation
      const A = pos.x - from.x
      const B = pos.y - from.y
      const C = to.x - from.x
      const D = to.y - from.y
      
      const dot = A * C + B * D
      const lenSq = C * C + D * D
      let param = -1
      if (lenSq !== 0) param = dot / lenSq
      
      let nearestX, nearestY
      if (param < 0) {
        nearestX = from.x
        nearestY = from.y
      } else if (param > 1) {
        nearestX = to.x
        nearestY = to.y
      } else {
        nearestX = from.x + param * C
        nearestY = from.y + param * D
      }
      
      const distance = getDistance(pos, { x: nearestX, y: nearestY })
      if (distance < 10) {
        setSelectedWallId(wall.id)
        setEditingWallLength(formatFeetInches(wall.lengthFt))
        setSelectedVertexId(null)
        setSelectedItemId(null)
        return
      }
    }
    
    // Click on empty space - deselect all
    setSelectedVertexId(null)
    setSelectedItemId(null)
    setSelectedWallId(null)
  }, [vertices, items, walls, getMousePos])
  
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e)
    const snappedPos = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) }
    
    // Dragging vertex
    if (isDraggingVertex && selectedVertexId) {
      setVertices(prev => prev.map(v => 
        v.id === selectedVertexId ? { ...v, x: snappedPos.x, y: snappedPos.y } : v
      ))
      return
    }
    
    // Dragging item
    if (isDraggingItem && selectedItemId) {
      const item = items.find(i => i.id === selectedItemId)
      if (item && !item.locked) {
        setItems(prev => prev.map(i =>
          i.id === selectedItemId ? { ...i, x: snappedPos.x, y: snappedPos.y } : i
        ))
      }
      return
    }
    
    // Dragging from catalog
    if (draggedCatalogItem) {
      setDragPosition(snappedPos)
      
      const widthPx = feetToPx(draggedCatalogItem.width)
      const depthPx = feetToPx(draggedCatalogItem.depth)
      
      // Check collision with existing items
      const tempItem: PlacedItem = {
        id: "temp",
        itemId: draggedCatalogItem.id,
        x: snappedPos.x,
        y: snappedPos.y,
        widthPx,
        depthPx,
        widthFt: draggedCatalogItem.width,
        depthFt: draggedCatalogItem.depth,
        height: draggedCatalogItem.height,
        rotation: 0,
        color: draggedCatalogItem.color,
        name: draggedCatalogItem.name,
        locked: false,
      }
      
      const hasCollision = items.some(item => checkCollision(tempItem, item))
      
      // Check if inside warehouse
      const corners = [
        snappedPos,
        { x: snappedPos.x + widthPx, y: snappedPos.y },
        { x: snappedPos.x + widthPx, y: snappedPos.y + depthPx },
        { x: snappedPos.x, y: snappedPos.y + depthPx },
      ]
      const isInside = corners.every(corner => isPointInPolygon(corner, vertices))
      
      setIsValidPlacement(!hasCollision && isInside)
    }
  }, [isDraggingVertex, isDraggingItem, selectedVertexId, selectedItemId, 
      draggedCatalogItem, items, vertices, getMousePos])
  
  const handleCanvasMouseUp = useCallback(() => {
    if (isDraggingVertex || isDraggingItem) {
      saveToHistory()
    }
    
    // Drop catalog item
    if (draggedCatalogItem && dragPosition && isValidPlacement) {
      const widthPx = feetToPx(draggedCatalogItem.width)
      const depthPx = feetToPx(draggedCatalogItem.depth)
      
      const newItem: PlacedItem = {
        id: generateId(),
        itemId: draggedCatalogItem.id,
        x: dragPosition.x,
        y: dragPosition.y,
        widthPx,
        depthPx,
        widthFt: draggedCatalogItem.width,
        depthFt: draggedCatalogItem.depth,
        height: draggedCatalogItem.height,
        rotation: 0,
        color: draggedCatalogItem.color,
        name: draggedCatalogItem.name,
        locked: false,
      }
      setItems(prev => [...prev, newItem])
      saveToHistory()
    }
    
    setDraggedCatalogItem(null)
    setDragPosition(null)
    setIsDraggingVertex(false)
    setIsDraggingItem(false)
  }, [isDraggingVertex, isDraggingItem, draggedCatalogItem, dragPosition, isValidPlacement, saveToHistory])
  
  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.25, Math.min(3, prev * delta)))
  }, [])
  
  // -------------------------------------------------------------------------
  // Item Actions
  // -------------------------------------------------------------------------
  const rotateSelectedItem = useCallback(() => {
    if (!selectedItemId) return
    setItems(prev => prev.map(item =>
      item.id === selectedItemId ? { 
        ...item, 
        rotation: (item.rotation + 90) % 360,
        // Swap width and depth
        widthPx: item.depthPx,
        depthPx: item.widthPx,
        widthFt: item.depthFt,
        depthFt: item.widthFt,
      } : item
    ))
    saveToHistory()
  }, [selectedItemId, saveToHistory])
  
  const deleteSelectedItem = useCallback(() => {
    if (!selectedItemId) return
    setItems(prev => prev.filter(item => item.id !== selectedItemId))
    setSelectedItemId(null)
    saveToHistory()
  }, [selectedItemId, saveToHistory])
  
  const toggleItemLock = useCallback(() => {
    if (!selectedItemId) return
    setItems(prev => prev.map(item =>
      item.id === selectedItemId ? { ...item, locked: !item.locked } : item
    ))
  }, [selectedItemId])
  
  const duplicateSelectedItem = useCallback(() => {
    if (!selectedItemId) return
    const item = items.find(i => i.id === selectedItemId)
    if (!item) return
    
    const newItem: PlacedItem = {
      ...item,
      id: generateId(),
      x: item.x + 20,
      y: item.y + 20,
      locked: false,
    }
    setItems(prev => [...prev, newItem])
    setSelectedItemId(newItem.id)
    saveToHistory()
  }, [selectedItemId, items, saveToHistory])
  
  // -------------------------------------------------------------------------
  // Wall Actions
  // -------------------------------------------------------------------------
  const updateWallLength = useCallback(() => {
    if (!selectedWallId) return
    
    // Parse the input (e.g., "50 ft", "50' 6\"", "50.5")
    const match = editingWallLength.match(/(\d+(?:\.\d+)?)\s*(?:ft|')?(?:\s*(\d+)\s*(?:in|")?)?/)
    if (!match) return
    
    let newLengthFt = parseFloat(match[1]) || 0
    if (match[2]) newLengthFt += parseInt(match[2]) / 12
    
    if (newLengthFt < 4) return // Minimum 4 feet
    
    const wall = walls.find(w => w.id === selectedWallId)
    if (!wall) return
    
    const fromVertex = vertices.find(v => v.id === wall.from)
    const toVertex = vertices.find(v => v.id === wall.to)
    if (!fromVertex || !toVertex) return
    
    const angle = getWallAngle(fromVertex, toVertex)
    const newLengthPx = feetToPx(newLengthFt)
    const newX = fromVertex.x + newLengthPx * Math.cos(angle)
    const newY = fromVertex.y + newLengthPx * Math.sin(angle)
    
    setVertices(prev => prev.map(v =>
      v.id === wall.to ? { ...v, x: snapToGrid(newX), y: snapToGrid(newY) } : v
    ))
    saveToHistory()
    setSelectedWallId(null)
  }, [selectedWallId, editingWallLength, walls, vertices, saveToHistory])
  
  const addVertexToWall = useCallback(() => {
    if (!selectedWallId) return
    
    const wall = walls.find(w => w.id === selectedWallId)
    if (!wall) return
    
    const fromVertex = vertices.find(v => v.id === wall.from)
    const toVertex = vertices.find(v => v.id === wall.to)
    if (!fromVertex || !toVertex) return
    
    const fromIndex = vertices.findIndex(v => v.id === wall.from)
    
    const newVertex: Vertex = {
      id: generateId(),
      x: (fromVertex.x + toVertex.x) / 2,
      y: (fromVertex.y + toVertex.y) / 2,
    }
    
    const newVertices = [...vertices]
    newVertices.splice(fromIndex + 1, 0, newVertex)
    setVertices(newVertices)
    saveToHistory()
    setSelectedWallId(null)
  }, [selectedWallId, walls, vertices, saveToHistory])
  
  // -------------------------------------------------------------------------
  // Save/Load
  // -------------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!onSave) return
    
    setSaving(true)
    try {
      const data: WarehouseData = {
        id: warehouseId,
        name: warehouseName || "Warehouse",
        ceilingHeight,
        vertices,
        walls,
        items,
        doors,
      }
      await onSave(data)
    } catch (error) {
      console.error("Failed to save floor plan:", error)
    } finally {
      setSaving(false)
    }
  }, [warehouseId, warehouseName, ceilingHeight, vertices, walls, items, doors, onSave])
  
  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------
  
  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }
    
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [])
  
  // Draw on state change
  useEffect(() => {
    draw2D()
  }, [draw2D])
  
  // Load initial data
  useEffect(() => {
    if (initialData) {
      if (initialData.vertices && initialData.vertices.length >= 3) {
        setVertices(initialData.vertices)
      }
      if (initialData.items) {
        setItems(initialData.items)
      }
      if (initialData.doors) {
        setDoors(initialData.doors)
      }
      if (initialData.ceilingHeight) {
        setCeilingHeight(initialData.ceilingHeight)
      }
    }
  }, [initialData])
  
  // Initialize history
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{ vertices: [...vertices], items: [...items] }])
      setHistoryIndex(0)
    }
  }, [])
  
  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const selectedItem = selectedItemId ? items.find(i => i.id === selectedItemId) : null
  const selectedWall = selectedWallId ? walls.find(w => w.id === selectedWallId) : null
  
  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] bg-slate-900 rounded-lg overflow-hidden">
      {/* Left Sidebar - Category Icons */}
      <div className="w-14 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-4 gap-2">
        <TooltipProvider>
          {Object.entries(CATEGORY_ICONS).map(([key, icon]) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveCategory(key)}
                  className={`p-2 rounded-lg transition-colors ${
                    activeCategory === key
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="capitalize">{key}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
      
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-12 bg-slate-800 border-b border-slate-700 flex items-center px-4 gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="text-slate-300 hover:text-white"
          >
            <Save className="w-4 h-4 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
          
          <Separator orientation="vertical" className="h-6 bg-slate-600" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={historyIndex <= 0}
            className="text-slate-300 hover:text-white"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="text-slate-300 hover:text-white"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6 bg-slate-600" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            className={`text-slate-300 hover:text-white ${showGrid ? "bg-slate-700" : ""}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMeasurements(!showMeasurements)}
            className={`text-slate-300 hover:text-white ${showMeasurements ? "bg-slate-700" : ""}`}
          >
            <Ruler className="w-4 h-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6 bg-slate-600" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(z => Math.min(3, z * 1.2))}
            className="text-slate-300 hover:text-white"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <span className="text-slate-400 text-sm min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(z => Math.max(0.25, z * 0.8))}
            className="text-slate-300 hover:text-white"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <div className="flex-1" />
          
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-1">
              <Calculator className="w-4 h-4" />
              <span>{totalAreaSqFt.toLocaleString(undefined, { maximumFractionDigits: 0 })} sq ft</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="w-4 h-4" />
              <span>{utilizationRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <Layers className="w-4 h-4" />
              <span>{palletCapacity} pallets</span>
            </div>
          </div>
          
          <Separator orientation="vertical" className="h-6 bg-slate-600" />
          
          {/* View Toggle */}
          <div className="flex bg-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("2d")}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === "2d" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              2D
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === "3d" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              3D
            </button>
          </div>
        </div>
        
        {/* Canvas Container */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          {viewMode === "2d" ? (
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onWheel={handleCanvasWheel}
              className="w-full h-full cursor-crosshair"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-800">
              <div className="text-center text-slate-400">
                <Box className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">3D View</p>
                <p className="text-sm">Coming soon - use 2D view for now</p>
              </div>
            </div>
          )}
          
          {/* Floating Item Properties Panel */}
          {selectedItem && (
            <Card className="absolute top-4 left-4 w-64 bg-slate-800 border-slate-700 shadow-xl">
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-white flex items-center justify-between">
                  {selectedItem.name}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={rotateSelectedItem}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                    >
                      <RotateCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={duplicateSelectedItem}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleItemLock}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                    >
                      {selectedItem.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deleteSelectedItem}
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <Label className="text-slate-400">Width</Label>
                    <p className="text-white">{formatFeetInches(selectedItem.widthFt)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400">Depth</Label>
                    <p className="text-white">{formatFeetInches(selectedItem.depthFt)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400">Height</Label>
                    <p className="text-white">{formatFeetInches(selectedItem.height)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400">Rotation</Label>
                    <p className="text-white">{selectedItem.rotation}°</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Floating Wall Edit Panel */}
          {selectedWall && (
            <Card className="absolute top-4 left-4 w-64 bg-slate-800 border-slate-700 shadow-xl">
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-white">Edit Wall</CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-3">
                <div>
                  <Label className="text-slate-400 text-xs">Wall Length</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={editingWallLength}
                      onChange={(e) => setEditingWallLength(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && updateWallLength()}
                      placeholder="e.g., 50 ft or 50' 6&quot;"
                      className="bg-slate-700 border-slate-600 text-white text-sm"
                    />
                    <Button size="sm" onClick={updateWallLength}>
                      Apply
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addVertexToWall}
                  className="w-full border-slate-600 text-slate-300"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Corner Point
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Help Text */}
          <div className="absolute bottom-4 left-4 text-xs text-slate-500 bg-slate-800/80 px-3 py-2 rounded">
            <p><strong>Click</strong> corners to drag • <strong>Click</strong> walls to edit length • <strong>Scroll</strong> to zoom</p>
          </div>
        </div>
      </div>
      
      {/* Right Sidebar - Equipment Catalog */}
      <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-white font-medium capitalize">{activeCategory}</h3>
          <p className="text-slate-400 text-xs mt-1">Drag items to the floor plan</p>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {EQUIPMENT_CATALOG[activeCategory]?.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDraggedCatalogItem(item)}
                onDragEnd={() => {
                  setDraggedCatalogItem(null)
                  setDragPosition(null)
                }}
                className="bg-slate-700 rounded-lg p-3 cursor-grab hover:bg-slate-600 transition-colors group active:cursor-grabbing"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: item.color + "40" }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.name}</p>
                    <p className="text-slate-400 text-xs">
                      {formatFeetInches(item.width)} × {formatFeetInches(item.depth)}
                      {item.height > 0 && ` × ${formatFeetInches(item.height)}`}
                    </p>
                    {item.description && (
                      <p className="text-slate-500 text-xs mt-1 truncate">{item.description}</p>
                    )}
                    {item.palletCapacity && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {item.palletCapacity} pallets
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {activeCategory === "doors" && (
              <>
                <p className="text-slate-400 text-xs mb-2">Click on a wall first, then select door type</p>
                {DOOR_TYPES.map((door) => (
                  <div
                    key={door.id}
                    className={`bg-slate-700 rounded-lg p-3 transition-colors ${
                      selectedWallId 
                        ? "cursor-pointer hover:bg-slate-600" 
                        : "opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() => {
                      if (selectedWallId) {
                        setDoors(prev => [...prev, {
                          id: generateId(),
                          type: door.id,
                          wallId: selectedWallId,
                          position: 0.5,
                          width: door.width,
                        }])
                        setSelectedWallId(null)
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{door.icon}</span>
                      <div>
                        <p className="text-white text-sm font-medium">{door.name}</p>
                        <p className="text-slate-400 text-xs">{formatFeetInches(door.width)} wide</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            
            {activeCategory === "shapes" && (
              <div className="space-y-3">
                <p className="text-slate-400 text-xs">Warehouse Shape Templates</p>
                <Button
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 justify-start"
                  onClick={() => {
                    setVertices([
                      { id: "v1", x: 100, y: 100 },
                      { id: "v2", x: 1100, y: 100 },
                      { id: "v3", x: 1100, y: 900 },
                      { id: "v4", x: 100, y: 900 },
                    ])
                    saveToHistory()
                  }}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Rectangle (100×80 ft)
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 justify-start"
                  onClick={() => {
                    setVertices([
                      { id: "v1", x: 100, y: 100 },
                      { id: "v2", x: 700, y: 100 },
                      { id: "v3", x: 700, y: 500 },
                      { id: "v4", x: 1100, y: 500 },
                      { id: "v5", x: 1100, y: 900 },
                      { id: "v6", x: 100, y: 900 },
                    ])
                    saveToHistory()
                  }}
                >
                  <span className="mr-2">⌐</span>
                  L-Shape
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 justify-start"
                  onClick={() => {
                    setVertices([
                      { id: "v1", x: 100, y: 100 },
                      { id: "v2", x: 1100, y: 100 },
                      { id: "v3", x: 1100, y: 400 },
                      { id: "v4", x: 700, y: 400 },
                      { id: "v5", x: 700, y: 600 },
                      { id: "v6", x: 1100, y: 600 },
                      { id: "v7", x: 1100, y: 900 },
                      { id: "v8", x: 100, y: 900 },
                    ])
                    saveToHistory()
                  }}
                >
                  <span className="mr-2">⊏</span>
                  U-Shape
                </Button>
              </div>
            )}
            
            {activeCategory === "settings" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-400 text-xs">Ceiling Height (ft)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={ceilingHeight}
                      onChange={(e) => setCeilingHeight(parseFloat(e.target.value) || 28)}
                      className="bg-slate-700 border-slate-600 text-white text-sm"
                    />
                    <span className="text-slate-400 text-sm">ft</span>
                  </div>
                </div>
                
                <Separator className="bg-slate-600" />
                
                <div>
                  <Label className="text-slate-400 text-xs">OSHA Clearances (reference)</Label>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <p>• Wall clearance: 1.5 ft</p>
                    <p>• Main aisle: 12 ft</p>
                    <p>• Cross aisle: 10 ft</p>
                    <p>• Dock depth: 14 ft</p>
                    <p>• Fire exit: 6 ft</p>
                  </div>
                </div>
              </div>
            )}
            
            {activeCategory === "measure" && (
              <div className="space-y-4">
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Area</span>
                      <span className="text-white font-medium">
                        {totalAreaSqFt.toLocaleString(undefined, { maximumFractionDigits: 0 })} sq ft
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Equipment Area</span>
                      <span className="text-white font-medium">
                        {itemsAreaSqFt.toLocaleString(undefined, { maximumFractionDigits: 0 })} sq ft
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Open Area</span>
                      <span className="text-white font-medium">
                        {openAreaSqFt.toLocaleString(undefined, { maximumFractionDigits: 0 })} sq ft
                      </span>
                    </div>
                    <Separator className="bg-slate-600" />
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Utilization</span>
                      <span className="text-white font-medium">{utilizationRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Pallet Capacity</span>
                      <span className="text-white font-medium">{palletCapacity}</span>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="text-xs text-slate-500">
                  <p className="flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Walls: {walls.length}
                  </p>
                  <p className="flex items-center gap-1 mt-1">
                    <Info className="w-3 h-3" />
                    Items: {items.length}
                  </p>
                  <p className="flex items-center gap-1 mt-1">
                    <Info className="w-3 h-3" />
                    Doors: {doors.length}
                  </p>
                </div>
              </div>
            )}
            
            {!EQUIPMENT_CATALOG[activeCategory] && 
             activeCategory !== "doors" && 
             activeCategory !== "shapes" && 
             activeCategory !== "settings" &&
             activeCategory !== "measure" && (
              <div className="text-center text-slate-500 py-8">
                <p>No items in this category</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Save Confirmation Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Floor Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will save your current floor plan design. You can continue editing after saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>
              {saving ? "Saving..." : "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default FloorPlanEditor
