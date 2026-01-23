"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { saveFloorPlan, loadFloorPlan, loadAllFloors, deleteFloor } from '@/lib/actions/floor-plan'
import { exportToPNG, exportToPDF, export3DScreenshot } from '@/lib/utils/floor-plan-export'
import { useToast } from '@/lib/hooks/use-toast'

interface FloorInfo {
  id: string
  floorNumber: number
  name: string
  updatedAt: string
}

interface FloorArea {
  id: string
  name: string
  type: 'pallet-storage' | 'space-storage' | 'loading-dock' | 'staging' | 'office' | 'other'
  vertices: Vertex[]  // Polygon vertices (like warehouse boundary)
  color: string
  notes?: string
  rotation?: number  // Rotation angle in degrees
}

// Calculate polygon area using Shoelace formula
function calcPolygonArea(verts: Vertex[]): number {
  if (verts.length < 3) return 0
  let a = 0
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length
    a += verts[i].x * verts[j].y - verts[j].x * verts[i].y
  }
  return Math.abs(a / 2)
}

// Get polygon center for label placement
function getPolygonCenter(verts: Vertex[]): { x: number; y: number } {
  if (verts.length === 0) return { x: 0, y: 0 }
  const sumX = verts.reduce((s, v) => s + v.x, 0)
  const sumY = verts.reduce((s, v) => s + v.y, 0)
  return { x: sumX / verts.length, y: sumY / verts.length }
}

// Dynamic import to avoid SSR issues with Three.js
// Using simplified vanilla Three.js version for better compatibility
const FloorPlan3D = dynamic(() => import('./FloorPlan3DSimple'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-800 rounded-lg flex items-center justify-center">
      <div className="text-slate-400 flex flex-col items-center gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span>Loading 3D View...</span>
      </div>
    </div>
  )
})

const GRID_SIZE = 20 // pixels per foot
// Default canvas dimensions (will be updated dynamically)
const DEFAULT_CANVAS_W = 1200
const DEFAULT_CANVAS_H = 700

// Shape templates
const SHAPE_TEMPLATES = {
  rectangle: [
    { x: 2, y: 2 }, { x: 42, y: 2 }, { x: 42, y: 27 }, { x: 2, y: 27 }
  ],
  lShape: [
    { x: 2, y: 2 }, { x: 32, y: 2 }, { x: 32, y: 15 }, 
    { x: 22, y: 15 }, { x: 22, y: 27 }, { x: 2, y: 27 }
  ],
  uShape: [
    { x: 2, y: 2 }, { x: 42, y: 2 }, { x: 42, y: 27 }, { x: 32, y: 27 },
    { x: 32, y: 12 }, { x: 12, y: 12 }, { x: 12, y: 27 }, { x: 2, y: 27 }
  ],
  tShape: [
    { x: 12, y: 2 }, { x: 32, y: 2 }, { x: 32, y: 10 }, { x: 42, y: 10 },
    { x: 42, y: 20 }, { x: 32, y: 20 }, { x: 32, y: 27 }, { x: 12, y: 27 },
    { x: 12, y: 20 }, { x: 2, y: 20 }, { x: 2, y: 10 }, { x: 12, y: 10 }
  ]
}

// Equipment catalog
const CATALOG: Record<string, CatalogItem[]> = {
  racking: [
    { id: 'selective', name: 'Selective Rack', w: 4, h: 4, color: '#f97316', pallets: 12 },
    { id: 'drivein', name: 'Drive-In Rack', w: 10, h: 4, color: '#ef4444', pallets: 24 },
    { id: 'pushback', name: 'Push-Back Rack', w: 8, h: 4, color: '#8b5cf6', pallets: 16 },
    { id: 'cantilever', name: 'Cantilever Rack', w: 12, h: 4, color: '#9a3412', pallets: 8 },
    { id: 'cartonflow', name: 'Carton Flow Rack', w: 8, h: 3, color: '#7c2d12', pallets: 6 },
  ],
  doors: [
    { id: 'dock', name: 'Dock Door', w: 10, h: 1, color: '#3b82f6', pallets: 0, wallItem: true, doorHeight: 12 },
    { id: 'personnel', name: 'Personnel Door', w: 3.5, h: 1, color: '#6b7280', pallets: 0, wallItem: true, doorHeight: 7 },
    { id: 'rollup', name: 'Roll-Up Door', w: 14, h: 1, color: '#f59e0b', pallets: 0, wallItem: true, doorHeight: 14 },
    { id: 'emergency', name: 'Emergency Exit', w: 4, h: 1, color: '#22c55e', pallets: 0, wallItem: true, doorHeight: 7 },
    { id: 'window', name: 'Window', w: 5, h: 1, color: '#06b6d4', pallets: 0, wallItem: true, doorHeight: 4 },
  ],
  columns: [
    { id: 'round-12', name: 'Round Column 12"', w: 1, h: 1, color: '#6b7280', pallets: 0, columnType: 'round', columnSize: 12 },
    { id: 'round-18', name: 'Round Column 18"', w: 1.5, h: 1.5, color: '#6b7280', pallets: 0, columnType: 'round', columnSize: 18 },
    { id: 'round-24', name: 'Round Column 24"', w: 2, h: 2, color: '#6b7280', pallets: 0, columnType: 'round', columnSize: 24 },
    { id: 'square-12', name: 'Square Column 12"', w: 1, h: 1, color: '#4b5563', pallets: 0, columnType: 'square', columnSize: 12 },
    { id: 'square-18', name: 'Square Column 18"', w: 1.5, h: 1.5, color: '#4b5563', pallets: 0, columnType: 'square', columnSize: 18 },
    { id: 'square-24', name: 'Square Column 24"', w: 2, h: 2, color: '#4b5563', pallets: 0, columnType: 'square', columnSize: 24 },
    { id: 'rect-12x18', name: 'Rect Column 12"x18"', w: 1, h: 1.5, color: '#374151', pallets: 0, columnType: 'rectangular', columnSize: 12, columnDepth: 18 },
    { id: 'rect-18x24', name: 'Rect Column 18"x24"', w: 1.5, h: 2, color: '#374151', pallets: 0, columnType: 'rectangular', columnSize: 18, columnDepth: 24 },
    { id: 'custom', name: 'Custom Column', w: 1, h: 1, color: '#1f2937', pallets: 0, columnType: 'custom', columnSize: 12, isCustomColumn: true },
  ],
  zones: [
    // Rental Zones (for defining rentable areas)
    { id: 'pallet-zone', name: '📦 Pallet Storage Zone', w: 10, h: 8, color: '#3b82f6', pallets: 0, zoneType: 'pallet-storage', isRentalZone: true },
    { id: 'space-zone', name: '📐 Space Storage Zone', w: 10, h: 8, color: '#8b5cf6', pallets: 0, zoneType: 'space-storage', isRentalZone: true },
    // Operational Zones
    { id: 'staging', name: 'Staging Area', w: 6, h: 4, color: '#fbbf24', pallets: 0, zoneType: 'operational' },
    { id: 'packing', name: 'Packing Station', w: 5, h: 3, color: '#10b981', pallets: 0, zoneType: 'operational' },
    { id: 'picking', name: 'Picking Area', w: 8, h: 5, color: '#22d3ee', pallets: 0, zoneType: 'operational' },
    { id: 'returns', name: 'Returns Area', w: 4, h: 4, color: '#f472b6', pallets: 0, zoneType: 'operational' },
    { id: 'hazmat', name: 'Hazmat Zone', w: 5, h: 5, color: '#ef4444', pallets: 0, zoneType: 'hazmat' },
    { id: 'quarantine', name: 'Quarantine Zone', w: 5, h: 5, color: '#f97316', pallets: 0, zoneType: 'quarantine' },
  ],
  barriers: [
    // Fences & Barriers (for marking rented spaces)
    { id: 'fence-10', name: 'Wire Fence 10ft', w: 10, h: 0.5, color: '#71717a', pallets: 0, barrierType: 'fence' },
    { id: 'fence-20', name: 'Wire Fence 20ft', w: 20, h: 0.5, color: '#71717a', pallets: 0, barrierType: 'fence' },
    { id: 'fence-corner', name: 'Fence Corner', w: 0.5, h: 0.5, color: '#52525b', pallets: 0, barrierType: 'fence-corner' },
    { id: 'cage-small', name: 'Storage Cage 8x8', w: 8, h: 8, color: '#a1a1aa', pallets: 0, barrierType: 'cage' },
    { id: 'cage-medium', name: 'Storage Cage 12x10', w: 12, h: 10, color: '#a1a1aa', pallets: 0, barrierType: 'cage' },
    { id: 'cage-large', name: 'Storage Cage 16x12', w: 16, h: 12, color: '#a1a1aa', pallets: 0, barrierType: 'cage' },
    { id: 'barrier-concrete', name: 'Concrete Barrier', w: 6, h: 1, color: '#78716c', pallets: 0, barrierType: 'barrier' },
    { id: 'bollard', name: 'Safety Bollard', w: 1, h: 1, color: '#fbbf24', pallets: 0, barrierType: 'bollard' },
    { id: 'floor-tape', name: 'Floor Tape Line', w: 15, h: 0.3, color: '#facc15', pallets: 0, barrierType: 'tape' },
    { id: 'rented-marker', name: '🔒 Rented Space Marker', w: 8, h: 8, color: '#22c55e', pallets: 0, barrierType: 'rented-marker', isRentedMarker: true },
  ],
  equipment: [
    { id: 'charger', name: 'Forklift Charger', w: 3, h: 2, color: '#22c55e', pallets: 0 },
    { id: 'office', name: 'Office Area', w: 6, h: 5, color: '#a78bfa', pallets: 0 },
    { id: 'breakroom', name: 'Break Room', w: 5, h: 4, color: '#f472b6', pallets: 0 },
    { id: 'restroom', name: 'Restroom', w: 3, h: 3, color: '#60a5fa', pallets: 0 },
    { id: 'forklift', name: 'Forklift Parking', w: 4, h: 6, color: '#f59e0b', pallets: 0 },
    { id: 'scale', name: 'Floor Scale', w: 4, h: 4, color: '#64748b', pallets: 0 },
  ],
  pallets: [
    { id: 'europallet', name: 'Euro Pallet Stack', w: 3, h: 4, color: '#d97706', pallets: 4 },
    { id: 'gmapallet', name: 'GMA Pallet Stack', w: 4, h: 3, color: '#b45309', pallets: 4 },
  ],
}

interface CatalogItem {
  id: string
  name: string
  w: number
  h: number
  color: string
  pallets: number
  wallItem?: boolean
  doorHeight?: number
  // Column properties
  columnType?: 'round' | 'square' | 'rectangular' | 'custom'
  columnSize?: number  // diameter or width in inches
  columnDepth?: number // depth in inches (for rectangular)
  isCustomColumn?: boolean
  // Zone properties
  zoneType?: 'pallet-storage' | 'space-storage' | 'operational' | 'hazmat' | 'quarantine'
  isRentalZone?: boolean
  // Barrier properties
  barrierType?: 'fence' | 'fence-corner' | 'cage' | 'barrier' | 'bollard' | 'tape' | 'rented-marker'
  isRentedMarker?: boolean
}

interface PlacedItem extends CatalogItem {
  x: number
  y: number
  rotation: number
  instanceId: number
  
  // Item type classification
  type?: 'rack' | 'zone' | 'equipment' | 'door' | 'pallet' | 'column' | 'barrier'
  
  // 3D height (feet)
  height?: number
  
  // Rack-specific properties
  beamLevels?: number
  bayWidth?: number
  palletPositions?: number
  aisleWidth?: number
  uprightDepth?: number  // Upright frame depth in inches
  
  // Column-specific properties (inherited from CatalogItem but can be customized)
  // columnType, columnSize, columnDepth already in CatalogItem
  
  // Zone-specific properties
  zoneName?: string  // e.g., "Zone A", "Pallet Area 1"
  tenantName?: string  // Name of tenant renting this zone
  
  // Custom properties
  customLabel?: string
  notes?: string
}

interface Vertex {
  x: number
  y: number
}

interface WallOpening {
  id: number
  wallIndex: number
  type: 'dock' | 'personnel' | 'emergency' | 'rollup' | 'window'
  position: number  // 0-1 percentage along wall
  width: number
  height: number
}

interface FloorPlanCanvasProps {
  warehouseId?: string
  warehouseName?: string
  onSave?: (data: {
    vertices: Vertex[]
    items: PlacedItem[]
    wallOpenings: WallOpening[]
    totalArea: number
    equipmentArea: number
    palletCapacity: number
  }) => void
  initialVertices?: Vertex[]
  initialItems?: PlacedItem[]
  initialWallOpenings?: WallOpening[]
  initialWallHeight?: number
}

// History for undo/redo
interface HistoryState {
  vertices: Vertex[]
  items: PlacedItem[]
}

export default function FloorPlanCanvas({ 
  warehouseId, 
  warehouseName = 'Warehouse',
  onSave, 
  initialVertices, 
  initialItems, 
  initialWallOpenings,
  initialWallHeight
}: FloorPlanCanvasProps) {
  const { toast } = useToast()
  
  // Warehouse shape (vertices in feet)
  const [vertices, setVertices] = useState<Vertex[]>(initialVertices || SHAPE_TEMPLATES.rectangle)
  
  // Placed items
  const [items, setItems] = useState<PlacedItem[]>(initialItems || [])
  
  // Wall openings (doors/windows)
  const [wallOpenings, setWallOpenings] = useState<WallOpening[]>(initialWallOpenings || [])
  const [selectedOpening, setSelectedOpening] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<number | null>(null)
  const [dragItem, setDragItem] = useState<(CatalogItem & { x: number; y: number; rotation: number }) | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // Save/Load state
  const [isSaving, setIsSaving] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  
  // Multi-floor support
  const [floors, setFloors] = useState<FloorInfo[]>([])
  const [currentFloor, setCurrentFloor] = useState(1)
  const [floorName, setFloorName] = useState('Floor 1')
  const [isLoadingFloor, setIsLoadingFloor] = useState(false)
  
  // Local cache for floor data (preserves unsaved changes when switching floors)
  const floorDataCache = useRef<Map<number, {
    vertices: Vertex[]
    items: PlacedItem[]
    wallOpenings: WallOpening[]
    wallHeight: number
    floorName: string
    hasUnsavedChanges: boolean
    zoom: number
    panX: number
    panY: number
    areas: FloorArea[]
  }>>(new Map())
  
  // Track if current floor has unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Areas within current floor
  const [areas, setAreas] = useState<FloorArea[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [showAreaPanel, setShowAreaPanel] = useState(false)
  const [editingArea, setEditingArea] = useState<FloorArea | null>(null)
  
  // Area drawing mode (polygon drawing like warehouse boundary)
  const [areaDrawMode, setAreaDrawMode] = useState(false)
  const [drawingAreaVertices, setDrawingAreaVertices] = useState<Vertex[]>([])
  const [drawingAreaType, setDrawingAreaType] = useState<FloorArea['type']>('pallet-storage')
  const [selectedAreaVertexIdx, setSelectedAreaVertexIdx] = useState<number | null>(null)
  const [isDraggingAreaVertex, setIsDraggingAreaVertex] = useState(false)
  
  // Area dragging and snapping
  const [isDraggingArea, setIsDraggingArea] = useState(false)
  const [areaDragStart, setAreaDragStart] = useState<Vertex | null>(null)
  const [areaOriginalVertices, setAreaOriginalVertices] = useState<Vertex[]>([])
  const [snapLines, setSnapLines] = useState<{ from: Vertex; to: Vertex }[]>([])
  const SNAP_THRESHOLD = 15 // pixels for snapping
  
  // Area rotation
  const [isRotatingArea, setIsRotatingArea] = useState(false)
  const [areaRotationStart, setAreaRotationStart] = useState(0)
  const [areaOriginalRotation, setAreaOriginalRotation] = useState(0)
  const [rotationCenter, setRotationCenter] = useState<Vertex | null>(null)
  
  
  // Area context menu
  const [areaContextMenu, setAreaContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    areaId: string | null
  }>({ visible: false, x: 0, y: 0, areaId: null })
  
  // View state
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D')
  const [category, setCategory] = useState('racking')
  const [editingVertex, setEditingVertex] = useState<number | null>(null)
  
  // Custom column state
  const [customColumnType, setCustomColumnType] = useState<'round' | 'square' | 'rectangular'>('round')
  const [customColumnWidth, setCustomColumnWidth] = useState('12')
  const [customColumnDepth, setCustomColumnDepth] = useState('18')
  
  // Zoom & Pan
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 })
  const [wasPanning, setWasPanning] = useState(false) // Track if we just finished panning
  
  // Auto-fit warehouse to canvas
  const fitToScreen = useCallback((verts: Vertex[], cSize: { w: number; h: number }) => {
    if (verts.length < 3 || cSize.w < 100 || cSize.h < 100) return
    
    // Calculate bounding box of warehouse
    const minX = Math.min(...verts.map(v => v.x))
    const maxX = Math.max(...verts.map(v => v.x))
    const minY = Math.min(...verts.map(v => v.y))
    const maxY = Math.max(...verts.map(v => v.y))
    
    const warehouseW = (maxX - minX) * GRID_SIZE
    const warehouseH = (maxY - minY) * GRID_SIZE
    
    if (warehouseW <= 0 || warehouseH <= 0) return
    
    // Calculate zoom to fit with padding
    const padding = 80 // pixels padding
    const availableW = cSize.w - padding * 2
    const availableH = cSize.h - padding * 2
    
    const zoomX = availableW / warehouseW
    const zoomY = availableH / warehouseH
    const newZoom = Math.min(zoomX, zoomY, 2) // Cap at 200% zoom
    
    // Clamp zoom
    const clampedZoom = Math.min(Math.max(newZoom, 0.05), 5)
    
    // Calculate pan to center the warehouse
    const centerX = (minX + maxX) / 2 * GRID_SIZE
    const centerY = (minY + maxY) / 2 * GRID_SIZE
    const newPanX = cSize.w / 2 - centerX * clampedZoom
    const newPanY = cSize.h / 2 - centerY * clampedZoom
    
    setZoom(clampedZoom)
    setPan({ x: newPanX, y: newPanY })
  }, [])
  
  // Wall editing
  const [editingWall, setEditingWall] = useState<number | null>(null)
  const [wallLength, setWallLength] = useState<string>('')
  const [wallEditPos, setWallEditPos] = useState({ x: 0, y: 0 })
  
  // IKEA-style wall edit mode
  const [wallEditMode, setWallEditMode] = useState(false)
  const [selectedWallIdx, setSelectedWallIdx] = useState<number | null>(null)
  const [selectedVertexIdx, setSelectedVertexIdx] = useState<number | null>(null)
  const [isDraggingVertex, setIsDraggingVertex] = useState(false)
  const [wallToolbarPos, setWallToolbarPos] = useState({ x: 0, y: 0 })
  const [summaryCollapsed, setSummaryCollapsed] = useState(true)  // Summary panel collapsed by default
  
  // Rotation handle state
  const [isRotating, setIsRotating] = useState(false)
  const [rotationStartAngle, setRotationStartAngle] = useState(0)
  const [itemStartRotation, setItemStartRotation] = useState(0)
  
  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    itemIndex: number | null
  }>({ visible: false, x: 0, y: 0, itemIndex: null })
  
  // Edit dimensions modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PlacedItem | null>(null)
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  
  // 3D wall height (ft)
  const [wallHeight, setWallHeight] = useState(initialWallHeight || 20)
  
  // Canvas container ref for 3D screenshot
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  
  // Canvas wrapper ref for dynamic sizing
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: DEFAULT_CANVAS_W, h: DEFAULT_CANVAS_H })
  
  // History for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([{ vertices: SHAPE_TEMPLATES.rectangle, items: [] }])
  const [historyIndex, setHistoryIndex] = useState(0)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Save state to history
  const saveToHistory = useCallback((newVertices: Vertex[], newItems: PlacedItem[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ vertices: newVertices, items: newItems })
    if (newHistory.length > 50) newHistory.shift() // Limit history
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex])
  
  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setVertices(history[newIndex].vertices)
      setItems(history[newIndex].items)
    }
  }, [historyIndex, history])
  
  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setVertices(history[newIndex].vertices)
      setItems(history[newIndex].items)
    }
  }, [historyIndex, history])
  
  // Track changes to mark as unsaved (skip on initial load)
  const isFirstRender = useRef(true)
  useEffect(() => {
    // Skip marking unsaved on first render (initial load)
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    // Skip if we're currently loading a floor
    if (isLoadingFloor || !isInitialized) return
    
    setHasUnsavedChanges(true)
  }, [vertices, items, wallOpenings, wallHeight, floorName, isLoadingFloor, isInitialized])
  
  // Load all floors list and first floor data on mount
  useEffect(() => {
    // Prevent multiple loads
    if (isInitialized) return
    
    const loadData = async () => {
      // Skip if no warehouse ID
      if (!warehouseId) {
        setIsInitialized(true)
        return
      }
      
      try {
        // First, load the list of all floors
        const floorsResult = await loadAllFloors(warehouseId)
        if (floorsResult.success && floorsResult.floors && floorsResult.floors.length > 0) {
          setFloors(floorsResult.floors)
          // Load the first floor's data
          const firstFloorNum = floorsResult.floors[0].floorNumber
          setCurrentFloor(firstFloorNum)
          setFloorName(floorsResult.floors[0].name)
        }
        
        // Load the current floor's data
        const result = await loadFloorPlan(warehouseId, currentFloor)
        
        if (result.success && result.data) {
          const data = result.data
          
          if (data.vertices && data.vertices.length >= 3) {
            setVertices(data.vertices)
          }
          if (data.items && data.items.length > 0) {
            // Ensure all items have required fields with defaults
            const loadedItems = data.items.map((item: { rotation?: number }) => ({
              ...item,
              rotation: item.rotation ?? 0,
            }))
            setItems(loadedItems as PlacedItem[])
          }
          if (data.wall_openings && data.wall_openings.length > 0) {
            setWallOpenings(data.wall_openings as WallOpening[])
          }
          if (data.wall_height) {
            setWallHeight(data.wall_height)
          }
          if (data.name) {
            setFloorName(data.name)
          }
          if (data.updated_at) {
            setLastSaved(new Date(data.updated_at))
          }
          
          // Load saved zoom/pan or schedule auto-fit
          const savedZoom = data.zoom || null
          const savedPanX = data.pan_x || 0
          const savedPanY = data.pan_y || 0
          
          if (savedZoom && savedZoom > 0.01) {
            setZoom(savedZoom)
            setPan({ x: savedPanX, y: savedPanY })
          } else {
            // Auto-fit after canvas size is known
            const loadedVerts = data.vertices || SHAPE_TEMPLATES.rectangle
            setTimeout(() => {
              if (canvasSize.w > 100 && canvasSize.h > 100) {
                fitToScreen(loadedVerts, canvasSize)
              }
            }, 200)
          }
          
          // Initialize history with loaded data
          const historyItems = (data.items || []).map((item: { rotation?: number }) => ({
            ...item,
            rotation: item.rotation ?? 0,
          })) as PlacedItem[]
          setHistory([{ vertices: data.vertices || SHAPE_TEMPLATES.rectangle, items: historyItems }])
          setHistoryIndex(0)
        }
      } catch (error) {
        console.error('Failed to load floor plan:', error)
        // Don't show toast on initial load failure - just use defaults
      } finally {
        setIsInitialized(true)
      }
    }
    
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, isInitialized])
  
  // Save current floor state to local cache
  const saveCurrentFloorToCache = useCallback(() => {
    floorDataCache.current.set(currentFloor, {
      vertices: [...vertices],
      items: [...items],
      wallOpenings: [...wallOpenings],
      wallHeight,
      floorName,
      hasUnsavedChanges,
      zoom,
      panX: pan.x,
      panY: pan.y,
      areas: [...areas]
    })
  }, [currentFloor, vertices, items, wallOpenings, wallHeight, floorName, hasUnsavedChanges, zoom, pan, areas])
  
  // Switch to a different floor
  const switchFloor = useCallback(async (floorNumber: number) => {
    if (!warehouseId || floorNumber === currentFloor || isLoadingFloor) return
    
    // First, save current floor's state to local cache
    saveCurrentFloorToCache()
    
    setIsLoadingFloor(true)
    try {
      // Check if we have cached data for the target floor
      const cachedData = floorDataCache.current.get(floorNumber)
      
      if (cachedData) {
        // Use cached data (preserves unsaved changes)
        setVertices(cachedData.vertices)
        setItems(cachedData.items)
        setWallOpenings(cachedData.wallOpenings)
        setWallHeight(cachedData.wallHeight)
        setFloorName(cachedData.floorName)
        setCurrentFloor(floorNumber)
        setHasUnsavedChanges(cachedData.hasUnsavedChanges)
        setZoom(cachedData.zoom || 1)
        setPan({ x: cachedData.panX || 0, y: cachedData.panY || 0 })
        setAreas(cachedData.areas || [])
        
        // Reset history for this floor
        setHistory([{ vertices: cachedData.vertices, items: cachedData.items }])
        setHistoryIndex(0)
      } else {
        // No cache - load from database
        const result = await loadFloorPlan(warehouseId, floorNumber)
        
        if (result.success && result.data) {
          const data = result.data
          const loadedVertices = data.vertices?.length >= 3 ? data.vertices : SHAPE_TEMPLATES.rectangle
          const loadedItems = (data.items || []).map((item: { rotation?: number }) => ({
            ...item,
            rotation: item.rotation ?? 0,
          })) as PlacedItem[]
          
          setVertices(loadedVertices)
          setItems(loadedItems)
          setWallOpenings(data.wall_openings || [])
          setWallHeight(data.wall_height || 20)
          setFloorName(data.name || `Floor ${floorNumber}`)
          setCurrentFloor(floorNumber)
          setLastSaved(data.updated_at ? new Date(data.updated_at) : null)
          setHasUnsavedChanges(false)
          
          // Load saved zoom/pan or auto-fit
          const savedZoom = data.zoom || null
          const savedPanX = data.pan_x || 0
          const savedPanY = data.pan_y || 0
          
          if (savedZoom && savedZoom > 0.01) {
            setZoom(savedZoom)
            setPan({ x: savedPanX, y: savedPanY })
          } else {
            // Auto-fit to screen for new floors or if no zoom saved
            setTimeout(() => fitToScreen(loadedVertices, canvasSize), 100)
          }
          
          // Save to cache
          // Load areas
          const loadedAreas = data.areas || []
          setAreas(loadedAreas)
          
          floorDataCache.current.set(floorNumber, {
            vertices: loadedVertices,
            items: loadedItems,
            wallOpenings: data.wall_openings || [],
            wallHeight: data.wall_height || 20,
            floorName: data.name || `Floor ${floorNumber}`,
            hasUnsavedChanges: false,
            zoom: savedZoom || 1,
            panX: savedPanX,
            panY: savedPanY,
            areas: loadedAreas
          })
          
          // Reset history for new floor
          setHistory([{ vertices: loadedVertices, items: loadedItems }])
          setHistoryIndex(0)
        } else {
          // Floor doesn't exist yet - initialize with defaults
          const defaultVertices = SHAPE_TEMPLATES.rectangle
          setVertices(defaultVertices)
          setItems([])
          setWallOpenings([])
          setWallHeight(20)
          setFloorName(`Floor ${floorNumber}`)
          setCurrentFloor(floorNumber)
          setLastSaved(null)
          setHasUnsavedChanges(false)
          setAreas([])
          
          // Auto-fit default shape
          setTimeout(() => fitToScreen(defaultVertices, canvasSize), 100)
          
          // Save to cache
          floorDataCache.current.set(floorNumber, {
            vertices: defaultVertices,
            items: [],
            wallOpenings: [],
            wallHeight: 20,
            floorName: `Floor ${floorNumber}`,
            hasUnsavedChanges: false,
            zoom: 1,
            panX: 0,
            panY: 0,
            areas: []
          })
          
          setHistory([{ vertices: defaultVertices, items: [] }])
          setHistoryIndex(0)
        }
      }
      
      // Clear selections
      setSelectedItem(null)
      setSelectedOpening(null)
      setSelectedVertexIdx(null)
      setSelectedWallIdx(null)
    } catch (error) {
      console.error('Failed to switch floor:', error)
      toast({
        title: 'Error',
        description: 'Failed to load floor data',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingFloor(false)
    }
  }, [warehouseId, currentFloor, isLoadingFloor, toast, saveCurrentFloorToCache])
  
  // Add a new floor
  const addNewFloor = useCallback(async () => {
    if (!warehouseId) return
    
    // Find the next floor number
    const maxFloor = floors.length > 0 ? Math.max(...floors.map(f => f.floorNumber)) : 0
    const newFloorNum = maxFloor + 1
    
    setIsLoadingFloor(true)
    try {
      // Save empty floor to create it
      const result = await saveFloorPlan(warehouseId, {
        vertices: SHAPE_TEMPLATES.rectangle,
        items: [],
        wallOpenings: [],
        wallHeight: 20,
        name: `Floor ${newFloorNum}`,
        totalArea: 0,
        equipmentArea: 0,
        palletCapacity: 0
      }, newFloorNum)
      
      if (result.success) {
        // Reload floors list
        const floorsResult = await loadAllFloors(warehouseId)
        if (floorsResult.success && floorsResult.floors) {
          setFloors(floorsResult.floors)
        }
        
        // Switch to new floor
        setVertices(SHAPE_TEMPLATES.rectangle)
        setItems([])
        setWallOpenings([])
        setWallHeight(20)
        setFloorName(`Floor ${newFloorNum}`)
        setCurrentFloor(newFloorNum)
        setLastSaved(new Date())
        setHistory([{ vertices: SHAPE_TEMPLATES.rectangle, items: [] }])
        setHistoryIndex(0)
        
        toast({
          title: 'Floor Added',
          description: `Floor ${newFloorNum} has been created`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Failed to add floor:', error)
      toast({
        title: 'Error',
        description: 'Failed to add new floor',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingFloor(false)
    }
  }, [warehouseId, floors, toast])
  
  // Delete current floor
  const deleteCurrentFloor = useCallback(async () => {
    if (!warehouseId || floors.length <= 1) {
      toast({
        title: 'Cannot Delete',
        description: 'You must have at least one floor',
        variant: 'destructive'
      })
      return
    }
    
    if (!confirm(`Are you sure you want to delete Floor ${currentFloor}? This cannot be undone.`)) {
      return
    }
    
    setIsLoadingFloor(true)
    try {
      const result = await deleteFloor(warehouseId, currentFloor)
      
      if (result.success) {
        // Reload floors list
        const floorsResult = await loadAllFloors(warehouseId)
        if (floorsResult.success && floorsResult.floors && floorsResult.floors.length > 0) {
          setFloors(floorsResult.floors)
          // Switch to first available floor
          await switchFloor(floorsResult.floors[0].floorNumber)
        }
        
        toast({
          title: 'Floor Deleted',
          description: `Floor ${currentFloor} has been deleted`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Failed to delete floor:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete floor',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingFloor(false)
    }
  }, [warehouseId, currentFloor, floors, switchFloor, toast])
  
  // Calculate area using Shoelace formula
  const calcArea = useCallback(() => {
    let a = 0
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length
      a += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y
    }
    return Math.abs(a / 2)
  }, [vertices])
  
  // Equipment area (account for rotation)
  const equipArea = items.reduce((sum, item) => sum + item.w * item.h, 0)
  const totalArea = calcArea()
  const utilization = totalArea > 0 ? ((equipArea / totalArea) * 100).toFixed(1) : '0'
  const totalPallets = items.reduce((sum, item) => sum + (item.pallets || 0), 0)
  
  // Zone statistics
  const palletZones = items.filter(item => item.zoneType === 'pallet-storage')
  const spaceZones = items.filter(item => item.zoneType === 'space-storage')
  const palletZoneArea = palletZones.reduce((sum, item) => sum + item.w * item.h, 0)
  const spaceZoneArea = spaceZones.reduce((sum, item) => sum + item.w * item.h, 0)
  const rentedMarkers = items.filter(item => item.isRentedMarker)
  const rentedArea = rentedMarkers.reduce((sum, item) => sum + item.w * item.h, 0)
  
  // Determine item type from name/id
  const getItemType = useCallback((item: PlacedItem): PlacedItem['type'] => {
    if (item.type) return item.type
    const name = item.name.toLowerCase()
    const id = item.id?.toLowerCase() || ''
    
    if (name.includes('rack') || id.includes('rack') || name.includes('cantilever')) return 'rack'
    if (name.includes('door') || name.includes('exit') || name.includes('window') || item.wallItem) return 'door'
    if (name.includes('pallet') || id.includes('pallet')) return 'pallet'
    if (name.includes('office') || name.includes('room') || name.includes('area') || 
        name.includes('zone') || name.includes('station') || name.includes('restroom')) return 'zone'
    return 'equipment'
  }, [])
  
  // Calculate pallets for rack items
  const calculatePallets = useCallback((item: PlacedItem): number => {
    const type = getItemType(item)
    if (type !== 'rack') return item.pallets || 0
    
    const levels = item.beamLevels || 4
    const bayWidth = item.bayWidth || 8
    const palletsPerLevel = item.palletPositions || Math.max(1, Math.floor(item.w / bayWidth) * 3)
    
    return levels * palletsPerLevel
  }, [getItemType])
  
  // Validate item dimensions
  const validateDimensions = useCallback((item: PlacedItem): string[] => {
    const errors: string[] = []
    const type = getItemType(item)
    
    if (item.w < 1) errors.push('Width must be at least 1 ft')
    if (item.h < 1) errors.push('Depth must be at least 1 ft')
    if (item.w > 100) errors.push('Width cannot exceed 100 ft')
    if (item.h > 100) errors.push('Depth cannot exceed 100 ft')
    
    if (type === 'rack') {
      if ((item.height || 16) > 40) errors.push('Rack height cannot exceed 40 ft')
      if ((item.beamLevels || 4) > 10) errors.push('Maximum 10 beam levels')
      if ((item.aisleWidth || 12) < 8) errors.push('Aisle width should be at least 8 ft for forklifts')
    }
    
    return errors
  }, [getItemType])
  
  // Check if point is inside polygon
  const isPointInPolygon = useCallback((point: { x: number; y: number }, polygon: Vertex[]): boolean => {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y
      const xj = polygon[j].x, yj = polygon[j].y
      
      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
    }
    return inside
  }, [])
  
  // Find snap points between dragging area and other areas (including edge-to-edge snap)
  const findSnapPoints = useCallback((draggedAreaId: string, draggedVertices: Vertex[]): { 
    snappedVertices: Vertex[], 
    snapLines: { from: Vertex; to: Vertex }[] 
  } => {
    const snapThresholdGrid = SNAP_THRESHOLD / (GRID_SIZE * zoom) // Convert pixel threshold to grid units
    const snappedVertices = [...draggedVertices]
    const newSnapLines: { from: Vertex; to: Vertex }[] = []
    
    // Get edges from other areas
    type Edge = { v1: Vertex; v2: Vertex; minX: number; maxX: number; minY: number; maxY: number; isVertical: boolean; isHorizontal: boolean }
    const otherEdges: Edge[] = []
    areas.forEach(area => {
      if (area.id !== draggedAreaId && area.vertices.length >= 3) {
        for (let i = 0; i < area.vertices.length; i++) {
          const v1 = area.vertices[i]
          const v2 = area.vertices[(i + 1) % area.vertices.length]
          otherEdges.push({
            v1, v2,
            minX: Math.min(v1.x, v2.x),
            maxX: Math.max(v1.x, v2.x),
            minY: Math.min(v1.y, v2.y),
            maxY: Math.max(v1.y, v2.y),
            isVertical: Math.abs(v1.x - v2.x) < 0.5,
            isHorizontal: Math.abs(v1.y - v2.y) < 0.5
          })
        }
      }
    })
    
    // Also get warehouse boundary edges
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i]
      const v2 = vertices[(i + 1) % vertices.length]
      otherEdges.push({
        v1, v2,
        minX: Math.min(v1.x, v2.x),
        maxX: Math.max(v1.x, v2.x),
        minY: Math.min(v1.y, v2.y),
        maxY: Math.max(v1.y, v2.y),
        isVertical: Math.abs(v1.x - v2.x) < 0.5,
        isHorizontal: Math.abs(v1.y - v2.y) < 0.5
      })
    }
    
    // Get edges from dragged area
    const draggedEdges: Edge[] = []
    for (let i = 0; i < draggedVertices.length; i++) {
      const v1 = draggedVertices[i]
      const v2 = draggedVertices[(i + 1) % draggedVertices.length]
      draggedEdges.push({
        v1, v2,
        minX: Math.min(v1.x, v2.x),
        maxX: Math.max(v1.x, v2.x),
        minY: Math.min(v1.y, v2.y),
        maxY: Math.max(v1.y, v2.y),
        isVertical: Math.abs(v1.x - v2.x) < 0.5,
        isHorizontal: Math.abs(v1.y - v2.y) < 0.5
      })
    }
    
    let bestSnapX: number | null = null
    let bestSnapY: number | null = null
    let bestSnapDistX = Infinity
    let bestSnapDistY = Infinity
    
    // Edge-to-edge snapping: find parallel edges that are close
    draggedEdges.forEach(de => {
      otherEdges.forEach(oe => {
        // Vertical edge to vertical edge (snap X)
        if (de.isVertical && oe.isVertical) {
          // Check if they overlap in Y
          const yOverlap = de.maxY > oe.minY && de.minY < oe.maxY
          if (yOverlap) {
            const dist = Math.abs(de.v1.x - oe.v1.x)
            if (dist < snapThresholdGrid && dist < bestSnapDistX) {
              bestSnapX = oe.v1.x - de.v1.x
              bestSnapDistX = dist
              newSnapLines.push({ 
                from: { x: oe.v1.x, y: Math.min(de.minY, oe.minY) - 3 }, 
                to: { x: oe.v1.x, y: Math.max(de.maxY, oe.maxY) + 3 } 
              })
            }
          }
        }
        
        // Horizontal edge to horizontal edge (snap Y)
        if (de.isHorizontal && oe.isHorizontal) {
          // Check if they overlap in X
          const xOverlap = de.maxX > oe.minX && de.minX < oe.maxX
          if (xOverlap) {
            const dist = Math.abs(de.v1.y - oe.v1.y)
            if (dist < snapThresholdGrid && dist < bestSnapDistY) {
              bestSnapY = oe.v1.y - de.v1.y
              bestSnapDistY = dist
              newSnapLines.push({ 
                from: { x: Math.min(de.minX, oe.minX) - 3, y: oe.v1.y }, 
                to: { x: Math.max(de.maxX, oe.maxX) + 3, y: oe.v1.y } 
              })
            }
          }
        }
      })
    })
    
    // Vertex-to-vertex snapping (fallback and for non-axis-aligned edges)
    const otherAreaVertices: Vertex[] = []
    areas.forEach(area => {
      if (area.id !== draggedAreaId) {
        area.vertices.forEach(v => otherAreaVertices.push(v))
      }
    })
    vertices.forEach(v => otherAreaVertices.push(v))
    
    draggedVertices.forEach((dv) => {
      otherAreaVertices.forEach(ov => {
        // Check X alignment (only if no edge snap found)
        if (bestSnapX === null && Math.abs(dv.x - ov.x) < snapThresholdGrid) {
          const dist = Math.abs(dv.x - ov.x)
          if (dist < bestSnapDistX) {
            bestSnapX = ov.x - dv.x
            bestSnapDistX = dist
            newSnapLines.push({ from: { x: ov.x, y: Math.min(dv.y, ov.y) - 5 }, to: { x: ov.x, y: Math.max(dv.y, ov.y) + 5 } })
          }
        }
        // Check Y alignment (only if no edge snap found)
        if (bestSnapY === null && Math.abs(dv.y - ov.y) < snapThresholdGrid) {
          const dist = Math.abs(dv.y - ov.y)
          if (dist < bestSnapDistY) {
            bestSnapY = ov.y - dv.y
            bestSnapDistY = dist
            newSnapLines.push({ from: { x: Math.min(dv.x, ov.x) - 5, y: ov.y }, to: { x: Math.max(dv.x, ov.x) + 5, y: ov.y } })
          }
        }
      })
    })
    
    // Apply snap offset to all vertices
    if (bestSnapX !== null || bestSnapY !== null) {
      const snapX = bestSnapX ?? 0
      const snapY = bestSnapY ?? 0
      
      for (let i = 0; i < snappedVertices.length; i++) {
        snappedVertices[i] = {
          x: Math.round(draggedVertices[i].x + snapX),
          y: Math.round(draggedVertices[i].y + snapY)
        }
      }
    }
    
    return { snappedVertices, snapLines: newSnapLines }
  }, [areas, vertices, zoom])
  
  // Get area center point
  const getAreaCenter = useCallback((areaVertices: Vertex[]): Vertex => {
    if (areaVertices.length === 0) return { x: 0, y: 0 }
    const sumX = areaVertices.reduce((sum, v) => sum + v.x, 0)
    const sumY = areaVertices.reduce((sum, v) => sum + v.y, 0)
    return { x: sumX / areaVertices.length, y: sumY / areaVertices.length }
  }, [])
  
  // Rotate vertices around a center point
  const rotateVertices = useCallback((verts: Vertex[], center: Vertex, angleDeg: number): Vertex[] => {
    const angleRad = (angleDeg * Math.PI) / 180
    const cos = Math.cos(angleRad)
    const sin = Math.sin(angleRad)
    
    return verts.map(v => {
      const dx = v.x - center.x
      const dy = v.y - center.y
      return {
        x: Math.round(center.x + dx * cos - dy * sin),
        y: Math.round(center.y + dx * sin + dy * cos)
      }
    })
  }, [])
  
  // Check if an area is inside another area
  const isAreaInsideAnother = useCallback((areaId: string): boolean => {
    const targetArea = areas.find(a => a.id === areaId)
    if (!targetArea || targetArea.vertices.length < 3) return false
    
    const targetCenter = getAreaCenter(targetArea.vertices)
    
    for (const otherArea of areas) {
      if (otherArea.id === areaId) continue
      if (otherArea.vertices.length < 3) continue
      
      // Check if target's center is inside other area
      if (isPointInPolygon(targetCenter, otherArea.vertices)) {
        return true
      }
    }
    return false
  }, [areas, getAreaCenter, isPointInPolygon])
  
  // Get area bounding box
  const getAreaBounds = useCallback((areaVertices: Vertex[]): { minX: number; minY: number; maxX: number; maxY: number } => {
    if (areaVertices.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    const xs = areaVertices.map(v => v.x)
    const ys = areaVertices.map(v => v.y)
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys)
    }
  }, [])
  
  // Check if item is inside warehouse
  const isInsideWarehouse = useCallback((item: { x: number; y: number; w: number; h: number }): boolean => {
    const corners = [
      { x: item.x, y: item.y },
      { x: item.x + item.w, y: item.y },
      { x: item.x + item.w, y: item.y + item.h },
      { x: item.x, y: item.y + item.h }
    ]
    return corners.every(p => isPointInPolygon(p, vertices))
  }, [vertices, isPointInPolygon])
  
  // Check for collision with other items
  const hasCollision = useCallback((item: { x: number; y: number; w: number; h: number }, ignoreIndex?: number): boolean => {
    for (let i = 0; i < items.length; i++) {
      if (i === ignoreIndex) continue
      const other = items[i]
      
      // AABB collision
      if (item.x < other.x + other.w &&
          item.x + item.w > other.x &&
          item.y < other.y + other.h &&
          item.y + item.h > other.y) {
        return true
      }
    }
    return false
  }, [items])
  
  // Check if point is on a line segment
  const isPointOnLine = useCallback((point: { x: number; y: number }, v1: Vertex, v2: Vertex, tolerance: number): boolean => {
    const dx = v2.x - v1.x
    const dy = v2.y - v1.y
    const length = Math.sqrt(dx * dx + dy * dy)
    
    if (length === 0) return false
    
    // Distance from point to line
    const t = Math.max(0, Math.min(1, ((point.x - v1.x) * dx + (point.y - v1.y) * dy) / (length * length)))
    const projX = v1.x + t * dx
    const projY = v1.y + t * dy
    
    const dist = Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2))
    return dist <= tolerance && t > 0.1 && t < 0.9 // Not too close to vertices
  }, [])
  
  // Find closest wall to a point (for door/window placement)
  const findClosestWall = useCallback((pos: { x: number; y: number }): { wallIndex: number; position: number } | null => {
    let closestWall = null
    let minDist = Infinity
    
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i]
      const v2 = vertices[(i + 1) % vertices.length]
      
      const A = pos.x - v1.x
      const B = pos.y - v1.y
      const C = v2.x - v1.x
      const D = v2.y - v1.y
      
      const dot = A * C + B * D
      const lenSq = C * C + D * D
      let param = -1
      
      if (lenSq !== 0) param = dot / lenSq
      
      let xx, yy
      if (param < 0) { xx = v1.x; yy = v1.y }
      else if (param > 1) { xx = v2.x; yy = v2.y }
      else { xx = v1.x + param * C; yy = v1.y + param * D }
      
      const dist = Math.sqrt((pos.x - xx) ** 2 + (pos.y - yy) ** 2)
      
      if (dist < minDist && dist < 3) { // Within 3 ft of wall
        minDist = dist
        closestWall = { wallIndex: i, position: Math.max(0.1, Math.min(0.9, param)) }
      }
    }
    
    return closestWall
  }, [vertices])
  
  // Mouse position helpers
  const getGridPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    // Account for zoom and pan
    const rawX = (e.clientX - rect.left - pan.x) / zoom
    const rawY = (e.clientY - rect.top - pan.y) / zoom
    return {
      x: Math.floor(rawX / GRID_SIZE),
      y: Math.floor(rawY / GRID_SIZE)
    }
  }, [zoom, pan])
  
  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }, [])
  
  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h)
    
    // Apply transform
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)
    
    // Calculate visible area in grid coordinates (for infinite grid)
    const visibleLeft = -pan.x / zoom
    const visibleTop = -pan.y / zoom
    const visibleRight = (canvasSize.w - pan.x) / zoom
    const visibleBottom = (canvasSize.h - pan.y) / zoom
    
    // Extend grid beyond visible area for smooth scrolling
    const gridExtend = GRID_SIZE * 10
    const gridStartX = Math.floor((visibleLeft - gridExtend) / GRID_SIZE) * GRID_SIZE
    const gridStartY = Math.floor((visibleTop - gridExtend) / GRID_SIZE) * GRID_SIZE
    const gridEndX = Math.ceil((visibleRight + gridExtend) / GRID_SIZE) * GRID_SIZE
    const gridEndY = Math.ceil((visibleBottom + gridExtend) / GRID_SIZE) * GRID_SIZE
    
    // Draw minor grid (1 ft)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1 / zoom
    for (let x = gridStartX; x <= gridEndX; x += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(x, gridStartY)
      ctx.lineTo(x, gridEndY)
      ctx.stroke()
    }
    for (let y = gridStartY; y <= gridEndY; y += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(gridStartX, y)
      ctx.lineTo(gridEndX, y)
      ctx.stroke()
    }
    
    // Draw major grid (10 ft)
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1 / zoom
    const majorGridStartX = Math.floor(gridStartX / (GRID_SIZE * 10)) * GRID_SIZE * 10
    const majorGridStartY = Math.floor(gridStartY / (GRID_SIZE * 10)) * GRID_SIZE * 10
    for (let x = majorGridStartX; x <= gridEndX; x += GRID_SIZE * 10) {
      ctx.beginPath()
      ctx.moveTo(x, gridStartY)
      ctx.lineTo(x, gridEndY)
      ctx.stroke()
    }
    for (let y = majorGridStartY; y <= gridEndY; y += GRID_SIZE * 10) {
      ctx.beginPath()
      ctx.moveTo(gridStartX, y)
      ctx.lineTo(gridEndX, y)
      ctx.stroke()
    }
    
    // Draw warehouse floor
    if (vertices.length >= 3) {
      ctx.beginPath()
      ctx.moveTo(vertices[0].x * GRID_SIZE, vertices[0].y * GRID_SIZE)
      for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x * GRID_SIZE, vertices[i].y * GRID_SIZE)
      }
      ctx.closePath()
      ctx.fillStyle = '#1e3a5f'
      ctx.fill()
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 3 / zoom
      ctx.stroke()
    }
    
    // Draw wall measurements
    ctx.font = `bold ${12 / zoom}px Inter, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i]
      const v2 = vertices[(i + 1) % vertices.length]
      const len = Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2))
      const mx = ((v1.x + v2.x) / 2) * GRID_SIZE
      const my = ((v1.y + v2.y) / 2) * GRID_SIZE
      
      // Offset label perpendicular to wall
      const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x)
      const offsetX = mx - Math.sin(angle) * (15 / zoom)
      const offsetY = my + Math.cos(angle) * (15 / zoom)
      
      const bgWidth = 56 / zoom
      const bgHeight = 20 / zoom
      
      ctx.fillStyle = editingWall === i ? 'rgba(59, 130, 246, 0.9)' : 'rgba(0, 0, 0, 0.8)'
      ctx.fillRect(offsetX - bgWidth / 2, offsetY - bgHeight / 2, bgWidth, bgHeight)
      ctx.fillStyle = '#fff'
      ctx.fillText(`${len.toFixed(0)} ft`, offsetX, offsetY)
    }
    
    // Draw areas (polygon-based)
    areas.forEach((area) => {
      if (!area.vertices || area.vertices.length < 3) return
      
      // Check if this area is inside another area
      const isNested = isAreaInsideAnother(area.id)
      
      // Draw polygon fill
      ctx.beginPath()
      ctx.moveTo(area.vertices[0].x * GRID_SIZE, area.vertices[0].y * GRID_SIZE)
      for (let i = 1; i < area.vertices.length; i++) {
        ctx.lineTo(area.vertices[i].x * GRID_SIZE, area.vertices[i].y * GRID_SIZE)
      }
      ctx.closePath()
      ctx.fillStyle = area.color + '40'
      ctx.fill()
      
      // Draw polygon border - dashed if nested, solid if not
      ctx.strokeStyle = selectedAreaId === area.id ? '#fff' : area.color
      ctx.lineWidth = selectedAreaId === area.id ? 3 / zoom : 2 / zoom
      if (isNested) {
        ctx.setLineDash([8 / zoom, 4 / zoom])
      } else {
        ctx.setLineDash([])
      }
      ctx.stroke()
      ctx.setLineDash([])
      
      // Draw vertices (resize handles) when area is selected
      if (selectedAreaId === area.id) {
        area.vertices.forEach((v, idx) => {
          // Draw resize handle (square for corners)
          const handleSize = 8 / zoom
          ctx.fillStyle = selectedAreaVertexIdx === idx ? '#22c55e' : '#3b82f6'
          ctx.fillRect(
            v.x * GRID_SIZE - handleSize / 2,
            v.y * GRID_SIZE - handleSize / 2,
            handleSize,
            handleSize
          )
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2 / zoom
          ctx.strokeRect(
            v.x * GRID_SIZE - handleSize / 2,
            v.y * GRID_SIZE - handleSize / 2,
            handleSize,
            handleSize
          )
        })
        
        // Draw rotation handle
        const center = getPolygonCenter(area.vertices)
        const bounds = getAreaBounds(area.vertices)
        const handleDistance = Math.max(bounds.maxY - bounds.minY, bounds.maxX - bounds.minX) / 2 + 3
        const rotationHandleY = center.y - handleDistance
        
        // Line from center to rotation handle
        ctx.beginPath()
        ctx.moveTo(center.x * GRID_SIZE, center.y * GRID_SIZE)
        ctx.lineTo(center.x * GRID_SIZE, rotationHandleY * GRID_SIZE)
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2 / zoom
        ctx.stroke()
        
        // Rotation handle circle
        ctx.beginPath()
        ctx.arc(center.x * GRID_SIZE, rotationHandleY * GRID_SIZE, 8 / zoom, 0, Math.PI * 2)
        ctx.fillStyle = '#f59e0b'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2 / zoom
        ctx.stroke()
        
        // Rotation icon (circular arrow)
        ctx.font = `${10 / zoom}px Arial`
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('↻', center.x * GRID_SIZE, rotationHandleY * GRID_SIZE)
      }
      
      // Label at polygon center
      const center = getPolygonCenter(area.vertices)
      const labelText = area.name
      ctx.font = `bold ${14 / zoom}px Inter, Arial, sans-serif`
      const textMetrics = ctx.measureText(labelText)
      const labelPadding = 6 / zoom
      const labelW = textMetrics.width + labelPadding * 2
      const labelH = 20 / zoom
      const labelX = center.x * GRID_SIZE - labelW / 2
      const labelY = center.y * GRID_SIZE - labelH / 2
      
      ctx.fillStyle = area.color
      ctx.fillRect(labelX, labelY, labelW, labelH)
      
      // Label text
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(labelText, center.x * GRID_SIZE, center.y * GRID_SIZE)
      
      // Type indicator and area size
      const areaSize = calcPolygonArea(area.vertices)
      ctx.font = `${10 / zoom}px Inter, Arial, sans-serif`
      ctx.fillStyle = area.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(`${area.type.replace('-', ' ')} • ${areaSize.toLocaleString()} sq ft`, center.x * GRID_SIZE, center.y * GRID_SIZE + labelH / 2 + 4 / zoom)
    })
    
    // Draw area being drawn (in progress)
    if (areaDrawMode && drawingAreaVertices.length > 0) {
      // Draw lines connecting vertices
      ctx.beginPath()
      ctx.moveTo(drawingAreaVertices[0].x * GRID_SIZE, drawingAreaVertices[0].y * GRID_SIZE)
      for (let i = 1; i < drawingAreaVertices.length; i++) {
        ctx.lineTo(drawingAreaVertices[i].x * GRID_SIZE, drawingAreaVertices[i].y * GRID_SIZE)
      }
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 3 / zoom
      ctx.setLineDash([8 / zoom, 4 / zoom])
      ctx.stroke()
      ctx.setLineDash([])
      
      // Draw vertices
      drawingAreaVertices.forEach((v, idx) => {
        ctx.beginPath()
        ctx.arc(v.x * GRID_SIZE, v.y * GRID_SIZE, idx === 0 ? 10 / zoom : 6 / zoom, 0, Math.PI * 2)
        ctx.fillStyle = idx === 0 ? '#22c55e' : '#f97316'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2 / zoom
        ctx.stroke()
        
        // Show "Click to close" hint on first vertex when there are 3+ vertices
        if (idx === 0 && drawingAreaVertices.length >= 3) {
          ctx.font = `bold ${10 / zoom}px Inter, Arial, sans-serif`
          ctx.fillStyle = '#22c55e'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.fillText('Click to close', v.x * GRID_SIZE, v.y * GRID_SIZE - 12 / zoom)
        }
      })
    }
    
    // Draw snap lines (when dragging areas)
    if (isDraggingArea && snapLines.length > 0) {
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 2 / zoom
      ctx.setLineDash([6 / zoom, 3 / zoom])
      
      snapLines.forEach(line => {
        ctx.beginPath()
        ctx.moveTo(line.from.x * GRID_SIZE, line.from.y * GRID_SIZE)
        ctx.lineTo(line.to.x * GRID_SIZE, line.to.y * GRID_SIZE)
        ctx.stroke()
      })
      
      ctx.setLineDash([])
    }
    
    // Draw wall selection highlight (in wall edit mode)
    if (wallEditMode && selectedWallIdx !== null) {
      const v1 = vertices[selectedWallIdx]
      const v2 = vertices[(selectedWallIdx + 1) % vertices.length]
      
      ctx.beginPath()
      ctx.moveTo(v1.x * GRID_SIZE, v1.y * GRID_SIZE)
      ctx.lineTo(v2.x * GRID_SIZE, v2.y * GRID_SIZE)
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 8 / zoom
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.lineCap = 'butt'
    }
    
    // Draw vertices
    vertices.forEach((v, i) => {
      // Different styling in wall edit mode
      const isEditingThisVertex = editingVertex === i
      const isSelectedVertex = wallEditMode && selectedVertexIdx === i
      const isInEditMode = wallEditMode
      
      // Larger handles in wall edit mode
      let radius = 8 / zoom
      if (isInEditMode) radius = 10 / zoom
      if (isEditingThisVertex || isSelectedVertex) radius = 12 / zoom
      
      // Outer circle
      ctx.beginPath()
      ctx.arc(v.x * GRID_SIZE, v.y * GRID_SIZE, radius, 0, Math.PI * 2)
      
      // Color based on state
      if (isEditingThisVertex || isSelectedVertex) {
        ctx.fillStyle = '#22c55e' // Green for selected/editing
      } else if (isInEditMode) {
        ctx.fillStyle = '#3b82f6' // Blue in edit mode
      } else {
        ctx.fillStyle = '#3b82f6' // Blue normally
      }
      ctx.fill()
      
      // Border
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = (isInEditMode ? 3 : 2) / zoom
      ctx.stroke()
      
      // Inner dot
      ctx.beginPath()
      ctx.arc(v.x * GRID_SIZE, v.y * GRID_SIZE, 3 / zoom, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
      
      // Vertex number in edit mode
      if (isInEditMode) {
        ctx.font = `bold ${10 / zoom}px Inter, Arial, sans-serif`
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${i + 1}`, v.x * GRID_SIZE, v.y * GRID_SIZE - radius - 8 / zoom)
      }
    })
    
    // Draw placed items
    items.forEach((item, idx) => {
      const x = item.x * GRID_SIZE
      const y = item.y * GRID_SIZE
      const w = item.w * GRID_SIZE
      const h = item.h * GRID_SIZE
      
      ctx.save()
      
      // Rotate around center if needed
      if (item.rotation && item.rotation !== 0) {
        const cx = x + w / 2
        const cy = y + h / 2
        ctx.translate(cx, cy)
        ctx.rotate((item.rotation * Math.PI) / 180)
        ctx.translate(-cx, -cy)
      }
      
      // Check if this is a column
      if (item.columnType) {
        const centerX = x + w / 2
        const centerY = y + h / 2
        
        if (item.columnType === 'round') {
          // Draw round column as circle
          const radius = w / 2
          ctx.beginPath()
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
          ctx.fillStyle = item.color + 'cc'
          ctx.fill()
          ctx.strokeStyle = selectedItem === idx ? '#22c55e' : 'rgba(255,255,255,0.7)'
          ctx.lineWidth = (selectedItem === idx ? 3 : 2) / zoom
          ctx.stroke()
          
          // Inner detail circle
          ctx.beginPath()
          ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'
          ctx.lineWidth = 1 / zoom
          ctx.stroke()
        } else {
          // Draw square/rectangular column
          ctx.fillStyle = item.color + 'cc'
          ctx.fillRect(x, y, w, h)
          ctx.strokeStyle = selectedItem === idx ? '#22c55e' : 'rgba(255,255,255,0.7)'
          ctx.lineWidth = (selectedItem === idx ? 3 : 2) / zoom
          ctx.strokeRect(x, y, w, h)
          
          // Inner detail
          const inset = 3 / zoom
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'
          ctx.lineWidth = 1 / zoom
          ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2)
        }
        
        // Column size label
        const sizeLabel = item.columnDepth 
          ? `${item.columnSize}"×${item.columnDepth}"`
          : `${item.columnSize}"`
        ctx.font = `bold ${9 / zoom}px Inter, Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillText(sizeLabel, centerX + 1/zoom, centerY + 1/zoom)
        ctx.fillStyle = '#fff'
        ctx.fillText(sizeLabel, centerX, centerY)
      } else if (item.isRentalZone) {
        // Rental Zone rendering (pallet-storage or space-storage)
        // Semi-transparent fill with dashed border
        ctx.fillStyle = item.color + '40' // More transparent
        ctx.fillRect(x, y, w, h)
        
        // Dashed border
        ctx.setLineDash([8 / zoom, 4 / zoom])
        ctx.strokeStyle = selectedItem === idx ? '#22c55e' : item.color
        ctx.lineWidth = (selectedItem === idx ? 3 : 2) / zoom
        ctx.strokeRect(x, y, w, h)
        ctx.setLineDash([])
        
        // Zone label with background
        const zoneName = item.zoneName || (item.zoneType === 'pallet-storage' ? 'Pallet Zone' : 'Space Zone')
        const zoneIcon = item.zoneType === 'pallet-storage' ? '📦' : '📐'
        ctx.font = `bold ${12 / zoom}px Inter, Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // Zone type badge at top
        const badgeText = `${zoneIcon} ${zoneName}`
        const textWidth = ctx.measureText(badgeText).width
        ctx.fillStyle = item.color + 'dd'
        ctx.fillRect(x + w/2 - textWidth/2 - 6/zoom, y + 8/zoom, textWidth + 12/zoom, 20/zoom)
        ctx.fillStyle = '#fff'
        ctx.fillText(badgeText, x + w/2, y + 18/zoom)
        
        // Area size
        ctx.font = `${10 / zoom}px Inter, Arial, sans-serif`
        ctx.fillStyle = '#fff'
        ctx.fillText(`${(item.w * item.h).toLocaleString()} sq ft`, x + w/2, y + h/2)
        
        // Tenant name if set
        if (item.tenantName) {
          ctx.font = `${9 / zoom}px Inter, Arial, sans-serif`
          ctx.fillStyle = '#a3e635'
          ctx.fillText(`🔒 ${item.tenantName}`, x + w/2, y + h/2 + 14/zoom)
        }
        
      } else if (item.isRentedMarker) {
        // Rented space marker - green with lock pattern
        ctx.fillStyle = item.color + '30'
        ctx.fillRect(x, y, w, h)
        
        // Diagonal lines pattern
        ctx.strokeStyle = item.color + '60'
        ctx.lineWidth = 1 / zoom
        for (let i = 0; i < w + h; i += 20 / zoom) {
          ctx.beginPath()
          ctx.moveTo(x + Math.min(i, w), y + Math.max(0, i - w))
          ctx.lineTo(x + Math.max(0, i - h), y + Math.min(i, h))
          ctx.stroke()
        }
        
        // Border
        ctx.strokeStyle = selectedItem === idx ? '#22c55e' : item.color
        ctx.lineWidth = (selectedItem === idx ? 3 : 2) / zoom
        ctx.strokeRect(x, y, w, h)
        
        // Label
        const rentedLabel = item.tenantName || 'Rented'
        ctx.font = `bold ${11 / zoom}px Inter, Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillText(`🔒 ${rentedLabel}`, x + w/2 + 1/zoom, y + h/2 + 1/zoom)
        ctx.fillStyle = '#fff'
        ctx.fillText(`🔒 ${rentedLabel}`, x + w/2, y + h/2)
        
      } else if (item.barrierType === 'cage') {
        // Storage cage - wire mesh pattern
        ctx.fillStyle = item.color + '20'
        ctx.fillRect(x, y, w, h)
        
        // Wire mesh pattern
        ctx.strokeStyle = item.color
        ctx.lineWidth = 0.5 / zoom
        const meshSize = 10 / zoom
        for (let mx = x; mx <= x + w; mx += meshSize) {
          ctx.beginPath()
          ctx.moveTo(mx, y)
          ctx.lineTo(mx, y + h)
          ctx.stroke()
        }
        for (let my = y; my <= y + h; my += meshSize) {
          ctx.beginPath()
          ctx.moveTo(x, my)
          ctx.lineTo(x + w, my)
          ctx.stroke()
        }
        
        // Thicker border
        ctx.strokeStyle = selectedItem === idx ? '#22c55e' : item.color
        ctx.lineWidth = (selectedItem === idx ? 3 : 2) / zoom
        ctx.strokeRect(x, y, w, h)
        
        // Label
        ctx.font = `bold ${10 / zoom}px Inter, Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        ctx.fillRect(x + w/2 - 25/zoom, y + h/2 - 8/zoom, 50/zoom, 16/zoom)
        ctx.fillStyle = '#fff'
        ctx.fillText(item.tenantName || 'Cage', x + w/2, y + h/2)
        
      } else if (item.barrierType === 'fence' || item.barrierType === 'tape') {
        // Fence or tape line
        ctx.strokeStyle = selectedItem === idx ? '#22c55e' : item.color
        ctx.lineWidth = (item.barrierType === 'tape' ? 4 : 6) / zoom
        if (item.barrierType === 'tape') {
          ctx.setLineDash([10 / zoom, 5 / zoom])
        }
        ctx.beginPath()
        ctx.moveTo(x, y + h/2)
        ctx.lineTo(x + w, y + h/2)
        ctx.stroke()
        ctx.setLineDash([])
        
        // Fence posts
        if (item.barrierType === 'fence') {
          ctx.fillStyle = '#52525b'
          const postCount = Math.ceil(item.w / 5) + 1
          for (let i = 0; i < postCount; i++) {
            const postX = x + (i * w / (postCount - 1)) - 3/zoom
            ctx.fillRect(postX, y, 6/zoom, h)
          }
        }
        
      } else if (item.barrierType === 'bollard') {
        // Safety bollard - yellow circle
        const centerX = x + w / 2
        const centerY = y + h / 2
        const radius = w / 2
        
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.fillStyle = item.color
        ctx.fill()
        ctx.strokeStyle = selectedItem === idx ? '#22c55e' : '#000'
        ctx.lineWidth = (selectedItem === idx ? 3 : 2) / zoom
        ctx.stroke()
        
      } else {
        // Regular item rendering
        ctx.fillStyle = item.color + 'cc'
        ctx.fillRect(x, y, w, h)
        ctx.strokeStyle = selectedItem === idx ? '#22c55e' : 'rgba(255,255,255,0.5)'
        ctx.lineWidth = (selectedItem === idx ? 3 : 1) / zoom
        ctx.strokeRect(x, y, w, h)
        
        // Item label (use customLabel if available)
        const displayName = item.customLabel || item.name
        ctx.font = `bold ${11 / zoom}px Inter, Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // Text shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillText(displayName, x + w/2 + 1/zoom, y + h/2 + 1/zoom)
        ctx.fillStyle = '#fff'
        ctx.fillText(displayName, x + w/2, y + h/2)
        
        if (item.pallets > 0) {
          ctx.font = `${10 / zoom}px Inter, Arial, sans-serif`
          ctx.fillStyle = '#a3e635'
          ctx.fillText(`${item.pallets} pallets`, x + w/2, y + h/2 + 14/zoom)
        }
      }
      
      ctx.restore()
    })
    
    // Draw rotation handle for selected item
    if (selectedItem !== null && items[selectedItem] && !dragItem) {
      const item = items[selectedItem]
      const x = item.x * GRID_SIZE
      const y = item.y * GRID_SIZE
      const w = item.w * GRID_SIZE
      const h = item.h * GRID_SIZE
      const cx = x + w / 2
      const cy = y + h / 2
      
      // Calculate radius for rotation ring (slightly larger than item)
      const maxDim = Math.max(w, h)
      const radius = maxDim / 2 + 20 / zoom
      
      // Draw rotation ring
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = isRotating ? '#22c55e' : 'rgba(34, 197, 94, 0.5)'
      ctx.lineWidth = (isRotating ? 4 : 3) / zoom
      ctx.setLineDash([8 / zoom, 4 / zoom])
      ctx.stroke()
      ctx.setLineDash([])
      
      // Draw rotation indicator at current angle
      const currentAngle = ((item.rotation || 0) * Math.PI) / 180
      const indicatorX = cx + Math.cos(currentAngle - Math.PI / 2) * radius
      const indicatorY = cy + Math.sin(currentAngle - Math.PI / 2) * radius
      
      // Draw handle circle
      ctx.beginPath()
      ctx.arc(indicatorX, indicatorY, 8 / zoom, 0, Math.PI * 2)
      ctx.fillStyle = isRotating ? '#22c55e' : '#fff'
      ctx.fill()
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 2 / zoom
      ctx.stroke()
      
      // Draw rotation icon in handle
      ctx.font = `${10 / zoom}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = isRotating ? '#fff' : '#22c55e'
      ctx.fillText('↻', indicatorX, indicatorY)
      
      // Show current rotation angle
      ctx.font = `bold ${12 / zoom}px Inter, Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(cx - 25/zoom, cy - radius - 25/zoom, 50/zoom, 18/zoom)
      ctx.fillStyle = '#22c55e'
      ctx.fillText(`${item.rotation || 0}°`, cx, cy - radius - 16/zoom)
    }
    
    // Draw wall openings (doors/windows)
    wallOpenings.forEach((opening, idx) => {
      const v1 = vertices[opening.wallIndex]
      const v2 = vertices[(opening.wallIndex + 1) % vertices.length]
      
      if (!v1 || !v2) return
      
      // Calculate position along wall
      const x = (v1.x + (v2.x - v1.x) * opening.position) * GRID_SIZE
      const y = (v1.y + (v2.y - v1.y) * opening.position) * GRID_SIZE
      
      // Calculate wall angle
      const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x)
      
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      
      // Door/window dimensions
      const w = opening.width * GRID_SIZE
      const doorColors: Record<string, string> = {
        dock: '#3b82f6',
        personnel: '#6b7280',
        emergency: '#22c55e',
        rollup: '#f59e0b',
        window: '#06b6d4'
      }
      
      const color = doorColors[opening.type] || '#ffffff'
      const isSelected = selectedOpening === idx
      
      // Draw door/window body
      ctx.fillStyle = color + 'cc'
      ctx.fillRect(-w/2, -4 / zoom, w, 8 / zoom)
      
      // Selection highlight
      ctx.strokeStyle = isSelected ? '#22c55e' : '#ffffff'
      ctx.lineWidth = (isSelected ? 3 : 1) / zoom
      ctx.strokeRect(-w/2, -4 / zoom, w, 8 / zoom)
      
      // Door swing arc (for personnel/emergency doors)
      if (opening.type === 'personnel' || opening.type === 'emergency') {
        ctx.beginPath()
        ctx.arc(-w/2, 0, w * 0.7, 0, Math.PI / 2)
        ctx.strokeStyle = color
        ctx.lineWidth = 1 / zoom
        ctx.setLineDash([3 / zoom, 3 / zoom])
        ctx.stroke()
        ctx.setLineDash([])
      }
      
      // Label
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${9 / zoom}px Inter, Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(opening.type.toUpperCase(), 0, -12 / zoom)
      
      ctx.restore()
    })
    
    // Draw drag preview
    if (dragItem) {
      const x = dragItem.x * GRID_SIZE
      const y = dragItem.y * GRID_SIZE
      const w = dragItem.w * GRID_SIZE
      const h = dragItem.h * GRID_SIZE
      
      // Check if this is a wall item being dragged near a wall
      const isWallItem = dragItem.wallItem
      const nearWall = isWallItem ? findClosestWall({ x: dragItem.x, y: dragItem.y }) : null
      
      if (isWallItem && nearWall) {
        // Draw door preview on wall
        const v1 = vertices[nearWall.wallIndex]
        const v2 = vertices[(nearWall.wallIndex + 1) % vertices.length]
        const wx = (v1.x + (v2.x - v1.x) * nearWall.position) * GRID_SIZE
        const wy = (v1.y + (v2.y - v1.y) * nearWall.position) * GRID_SIZE
        const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x)
        
        ctx.save()
        ctx.translate(wx, wy)
        ctx.rotate(angle)
        
        ctx.fillStyle = dragItem.color + '66'
        ctx.fillRect(-w/2, -4 / zoom, w, 8 / zoom)
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 2 / zoom
        ctx.setLineDash([5 / zoom, 5 / zoom])
        ctx.strokeRect(-w/2, -4 / zoom, w, 8 / zoom)
        ctx.setLineDash([])
        
        ctx.restore()
      } else if (!isWallItem) {
        // Normal item drag preview
        const itemBox = { x: dragItem.x, y: dragItem.y, w: dragItem.w, h: dragItem.h }
        const isValid = isInsideWarehouse(itemBox) && !hasCollision(itemBox)
        
        ctx.fillStyle = dragItem.color + '66'
        ctx.fillRect(x, y, w, h)
        ctx.strokeStyle = isValid ? '#22c55e' : '#ef4444'
        ctx.lineWidth = 2 / zoom
        ctx.setLineDash([5 / zoom, 5 / zoom])
        ctx.strokeRect(x, y, w, h)
        ctx.setLineDash([])
        
        // Invalid placement indicator
        if (!isValid) {
          ctx.font = `bold ${14 / zoom}px Inter, Arial, sans-serif`
          ctx.fillStyle = '#ef4444'
          ctx.textAlign = 'center'
          ctx.fillText('✕', x + w/2, y + h/2)
        }
      }
    }
    
    ctx.restore()
  }, [vertices, items, wallOpenings, selectedItem, selectedOpening, dragItem, editingVertex, editingWall, zoom, pan, isInsideWarehouse, hasCollision, findClosestWall, wallEditMode, selectedWallIdx, selectedVertexIdx, isRotating, canvasSize, areas, selectedAreaId, selectedAreaVertexIdx, areaDrawMode, drawingAreaVertices, isDraggingArea, snapLines, isAreaInsideAnother, getAreaBounds])
  
  // Get closest point on wall segment (for wall click detection)
  const getClosestPointOnWall = useCallback((mousePos: { x: number; y: number }, wallIdx: number): { t: number; dist: number } => {
    const v1 = vertices[wallIdx]
    const v2 = vertices[(wallIdx + 1) % vertices.length]
    
    const dx = v2.x - v1.x
    const dy = v2.y - v1.y
    const lenSq = dx * dx + dy * dy
    
    if (lenSq === 0) return { t: 0, dist: Infinity }
    
    // Project mouse onto line, clamp to segment
    let t = ((mousePos.x - v1.x) * dx + (mousePos.y - v1.y) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    
    const closestX = v1.x + t * dx
    const closestY = v1.y + t * dy
    const dist = Math.sqrt(Math.pow(mousePos.x - closestX, 2) + Math.pow(mousePos.y - closestY, 2))
    
    return { t, dist }
  }, [vertices])
  
  // Find wall at click position (for wall edit mode)
  const findWallAtPos = useCallback((pos: { x: number; y: number }): number | null => {
    for (let i = 0; i < vertices.length; i++) {
      const { t, dist } = getClosestPointOnWall(pos, i)
      // Within 2 feet of wall, not too close to vertices (middle 80%)
      if (dist < 2 && t > 0.1 && t < 0.9) {
        return i
      }
    }
    return null
  }, [vertices, getClosestPointOnWall])
  
  // Find vertex at click position
  const findVertexAtPos = useCallback((pos: { x: number; y: number }): number | null => {
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i]
      const dist = Math.sqrt(Math.pow(pos.x - v.x, 2) + Math.pow(pos.y - v.y, 2))
      if (dist < 1.5) { // Within 1.5 feet of vertex
        return i
      }
    }
    return null
  }, [vertices])
  
  // Exit wall edit mode
  const exitWallEditMode = useCallback(() => {
    setWallEditMode(false)
    setSelectedWallIdx(null)
    setSelectedVertexIdx(null)
    setIsDraggingVertex(false)
  }, [])
  
  // Close context menu on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.visible) {
        setContextMenu(prev => ({ ...prev, visible: false }))
      }
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [contextMenu.visible])
  
  // Handle right-click on canvas
  const handleCanvasContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    
    // Don't show context menu if we were just panning
    if (wasPanning || isPanning) {
      return
    }
    
    const pos = getGridPos(e)
    
    // Check if right-clicked on an item
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      if (pos.x >= item.x && pos.x < item.x + item.w &&
          pos.y >= item.y && pos.y < item.y + item.h) {
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          itemIndex: i
        })
        setSelectedItem(i)
        setAreaContextMenu({ visible: false, x: 0, y: 0, areaId: null })
        return
      }
    }
    
    // Check if right-clicked on an area
    for (const area of areas) {
      if (area.vertices && area.vertices.length >= 3) {
        if (isPointInPolygon(pos, area.vertices)) {
          setAreaContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            areaId: area.id
          })
          setSelectedAreaId(area.id)
          setContextMenu({ visible: false, x: 0, y: 0, itemIndex: null })
          return
        }
      }
    }
    
    // Right-clicked on empty space - hide menus
    setContextMenu({ visible: false, x: 0, y: 0, itemIndex: null })
    setAreaContextMenu({ visible: false, x: 0, y: 0, areaId: null })
  }, [items, areas, getGridPos, isPointInPolygon, wasPanning, isPanning])
  
  // Open edit modal for item
  const openEditModal = useCallback((itemIndex: number) => {
    const item = items[itemIndex]
    if (!item) return
    
    // Ensure item has a type
    const itemWithType = {
      ...item,
      type: getItemType(item),
      height: item.height || (getItemType(item) === 'rack' ? 16 : 4),
      beamLevels: item.beamLevels || 4,
      bayWidth: item.bayWidth || 8,
      palletPositions: item.palletPositions || 3,
      aisleWidth: item.aisleWidth || 12
    }
    
    setEditingItem(itemWithType as PlacedItem)
    setEditingItemIndex(itemIndex)
    setEditModalOpen(true)
    setContextMenu({ visible: false, x: 0, y: 0, itemIndex: null })
  }, [items, getItemType])
  
  // Save edited item
  const saveEditedItem = useCallback(() => {
    if (editingItem === null || editingItemIndex === null) return
    
    // Validate
    const errors = validateDimensions(editingItem)
    if (errors.length > 0) {
      toast({ title: errors[0], variant: 'destructive' })
      return
    }
    
    // Recalculate pallets for racks
    const updatedItem = {
      ...editingItem,
      pallets: calculatePallets(editingItem)
    }
    
    const newItems = [...items]
    newItems[editingItemIndex] = updatedItem
    setItems(newItems)
    saveToHistory(vertices, newItems)
    
    setEditModalOpen(false)
    setEditingItem(null)
    setEditingItemIndex(null)
    
    toast({ title: 'Item updated!', variant: 'success' })
  }, [editingItem, editingItemIndex, items, vertices, saveToHistory, validateDimensions, calculatePallets, toast])
  
  // Context menu actions
  const contextMenuDuplicate = useCallback(() => {
    if (contextMenu.itemIndex === null) return
    const item = items[contextMenu.itemIndex]
    if (!item) return
    
    const newItem: PlacedItem = {
      ...item,
      instanceId: Date.now(),
      x: item.x + 2,
      y: item.y + 2,
      customLabel: item.customLabel ? `${item.customLabel} (Copy)` : undefined
    }
    
    const newItems = [...items, newItem]
    setItems(newItems)
    setSelectedItem(newItems.length - 1)
    saveToHistory(vertices, newItems)
    setContextMenu({ visible: false, x: 0, y: 0, itemIndex: null })
  }, [contextMenu.itemIndex, items, vertices, saveToHistory])
  
  const contextMenuRotate = useCallback(() => {
    if (contextMenu.itemIndex === null) return
    const item = items[contextMenu.itemIndex]
    if (!item) return
    
    const newItems = [...items]
    newItems[contextMenu.itemIndex] = {
      ...item,
      w: item.h,
      h: item.w,
      rotation: ((item.rotation || 0) + 90) % 360
    }
    setItems(newItems)
    saveToHistory(vertices, newItems)
    setContextMenu({ visible: false, x: 0, y: 0, itemIndex: null })
  }, [contextMenu.itemIndex, items, vertices, saveToHistory])
  
  const contextMenuDelete = useCallback(() => {
    if (contextMenu.itemIndex === null) return
    
    const newItems = items.filter((_, i) => i !== contextMenu.itemIndex)
    setItems(newItems)
    setSelectedItem(null)
    saveToHistory(vertices, newItems)
    setContextMenu({ visible: false, x: 0, y: 0, itemIndex: null })
  }, [contextMenu.itemIndex, items, vertices, saveToHistory])
  
  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle mouse (button 1) or Right mouse (button 2) for panning
    if (e.button === 1 || e.button === 2) {
      e.preventDefault()
      setIsPanning(true)
      setLastPan({ x: e.clientX, y: e.clientY })
      return
    }
    
    if (e.button !== 0) return
    
    const pos = getGridPos(e)
    const canvasPos = getCanvasPos(e)
    
    // Wall edit mode - different interaction logic
    if (wallEditMode) {
      // First, check for vertex click
      const vertexIdx = findVertexAtPos(pos)
      if (vertexIdx !== null) {
        setSelectedVertexIdx(vertexIdx)
        setSelectedWallIdx(null)
        setIsDraggingVertex(true)
        setWallToolbarPos({ x: canvasPos.x + 20, y: canvasPos.y + 20 })
        return
      }
      
      // Then, check for wall click
      const wallIdx = findWallAtPos(pos)
      if (wallIdx !== null) {
        setSelectedWallIdx(wallIdx)
        setSelectedVertexIdx(null)
        setWallToolbarPos({ x: canvasPos.x + 20, y: canvasPos.y + 20 })
        return
      }
      
      // Click on empty space - deselect
      setSelectedWallIdx(null)
      setSelectedVertexIdx(null)
      return
    }
    
    // Area draw mode - polygon drawing like warehouse boundary
    if (areaDrawMode) {
      // Check if clicking on first vertex to close the polygon (need at least 3 vertices)
      if (drawingAreaVertices.length >= 3) {
        const firstV = drawingAreaVertices[0]
        // Use pixel-based detection for better UX - the green circle has radius 10/zoom pixels
        const canvasPos = getCanvasPos(e)
        const firstVPixelX = firstV.x * GRID_SIZE * zoom + pan.x
        const firstVPixelY = firstV.y * GRID_SIZE * zoom + pan.y
        const pixelDist = Math.sqrt(Math.pow(canvasPos.x - firstVPixelX, 2) + Math.pow(canvasPos.y - firstVPixelY, 2))
        // Click threshold: match the visual green circle size (radius 10/zoom * zoom = 10 pixels) + some padding
        const clickThreshold = 20 // 20 pixels for easier clicking
        if (pixelDist < clickThreshold) {
          // Close the polygon - create the area
          const areaColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
          const newArea: FloorArea = {
            id: `area-${Date.now()}`,
            name: `Area ${areas.length + 1}`,
            type: drawingAreaType,
            vertices: [...drawingAreaVertices],
            color: areaColors[areas.length % areaColors.length]
          }
          setAreas([...areas, newArea])
          setDrawingAreaVertices([])
          setAreaDrawMode(false)
          setHasUnsavedChanges(true)
          toast({ title: `Area "${newArea.name}" created!`, variant: 'success' })
          return
        }
      }
      
      // Add new vertex
      setDrawingAreaVertices([...drawingAreaVertices, { x: pos.x, y: pos.y }])
      return
    }
    
    // Check if clicking on an area (for selection or dragging)
    if (!areaDrawMode) {
      // First check interactions with selected area
      if (selectedAreaId) {
        const selectedArea = areas.find(a => a.id === selectedAreaId)
        if (selectedArea && selectedArea.vertices.length >= 3) {
          const center = getAreaCenter(selectedArea.vertices)
          const bounds = getAreaBounds(selectedArea.vertices)
          const handleDistance = Math.max(bounds.maxY - bounds.minY, bounds.maxX - bounds.minX) / 2 + 3
          const rotationHandleY = center.y - handleDistance
          
          // Check rotation handle click
          const rotationDist = Math.sqrt(Math.pow(pos.x - center.x, 2) + Math.pow(pos.y - rotationHandleY, 2))
          if (rotationDist < 1.5) {
            // Start area rotation
            setIsRotatingArea(true)
            const startAngle = Math.atan2(pos.y - center.y, pos.x - center.x) * 180 / Math.PI
            setAreaRotationStart(startAngle)
            setAreaOriginalRotation(selectedArea.rotation || 0)
            setAreaOriginalVertices([...selectedArea.vertices])
            setRotationCenter(center)
            return
          }
          
          // Check corner (vertex) click - drag only that vertex
          for (let i = 0; i < selectedArea.vertices.length; i++) {
            const v = selectedArea.vertices[i]
            const dist = Math.sqrt(Math.pow(pos.x - v.x, 2) + Math.pow(pos.y - v.y, 2))
            if (dist < 1.5) {
              // Start dragging just this vertex (like warehouse boundary)
              setSelectedAreaVertexIdx(i)
              setIsDraggingAreaVertex(true)
              return
            }
          }
          
          // If clicking inside selected area (not on handles), start dragging entire area
          if (isPointInPolygon(pos, selectedArea.vertices)) {
            setIsDraggingArea(true)
            setAreaDragStart(pos)
            setAreaOriginalVertices([...selectedArea.vertices])
            setSelectedAreaVertexIdx(null)
            return
          }
        }
      }
      
      // Check if clicking inside any area (for selection)
      for (const area of areas) {
        if (area.vertices && area.vertices.length >= 3) {
          if (isPointInPolygon(pos, area.vertices)) {
            setSelectedAreaId(area.id)
            setSelectedAreaVertexIdx(null)
            setSelectedItem(null)
            // If this is a new selection, also start dragging immediately
            setIsDraggingArea(true)
            setAreaDragStart(pos)
            setAreaOriginalVertices([...area.vertices])
            return
          }
        }
      }
    }
    
    // Normal mode - existing logic
    
    // Check rotation handle click (if item is selected)
    if (selectedItem !== null && items[selectedItem]) {
      const item = items[selectedItem]
      const cx = item.x + item.w / 2
      const cy = item.y + item.h / 2
      const maxDim = Math.max(item.w, item.h)
      const radius = maxDim / 2 + 20 / GRID_SIZE  // Same as drawing
      
      // Check if click is on or near the rotation ring
      const distFromCenter = Math.sqrt(Math.pow(pos.x - cx, 2) + Math.pow(pos.y - cy, 2))
      const ringTolerance = 3  // feet tolerance
      
      if (Math.abs(distFromCenter - radius) < ringTolerance) {
        // Start rotation
        setIsRotating(true)
        const startAngle = Math.atan2(pos.y - cy, pos.x - cx) * 180 / Math.PI
        setRotationStartAngle(startAngle)
        setItemStartRotation(item.rotation || 0)
        return
      }
    }
    
    // Check vertex click
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i]
      if (Math.abs(pos.x - v.x) <= 1 && Math.abs(pos.y - v.y) <= 1) {
        setEditingVertex(i)
        setSelectedItem(null)
        setEditingWall(null)
        return
      }
    }
    
    // Check wall click for editing length
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i]
      const v2 = vertices[(i + 1) % vertices.length]
      
      if (isPointOnLine(pos, v1, v2, 1.5)) {
        const len = Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2))
        setEditingWall(i)
        setWallLength(len.toFixed(0))
        setWallEditPos({ x: canvasPos.x + 20, y: canvasPos.y - 50 })
        setSelectedItem(null)
        setEditingVertex(null)
        return
      }
    }
    
    // Check wall opening click
    for (let i = 0; i < wallOpenings.length; i++) {
      const opening = wallOpenings[i]
      const v1 = vertices[opening.wallIndex]
      const v2 = vertices[(opening.wallIndex + 1) % vertices.length]
      
      if (v1 && v2) {
        const ox = v1.x + (v2.x - v1.x) * opening.position
        const oy = v1.y + (v2.y - v1.y) * opening.position
        
        if (Math.abs(pos.x - ox) < opening.width / 2 + 1 && Math.abs(pos.y - oy) < 2) {
          setSelectedOpening(i)
          setSelectedItem(null)
          setEditingVertex(null)
          setEditingWall(null)
          return
        }
      }
    }
    
    // Check item click
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      if (pos.x >= item.x && pos.x < item.x + item.w &&
          pos.y >= item.y && pos.y < item.y + item.h) {
        setSelectedItem(i)
        setSelectedOpening(null)
        setDragOffset({ x: pos.x - item.x, y: pos.y - item.y })
        setEditingVertex(null)
        setEditingWall(null)
        return
      }
    }
    
    setSelectedItem(null)
    setSelectedOpening(null)
    setSelectedAreaId(null)
    setEditingVertex(null)
    setEditingWall(null)
  }, [vertices, items, wallOpenings, areas, getGridPos, getCanvasPos, isPointOnLine, isPointInPolygon, wallEditMode, areaDrawMode, drawingAreaVertices, drawingAreaType, findVertexAtPos, findWallAtPos, selectedItem, selectedAreaId, zoom, pan, toast, getAreaCenter, getAreaBounds, rotateVertices])
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Panning
    if (isPanning) {
      setPan(p => ({
        x: p.x + (e.clientX - lastPan.x),
        y: p.y + (e.clientY - lastPan.y)
      }))
      setLastPan({ x: e.clientX, y: e.clientY })
      return
    }
    
    const pos = getGridPos(e)
    
    // Rotation handling
    if (isRotating && selectedItem !== null && items[selectedItem]) {
      const item = items[selectedItem]
      const cx = item.x + item.w / 2
      const cy = item.y + item.h / 2
      
      // Calculate current angle from center to mouse
      const currentAngle = Math.atan2(pos.y - cy, pos.x - cx) * 180 / Math.PI
      
      // Calculate rotation delta
      let delta = currentAngle - rotationStartAngle
      
      // Normalize delta
      while (delta > 180) delta -= 360
      while (delta < -180) delta += 360
      
      // Calculate new rotation
      let newRotation = itemStartRotation + delta
      
      // Normalize to 0-360
      while (newRotation < 0) newRotation += 360
      while (newRotation >= 360) newRotation -= 360
      
      // Snap to 15 degree increments if shift is not held
      if (!e.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15
      }
      
      // Update item rotation
      const newItems = [...items]
      newItems[selectedItem] = { ...newItems[selectedItem], rotation: Math.round(newRotation) }
      setItems(newItems)
      return
    }
    
    // Wall edit mode vertex dragging
    if (wallEditMode && isDraggingVertex && selectedVertexIdx !== null) {
      const newVerts = [...vertices]
      newVerts[selectedVertexIdx] = { x: Math.round(Math.max(0, pos.x)), y: Math.round(Math.max(0, pos.y)) }
      setVertices(newVerts)
      return
    }
    
    // Area vertex dragging
    if (isDraggingAreaVertex && selectedAreaId && selectedAreaVertexIdx !== null) {
      const areaIdx = areas.findIndex(a => a.id === selectedAreaId)
      if (areaIdx >= 0) {
        const newAreas = [...areas]
        const newVertices = [...newAreas[areaIdx].vertices]
        newVertices[selectedAreaVertexIdx] = { x: Math.round(Math.max(0, pos.x)), y: Math.round(Math.max(0, pos.y)) }
        newAreas[areaIdx] = { ...newAreas[areaIdx], vertices: newVertices }
        setAreas(newAreas)
      }
      return
    }
    
    // Entire area dragging with snapping
    if (isDraggingArea && selectedAreaId && areaDragStart && areaOriginalVertices.length > 0) {
      const areaIdx = areas.findIndex(a => a.id === selectedAreaId)
      if (areaIdx >= 0) {
        // Calculate offset from drag start
        const dx = pos.x - areaDragStart.x
        const dy = pos.y - areaDragStart.y
        
        // Apply offset to original vertices
        const movedVertices = areaOriginalVertices.map(v => ({
          x: Math.round(Math.max(0, v.x + dx)),
          y: Math.round(Math.max(0, v.y + dy))
        }))
        
        // Find snap points
        const { snappedVertices, snapLines: newSnapLines } = findSnapPoints(selectedAreaId, movedVertices)
        setSnapLines(newSnapLines)
        
        // Update area with snapped vertices
        const newAreas = [...areas]
        newAreas[areaIdx] = { ...newAreas[areaIdx], vertices: snappedVertices }
        setAreas(newAreas)
      }
      return
    }
    
    // Area rotation
    if (isRotatingArea && selectedAreaId && rotationCenter && areaOriginalVertices.length > 0) {
      const areaIdx = areas.findIndex(a => a.id === selectedAreaId)
      if (areaIdx >= 0) {
        // Calculate current angle from center to mouse
        const currentAngle = Math.atan2(pos.y - rotationCenter.y, pos.x - rotationCenter.x) * 180 / Math.PI
        
        // Calculate rotation delta
        let delta = currentAngle - areaRotationStart
        
        // Normalize delta
        while (delta > 180) delta -= 360
        while (delta < -180) delta += 360
        
        // Snap to 15 degree increments if shift is not held
        if (!e.shiftKey) {
          delta = Math.round(delta / 15) * 15
        }
        
        // Rotate vertices around center
        const rotatedVertices = rotateVertices(areaOriginalVertices, rotationCenter, delta)
        
        // Update area
        const newAreas = [...areas]
        newAreas[areaIdx] = { ...newAreas[areaIdx], vertices: rotatedVertices, rotation: (areaOriginalRotation + delta + 360) % 360 }
        setAreas(newAreas)
      }
      return
    }
    
    // Normal vertex editing
    if (editingVertex !== null) {
      const newVerts = [...vertices]
      newVerts[editingVertex] = { x: Math.max(0, pos.x), y: Math.max(0, pos.y) }
      setVertices(newVerts)
    }
    
    // Item dragging (disabled in wall edit mode)
    if (!wallEditMode && selectedItem !== null && e.buttons === 1) {
      const newItems = [...items]
      const newX = Math.max(0, pos.x - dragOffset.x)
      const newY = Math.max(0, pos.y - dragOffset.y)
      newItems[selectedItem] = {
        ...newItems[selectedItem],
        x: newX,
        y: newY
      }
      setItems(newItems)
    }
    
    if (dragItem) {
      setDragItem({ ...dragItem, x: pos.x, y: pos.y })
    }
  }, [editingVertex, selectedItem, dragItem, vertices, items, areas, dragOffset, getGridPos, isPanning, lastPan, wallEditMode, isDraggingVertex, selectedVertexIdx, isRotating, rotationStartAngle, itemStartRotation, isDraggingAreaVertex, selectedAreaId, selectedAreaVertexIdx, isDraggingArea, areaDragStart, areaOriginalVertices, findSnapPoints, isRotatingArea, areaRotationStart, areaOriginalRotation, rotateVertices])
  
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      setWasPanning(true) // Mark that we just finished panning
      // Reset wasPanning after a short delay so context menu doesn't show
      setTimeout(() => setWasPanning(false), 100)
      return
    }
    
    // End rotation
    if (isRotating) {
      setIsRotating(false)
      saveToHistory(vertices, items)
      return
    }
    
    // Wall edit mode - end vertex dragging
    if (wallEditMode && isDraggingVertex) {
      setIsDraggingVertex(false)
      saveToHistory(vertices, items)
      return
    }
    
    // Area vertex dragging end
    if (isDraggingAreaVertex) {
      setIsDraggingAreaVertex(false)
      setHasUnsavedChanges(true)
      return
    }
    
    // Entire area dragging end
    if (isDraggingArea) {
      setIsDraggingArea(false)
      setAreaDragStart(null)
      setAreaOriginalVertices([])
      setSnapLines([])
      setHasUnsavedChanges(true)
      return
    }
    
    // Area rotation end
    if (isRotatingArea) {
      setIsRotatingArea(false)
      setAreaRotationStart(0)
      setAreaOriginalRotation(0)
      setAreaOriginalVertices([])
      setRotationCenter(null)
      setHasUnsavedChanges(true)
      return
    }
    
    
    if (dragItem) {
      // Check if this is a wall item (door/window)
      if (dragItem.wallItem) {
        const wall = findClosestWall({ x: dragItem.x, y: dragItem.y })
        
        if (wall && wall.position >= 0.05 && wall.position <= 0.95) {
          const newOpening: WallOpening = {
            id: Date.now(),
            wallIndex: wall.wallIndex,
            type: dragItem.id as WallOpening['type'],
            position: wall.position,
            width: dragItem.w,
            height: dragItem.doorHeight || 7
          }
          setWallOpenings([...wallOpenings, newOpening])
        }
        setDragItem(null)
        return
      }
      
      // Normal floor item
      const itemBox = { x: dragItem.x, y: dragItem.y, w: dragItem.w, h: dragItem.h }
      const isValid = isInsideWarehouse(itemBox) && !hasCollision(itemBox)
      
      if (isValid) {
        const newItems = [...items, { ...dragItem, rotation: dragItem.rotation || 0, instanceId: Date.now() }]
        setItems(newItems)
        saveToHistory(vertices, newItems)
      }
      setDragItem(null)
    }
    
    if (editingVertex !== null) {
      saveToHistory(vertices, items)
    }
    
    setEditingVertex(null)
  }, [dragItem, items, vertices, wallOpenings, editingVertex, isPanning, isInsideWarehouse, hasCollision, saveToHistory, findClosestWall, wallEditMode, isDraggingVertex, isRotating, isDraggingAreaVertex, isDraggingArea, isRotatingArea])
  
  // Double click to add vertex
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getGridPos(e)
    
    // Find which wall segment was clicked
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i]
      const v2 = vertices[(i + 1) % vertices.length]
      
      if (isPointOnLine(pos, v1, v2, 1.5)) {
        // Insert new vertex between v1 and v2
        const newVertices = [...vertices]
        newVertices.splice(i + 1, 0, { x: pos.x, y: pos.y })
        setVertices(newVertices)
        saveToHistory(newVertices, items)
        break
      }
    }
  }, [vertices, items, getGridPos, isPointOnLine, saveToHistory])
  
  // Mouse wheel zoom - handled via useEffect to use non-passive listener
  const handleWheelRef = useRef<((e: WheelEvent) => void) | null>(null)
  
  // Update the wheel handler ref when zoom changes
  useEffect(() => {
    handleWheelRef.current = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(z => Math.min(Math.max(z * delta, 0.05), 5))
    }
  }, [])
  
  // Attach non-passive wheel listener
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const wheelHandler = (e: WheelEvent) => {
      handleWheelRef.current?.(e)
    }
    
    canvas.addEventListener('wheel', wheelHandler, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', wheelHandler)
    }
  }, [])
  
  // Dynamic canvas sizing based on container
  useEffect(() => {
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const updateSize = () => {
      const rect = wrapper.getBoundingClientRect()
      // Leave some padding
      const newW = Math.max(800, Math.floor(rect.width - 16))
      const newH = Math.max(500, Math.floor(rect.height - 16))
      setCanvasSize({ w: newW, h: newH })
    }
    
    // Initial size
    updateSize()
    
    // Watch for resize
    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(wrapper)
    
    return () => resizeObserver.disconnect()
  }, [])
  
  const handleDragStart = useCallback((item: CatalogItem) => {
    setDragItem({ ...item, x: 0, y: 0, rotation: 0 })
  }, [])
  
  const handleCustomColumnDragStart = useCallback(() => {
    const width = parseFloat(customColumnWidth) || 12
    const depth = customColumnType === 'rectangular' ? (parseFloat(customColumnDepth) || 18) : width
    
    // Convert inches to feet
    const wFeet = width / 12
    const hFeet = depth / 12
    
    const customItem: CatalogItem = {
      id: `custom-col-${Date.now()}`,
      name: `Custom ${customColumnType.charAt(0).toUpperCase() + customColumnType.slice(1)} Column`,
      w: wFeet,
      h: customColumnType === 'rectangular' ? hFeet : wFeet,
      color: '#1f2937',
      pallets: 0,
      columnType: customColumnType,
      columnSize: width,
      columnDepth: customColumnType === 'rectangular' ? depth : undefined
    }
    
    setDragItem({ ...customItem, x: 0, y: 0, rotation: 0 })
  }, [customColumnType, customColumnWidth, customColumnDepth])
  
  const deleteSelected = useCallback(() => {
    if (selectedItem !== null) {
      const newItems = items.filter((_, i) => i !== selectedItem)
      setItems(newItems)
      setSelectedItem(null)
      saveToHistory(vertices, newItems)
    }
    if (selectedOpening !== null) {
      setWallOpenings(wallOpenings.filter((_, i) => i !== selectedOpening))
      setSelectedOpening(null)
    }
  }, [selectedItem, selectedOpening, items, wallOpenings, vertices, saveToHistory])
  
  const rotateSelected = useCallback(() => {
    if (selectedItem === null) return
    const newItems = [...items]
    const item = newItems[selectedItem]
    
    // Swap width and height, update rotation
    newItems[selectedItem] = {
      ...item,
      w: item.h,
      h: item.w,
      rotation: ((item.rotation || 0) + 90) % 360
    }
    setItems(newItems)
    saveToHistory(vertices, newItems)
  }, [selectedItem, items, vertices, saveToHistory])
  
  const duplicateSelected = useCallback(() => {
    if (selectedItem === null) return
    const item = items[selectedItem]
    const newItem: PlacedItem = {
      ...item,
      instanceId: Date.now(),
      x: item.x + 2,
      y: item.y + 2
    }
    const newItems = [...items, newItem]
    setItems(newItems)
    setSelectedItem(newItems.length - 1)
    saveToHistory(vertices, newItems)
  }, [selectedItem, items, vertices, saveToHistory])
  
  // Apply wall length
  const applyWallLength = useCallback(() => {
    if (editingWall === null) return
    
    const newLen = parseFloat(wallLength)
    if (isNaN(newLen) || newLen <= 0) return
    
    const v1 = vertices[editingWall]
    const v2 = vertices[(editingWall + 1) % vertices.length]
    
    const dx = v2.x - v1.x
    const dy = v2.y - v1.y
    const currentLen = Math.sqrt(dx * dx + dy * dy)
    if (currentLen === 0) return
    
    const scale = newLen / currentLen
    
    const newVertices = [...vertices]
    newVertices[(editingWall + 1) % vertices.length] = {
      x: Math.round(v1.x + dx * scale),
      y: Math.round(v1.y + dy * scale)
    }
    
    setVertices(newVertices)
    setEditingWall(null)
    saveToHistory(newVertices, items)
  }, [editingWall, wallLength, vertices, items, saveToHistory])
  
  // IKEA-style wall editing functions
  
  // Split wall at midpoint
  const splitWall = useCallback(() => {
    if (selectedWallIdx === null) return
    
    const v1 = vertices[selectedWallIdx]
    const v2 = vertices[(selectedWallIdx + 1) % vertices.length]
    
    const midpoint = {
      x: Math.round((v1.x + v2.x) / 2),
      y: Math.round((v1.y + v2.y) / 2)
    }
    
    const newVertices = [...vertices]
    newVertices.splice(selectedWallIdx + 1, 0, midpoint)
    
    setVertices(newVertices)
    setSelectedWallIdx(null)
    saveToHistory(newVertices, items)
  }, [selectedWallIdx, vertices, items, saveToHistory])
  
  // Delete selected vertex
  const deleteVertex = useCallback(() => {
    if (selectedVertexIdx === null || vertices.length <= 3) return
    
    const newVertices = vertices.filter((_, i) => i !== selectedVertexIdx)
    setVertices(newVertices)
    setSelectedVertexIdx(null)
    saveToHistory(newVertices, items)
  }, [selectedVertexIdx, vertices, items, saveToHistory])
  
  // Calculate wall normal (perpendicular direction)
  const getWallNormal = useCallback((wallIdx: number): { nx: number; ny: number } => {
    const v1 = vertices[wallIdx]
    const v2 = vertices[(wallIdx + 1) % vertices.length]
    
    const dx = v2.x - v1.x
    const dy = v2.y - v1.y
    const len = Math.sqrt(dx * dx + dy * dy)
    
    if (len === 0) return { nx: 0, ny: -1 }
    
    // Perpendicular normal (points "inward" for clockwise vertices)
    return { nx: -dy / len, ny: dx / len }
  }, [vertices])
  
  // Add indent (inward notch) to selected wall
  const addIndent = useCallback(() => {
    if (selectedWallIdx === null) return
    
    const v1 = vertices[selectedWallIdx]
    const v2 = vertices[(selectedWallIdx + 1) % vertices.length]
    
    const dx = v2.x - v1.x
    const dy = v2.y - v1.y
    const len = Math.sqrt(dx * dx + dy * dy)
    
    if (len < 8) {
      toast({ title: 'Wall too short for indent', variant: 'destructive' })
      return
    }
    
    const { nx, ny } = getWallNormal(selectedWallIdx)
    
    // Indent parameters
    const depth = 4 // 4 feet inward
    const halfWidth = Math.min(len / 4, 4) // Max 8ft wide, or 1/4 of wall
    
    // Direction along wall
    const ux = dx / len
    const uy = dy / len
    
    // Midpoint of wall
    const midX = (v1.x + v2.x) / 2
    const midY = (v1.y + v2.y) / 2
    
    // 4 new points for indent
    const p1 = { x: Math.round(midX - ux * halfWidth), y: Math.round(midY - uy * halfWidth) }
    const p2 = { x: Math.round(p1.x + nx * depth), y: Math.round(p1.y + ny * depth) }
    const p3 = { x: Math.round(midX + ux * halfWidth + nx * depth), y: Math.round(midY + uy * halfWidth + ny * depth) }
    const p4 = { x: Math.round(midX + ux * halfWidth), y: Math.round(midY + uy * halfWidth) }
    
    const newVertices = [...vertices]
    newVertices.splice(selectedWallIdx + 1, 0, p1, p2, p3, p4)
    
    setVertices(newVertices)
    setSelectedWallIdx(null)
    saveToHistory(newVertices, items)
  }, [selectedWallIdx, vertices, items, getWallNormal, saveToHistory, toast])
  
  // Add bump (outward protrusion) to selected wall
  const addBump = useCallback(() => {
    if (selectedWallIdx === null) return
    
    const v1 = vertices[selectedWallIdx]
    const v2 = vertices[(selectedWallIdx + 1) % vertices.length]
    
    const dx = v2.x - v1.x
    const dy = v2.y - v1.y
    const len = Math.sqrt(dx * dx + dy * dy)
    
    if (len < 8) {
      toast({ title: 'Wall too short for bump', variant: 'destructive' })
      return
    }
    
    const { nx, ny } = getWallNormal(selectedWallIdx)
    
    // Bump parameters (outward = negative normal direction)
    const depth = -4 // 4 feet outward
    const halfWidth = Math.min(len / 4, 4)
    
    // Direction along wall
    const ux = dx / len
    const uy = dy / len
    
    // Midpoint of wall
    const midX = (v1.x + v2.x) / 2
    const midY = (v1.y + v2.y) / 2
    
    // 4 new points for bump
    const p1 = { x: Math.round(midX - ux * halfWidth), y: Math.round(midY - uy * halfWidth) }
    const p2 = { x: Math.round(p1.x + nx * depth), y: Math.round(p1.y + ny * depth) }
    const p3 = { x: Math.round(midX + ux * halfWidth + nx * depth), y: Math.round(midY + uy * halfWidth + ny * depth) }
    const p4 = { x: Math.round(midX + ux * halfWidth), y: Math.round(midY + uy * halfWidth) }
    
    const newVertices = [...vertices]
    newVertices.splice(selectedWallIdx + 1, 0, p1, p2, p3, p4)
    
    setVertices(newVertices)
    setSelectedWallIdx(null)
    saveToHistory(newVertices, items)
  }, [selectedWallIdx, vertices, items, getWallNormal, saveToHistory, toast])
  
  const handleSave = useCallback(async () => {
    // Call parent onSave if provided
    if (onSave) {
      onSave({
        vertices,
        items,
        wallOpenings,
        totalArea,
        equipmentArea: equipArea,
        palletCapacity: totalPallets,
      })
    }
    
    // Save to database if warehouseId is provided
    if (warehouseId) {
      try {
        setIsSaving(true)
        
        // First, save current floor's state to cache
        saveCurrentFloorToCache()
        
        // Collect all floors to save (from cache + current)
        const floorsToSave: Array<{
          floorNumber: number
          data: {
            vertices: Vertex[]
            items: PlacedItem[]
            wallOpenings: WallOpening[]
            wallHeight: number
            floorName: string
            zoom: number
            panX: number
            panY: number
            areas: FloorArea[]
          }
        }> = []
        
        // Add current floor
        floorsToSave.push({
          floorNumber: currentFloor,
          data: {
            vertices,
            items,
            wallOpenings,
            wallHeight,
            floorName,
            zoom,
            panX: pan.x,
            panY: pan.y,
            areas
          }
        })
        
        // Add other floors from cache
        floorDataCache.current.forEach((cachedData, floorNum) => {
          if (floorNum !== currentFloor) {
            floorsToSave.push({
              floorNumber: floorNum,
              data: {
                vertices: cachedData.vertices,
                items: cachedData.items,
                wallOpenings: cachedData.wallOpenings,
                wallHeight: cachedData.wallHeight,
                floorName: cachedData.floorName,
                zoom: cachedData.zoom || 1,
                panX: cachedData.panX || 0,
                panY: cachedData.panY || 0,
                areas: cachedData.areas || []
              }
            })
          }
        })
        
        // Save all floors
        let savedCount = 0
        let failedCount = 0
        
        for (const floor of floorsToSave) {
          // Calculate area for this floor
          let floorArea = 0
          for (let i = 0; i < floor.data.vertices.length; i++) {
            const j = (i + 1) % floor.data.vertices.length
            floorArea += floor.data.vertices[i].x * floor.data.vertices[j].y - floor.data.vertices[j].x * floor.data.vertices[i].y
          }
          floorArea = Math.abs(floorArea / 2)
          
          const floorEquipArea = floor.data.items.reduce((sum, item) => sum + (item.w * item.h), 0)
          const floorPallets = floor.data.items.reduce((sum, item) => sum + (item.pallets || 0), 0)
          
          const result = await saveFloorPlan(warehouseId, {
            vertices: floor.data.vertices,
            items: floor.data.items,
            wallOpenings: floor.data.wallOpenings,
            wallHeight: floor.data.wallHeight,
            totalArea: floorArea,
            equipmentArea: floorEquipArea,
            palletCapacity: floorPallets,
            name: floor.data.floorName,
            zoom: floor.data.zoom || zoom,
            panX: floor.data.panX || pan.x,
            panY: floor.data.panY || pan.y,
            areas: floor.data.areas || [],
          }, floor.floorNumber)
          
          if (result.success) {
            savedCount++
            // Update cache to mark as saved
            floorDataCache.current.set(floor.floorNumber, {
              ...floor.data,
              hasUnsavedChanges: false
            })
          } else {
            failedCount++
            console.error(`Failed to save floor ${floor.floorNumber}:`, result.error)
          }
        }
        
        if (failedCount === 0) {
          setLastSaved(new Date())
          setHasUnsavedChanges(false)
          
          // Update floors list
          const floorsResult = await loadAllFloors(warehouseId)
          if (floorsResult.success && floorsResult.floors) {
            setFloors(floorsResult.floors)
          }
          
          if (floorsToSave.length > 1) {
            toast({ title: `All ${savedCount} floors saved!`, variant: 'success' })
          } else {
            toast({ title: `Floor ${currentFloor} saved!`, variant: 'success' })
          }
        } else {
          toast({ 
            title: `Saved ${savedCount} floors, ${failedCount} failed`, 
            variant: failedCount > 0 ? 'destructive' : 'success' 
          })
        }
      } catch (error) {
        console.error('Failed to save floor plan:', error)
        toast({ title: 'Failed to save floor plan', variant: 'destructive' })
      } finally {
        setIsSaving(false)
      }
    }
  }, [onSave, warehouseId, vertices, items, wallOpenings, wallHeight, totalArea, equipArea, totalPallets, toast, currentFloor, floorName, saveCurrentFloorToCache, zoom, pan])
  
  // 3D Component callbacks - memoized to prevent unnecessary re-renders
  const handle3DItemSelect = useCallback((instanceId: number | null) => {
    if (instanceId === null) {
      setSelectedItem(null)
    } else {
      const idx = items.findIndex(i => i.instanceId === instanceId)
      setSelectedItem(idx >= 0 ? idx : null)
    }
  }, [items])
  
  const handle3DItemMove = useCallback((instanceId: number, newX: number, newY: number) => {
    const idx = items.findIndex(i => i.instanceId === instanceId)
    if (idx >= 0) {
      const newItems = [...items]
      newItems[idx] = { ...newItems[idx], x: newX, y: newY }
      setItems(newItems)
    }
  }, [items])
  
  const handle3DDropItem = useCallback((x: number, y: number) => {
    if (dragItem && !dragItem.wallItem) {
      const itemBox = { x, y, w: dragItem.w, h: dragItem.h }
      if (isInsideWarehouse(itemBox) && !hasCollision(itemBox)) {
        const newItem: PlacedItem = { 
          ...dragItem, 
          x, 
          y, 
          rotation: 0, 
          instanceId: Date.now() 
        }
        const newItems = [...items, newItem]
        setItems(newItems)
        saveToHistory(vertices, newItems)
      }
      setDragItem(null)
    }
  }, [dragItem, isInsideWarehouse, hasCollision, items, vertices, saveToHistory])
  
  // Export functions
  const handleExportPNG = useCallback(() => {
    if (viewMode === '2D' && canvasRef.current) {
      exportToPNG(canvasRef.current, `floor-plan-${warehouseName.replace(/\s+/g, '-').toLowerCase()}.png`)
    } else if (canvasContainerRef.current) {
      export3DScreenshot(canvasContainerRef.current, `floor-plan-3d-${warehouseName.replace(/\s+/g, '-').toLowerCase()}.png`)
    }
    setShowExportMenu(false)
    toast({ title: 'PNG exported!', variant: 'success' })
  }, [viewMode, warehouseName])
  
  const handleExportPDF = useCallback(() => {
    if (canvasRef.current) {
      exportToPDF(canvasRef.current, warehouseName, {
        totalArea: Math.round(totalArea),
        utilization: parseFloat(utilization),
        palletCapacity: totalPallets,
        itemCount: items.length,
        doorCount: wallOpenings.length
      })
      toast({ title: 'PDF exported!', variant: 'success' })
    }
    setShowExportMenu(false)
  }, [warehouseName, totalArea, utilization, totalPallets, items.length, wallOpenings.length])
  
  // Apply shape template
  const applyTemplate = useCallback((template: Vertex[]) => {
    setVertices(template)
    saveToHistory(template, items)
  }, [items, saveToHistory])

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement) return
      
      // Escape key - close modal or exit wall edit mode
      if (e.key === 'Escape') {
        if (editModalOpen) {
          setEditModalOpen(false)
          setEditingItem(null)
          setEditingItemIndex(null)
          return
        }
        if (contextMenu.visible) {
          setContextMenu({ visible: false, x: 0, y: 0, itemIndex: null })
          return
        }
        if (wallEditMode) {
          exitWallEditMode()
        }
        return
      }
      
      // Delete/Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // In wall edit mode, delete selected vertex
        if (wallEditMode && selectedVertexIdx !== null) {
          deleteVertex()
          return
        }
        // Normal mode, delete selected item/opening
        if (selectedItem !== null || selectedOpening !== null) {
          deleteSelected()
        }
      }
      
      // These shortcuts are disabled in wall edit mode
      if (!wallEditMode) {
        if (e.key === 'r' || e.key === 'R') {
          rotateSelected()
        }
        if (e.key === 'd' && e.ctrlKey) {
          e.preventDefault()
          duplicateSelected()
        }
      }
      
      // Undo/Redo work in any mode
      if (e.key === 'z' && e.ctrlKey) {
        e.preventDefault()
        undo()
      }
      if (e.key === 'y' && e.ctrlKey) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem, selectedOpening, deleteSelected, rotateSelected, duplicateSelected, undo, redo, wallEditMode, selectedVertexIdx, deleteVertex, exitWallEditMode, editModalOpen, contextMenu.visible])

  // Loading state
  return (
    <div className="flex h-[calc(100vh-64px)] min-h-[600px] bg-slate-900 text-white overflow-hidden">
      {/* Main Canvas Area */}
      <div className="flex-1 p-3 flex flex-col">
        {/* Floor Tabs */}
        <div className="flex items-center gap-2 mb-1 bg-slate-800 p-2 rounded-lg">
          <span className="text-sm text-slate-400 mr-2">🏢 Floors:</span>
          
          {/* Floor tabs */}
          <div className="flex gap-1">
            {floors.length > 0 ? (
              floors.map((floor) => {
                // Check if this floor has unsaved changes in cache
                const cachedFloor = floorDataCache.current.get(floor.floorNumber)
                const floorHasUnsaved = floor.floorNumber === currentFloor 
                  ? hasUnsavedChanges 
                  : cachedFloor?.hasUnsavedChanges || false
                
                return (
                  <button
                    key={floor.floorNumber}
                    onClick={() => switchFloor(floor.floorNumber)}
                    disabled={isLoadingFloor}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors relative ${
                      floor.floorNumber === currentFloor
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    } ${isLoadingFloor ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {floor.name || `Floor ${floor.floorNumber}`}
                    {floorHasUnsaved && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />
                    )}
                  </button>
                )
              })
            ) : (
              <button
                className={`px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white relative`}
              >
                Floor 1
                {hasUnsavedChanges && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />
                )}
              </button>
            )}
          </div>
          
          {/* Add Floor button */}
          <button
            onClick={addNewFloor}
            disabled={isLoadingFloor}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium flex items-center gap-1 disabled:opacity-50"
            title="Add New Floor"
          >
            ➕ Add Floor
          </button>
          
          {/* Delete Floor button (only show if more than 1 floor) */}
          {floors.length > 1 && (
            <button
              onClick={deleteCurrentFloor}
              disabled={isLoadingFloor}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium flex items-center gap-1 disabled:opacity-50"
              title="Delete Current Floor"
            >
              🗑️
            </button>
          )}
          
          {/* Floor name editor */}
          <div className="ml-auto flex items-center gap-2">
            <input
              type="text"
              value={floorName}
              onChange={(e) => setFloorName(e.target.value)}
              className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm w-32"
              placeholder="Floor name"
            />
            {hasUnsavedChanges && (
              <span className="text-orange-400 text-xs">● Unsaved</span>
            )}
          </div>
          
          {isLoadingFloor && (
            <span className="text-sm text-slate-400 animate-pulse">Loading...</span>
          )}
        </div>
        
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-2 bg-slate-800 p-2 rounded-lg flex-wrap">
          {/* Save */}
          <button 
            onClick={handleSave}
            disabled={isSaving || isLoadingFloor}
            className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 flex items-center gap-2 font-medium disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⏳</span> Saving...
              </>
            ) : (
              <>💾 {floors.length > 1 || floorDataCache.current.size > 1 ? 'Save All' : 'Save'}</>
            )}
          </button>
          
          {/* Export Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600 flex items-center gap-1"
            >
              📥 Export <span className="text-xs">▼</span>
            </button>
            
            {showExportMenu && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 rounded-lg shadow-xl z-50 min-w-[140px] border border-slate-600">
                <button 
                  onClick={handleExportPNG}
                  className="w-full px-4 py-2 text-left hover:bg-slate-700 rounded-t-lg flex items-center gap-2 text-sm"
                >
                  🖼️ Export PNG
                </button>
                <button 
                  onClick={handleExportPDF}
                  className="w-full px-4 py-2 text-left hover:bg-slate-700 rounded-b-lg flex items-center gap-2 text-sm"
                >
                  📄 Export PDF
                </button>
              </div>
            )}
          </div>
          
          {/* Undo/Redo */}
          <div className="flex gap-1 border-l border-slate-600 pl-4">
            <button 
              onClick={undo}
              disabled={historyIndex <= 0}
              className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
            >↩️</button>
            <button 
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Y)"
            >↪️</button>
          </div>
          
          {/* Wall Edit Mode Toggle */}
          <button 
            onClick={() => {
              if (wallEditMode) {
                exitWallEditMode()
              } else {
                setWallEditMode(true)
                setSelectedItem(null)
                setSelectedOpening(null)
              }
            }}
            className={`px-4 py-2 rounded font-medium flex items-center gap-2 transition-colors ${
              wallEditMode 
                ? 'bg-purple-600 hover:bg-purple-700 ring-2 ring-purple-400' 
                : 'bg-slate-700 hover:bg-slate-600'
            }`}
            title="Toggle Wall Edit Mode"
          >
            🏗️ {wallEditMode ? 'Exit Edit' : 'Edit Walls'}
          </button>
          
          {/* Shape Templates */}
          <div className="flex gap-1 border-l border-slate-600 pl-4">
            <button 
              onClick={() => applyTemplate(SHAPE_TEMPLATES.rectangle)}
              className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600 text-lg" 
              title="Rectangle"
            >▭</button>
            <button 
              onClick={() => applyTemplate(SHAPE_TEMPLATES.lShape)}
              className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600 text-lg" 
              title="L-Shape"
            >⌐</button>
            <button 
              onClick={() => applyTemplate(SHAPE_TEMPLATES.uShape)}
              className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600 text-lg" 
              title="U-Shape"
            >∪</button>
            <button 
              onClick={() => applyTemplate(SHAPE_TEMPLATES.tShape)}
              className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600 text-lg" 
              title="T-Shape"
            >⊥</button>
          </div>
          
          {/* Zoom */}
          <div className="flex items-center gap-1 border-l border-slate-600 pl-4">
            <button 
              onClick={() => setZoom(z => Math.max(z * 0.8, 0.05))}
              className="px-2 py-2 bg-slate-700 rounded hover:bg-slate-600"
              title="Zoom Out"
            >➖</button>
            <span className="w-14 text-center text-sm">{(zoom * 100).toFixed(0)}%</span>
            <button 
              onClick={() => setZoom(z => Math.min(z * 1.2, 5))}
              className="px-2 py-2 bg-slate-700 rounded hover:bg-slate-600"
              title="Zoom In"
            >➕</button>
            <button 
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
              className="px-2 py-2 bg-slate-700 rounded hover:bg-slate-600"
              title="Reset View"
            >⟲</button>
            <button 
              onClick={() => fitToScreen(vertices, canvasSize)}
              className="px-2 py-2 bg-blue-600 rounded hover:bg-blue-500 text-xs font-medium"
              title="Fit to Screen"
            >Fit</button>
          </div>
          
          {/* Areas Button */}
          <div className="border-l border-slate-600 pl-4">
            <button 
              onClick={() => setShowAreaPanel(!showAreaPanel)}
              className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                showAreaPanel ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
              }`}
              title="Manage Areas"
            >
              📍 Areas {areas.length > 0 && <span className="ml-1 bg-purple-500 px-1.5 rounded-full">{areas.length}</span>}
            </button>
          </div>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="text-slate-400">📐</span>
              <span className="font-medium">{totalArea.toLocaleString()} sq ft</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-slate-400">📊</span>
              <span className="font-medium">{utilization}%</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-slate-400">📦</span>
              <span className="font-medium text-green-400">{totalPallets} pallets</span>
            </span>
            {lastSaved && (
              <span className="text-xs text-slate-500 border-l border-slate-600 pl-3">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          
          {/* Wall Height (3D only) */}
          {viewMode === '3D' && (
            <div className="flex items-center gap-2 border-l border-slate-600 pl-4">
              <span className="text-xs text-slate-400">Wall:</span>
              <input
                type="range"
                min="10"
                max="40"
                value={wallHeight}
                onChange={(e) => setWallHeight(Number(e.target.value))}
                className="w-16 h-1 bg-slate-600 rounded appearance-none cursor-pointer"
              />
              <span className="text-xs font-medium w-10">{wallHeight} ft</span>
            </div>
          )}
          
          {/* 2D/3D Toggle */}
          <div className="flex gap-1 bg-slate-700 rounded p-1">
            <button 
              className={`px-4 py-1 rounded text-sm font-medium transition-colors ${viewMode === '2D' ? 'bg-blue-600' : 'hover:bg-slate-600'}`}
              onClick={() => setViewMode('2D')}
            >2D</button>
            <button 
              className={`px-4 py-1 rounded text-sm font-medium transition-colors ${viewMode === '3D' ? 'bg-blue-600' : 'hover:bg-slate-600'}`}
              onClick={() => setViewMode('3D')}
            >3D</button>
          </div>
        </div>
        
        {/* Canvas */}
        <div ref={canvasWrapperRef} className="flex-1 flex items-center justify-center relative overflow-hidden">
          {viewMode === '2D' ? (
            <>
              <canvas
                ref={canvasRef}
                width={canvasSize.w}
                height={canvasSize.h}
                className="cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleCanvasContextMenu}
              />
              
              {/* Wall Edit Popup */}
              {editingWall !== null && (
                <div 
                  className="absolute bg-slate-800 p-4 rounded-lg shadow-xl border border-slate-600 z-10"
                  style={{ left: wallEditPos.x, top: wallEditPos.y }}
                >
                  <div className="text-sm text-slate-400 mb-2">Wall Length</div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={wallLength}
                      onChange={(e) => setWallLength(e.target.value)}
                      className="w-20 px-2 py-1 bg-slate-700 rounded text-white border border-slate-600 focus:border-blue-500 focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyWallLength()
                        if (e.key === 'Escape') setEditingWall(null)
                      }}
                    />
                    <span className="text-slate-400">ft</span>
                    <button 
                      onClick={applyWallLength}
                      className="px-3 py-1 bg-green-600 rounded hover:bg-green-700"
                    >
                      ✓
                    </button>
                    <button 
                      onClick={() => setEditingWall(null)}
                      className="px-3 py-1 bg-slate-600 rounded hover:bg-slate-500"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
              
              {/* Wall Edit Mode - Floating Toolbar for Wall Selection */}
              {wallEditMode && selectedWallIdx !== null && (
                <div 
                  className="absolute bg-slate-800 p-3 rounded-lg shadow-xl border border-purple-500 z-20"
                  style={{ left: wallToolbarPos.x, top: wallToolbarPos.y }}
                >
                  <div className="text-xs text-purple-400 mb-2 font-medium">Wall {selectedWallIdx + 1} Selected</div>
                  <div className="flex gap-2">
                    <button 
                      onClick={splitWall}
                      className="px-3 py-2 bg-blue-600 rounded hover:bg-blue-700 text-sm font-medium flex items-center gap-1"
                      title="Add vertex at wall midpoint"
                    >
                      ✂️ Split
                    </button>
                    <button 
                      onClick={addIndent}
                      className="px-3 py-2 bg-orange-600 rounded hover:bg-orange-700 text-sm font-medium flex items-center gap-1"
                      title="Add inward indent"
                    >
                      ⬇️ Indent
                    </button>
                    <button 
                      onClick={addBump}
                      className="px-3 py-2 bg-cyan-600 rounded hover:bg-cyan-700 text-sm font-medium flex items-center gap-1"
                      title="Add outward bump"
                    >
                      ⬆️ Bump
                    </button>
                    <button 
                      onClick={() => setSelectedWallIdx(null)}
                      className="px-2 py-2 bg-slate-600 rounded hover:bg-slate-500 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
              
              {/* Wall Edit Mode - Floating Toolbar for Vertex Selection */}
              {wallEditMode && selectedVertexIdx !== null && !isDraggingVertex && (
                <div 
                  className="absolute bg-slate-800 p-3 rounded-lg shadow-xl border border-green-500 z-20"
                  style={{ left: wallToolbarPos.x, top: wallToolbarPos.y }}
                >
                  <div className="text-xs text-green-400 mb-2 font-medium">Vertex {selectedVertexIdx + 1} Selected</div>
                  <div className="flex gap-2">
                    <button 
                      onClick={deleteVertex}
                      disabled={vertices.length <= 3}
                      className={`px-3 py-2 rounded text-sm font-medium flex items-center gap-1 ${
                        vertices.length <= 3 
                          ? 'bg-slate-600 opacity-50 cursor-not-allowed' 
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                      title={vertices.length <= 3 ? 'Minimum 3 vertices required' : 'Delete this vertex'}
                    >
                      🗑️ Delete Point
                    </button>
                    <button 
                      onClick={() => setSelectedVertexIdx(null)}
                      className="px-2 py-2 bg-slate-600 rounded hover:bg-slate-500 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  {vertices.length <= 3 && (
                    <div className="text-xs text-slate-500 mt-2">Min 3 vertices needed</div>
                  )}
                </div>
              )}
              
              {/* Wall Edit Mode Indicator */}
              {wallEditMode && (
                <div className="absolute top-4 left-4 bg-purple-600/90 text-white px-4 py-2 rounded-lg shadow-lg z-10 flex items-center gap-2">
                  <span className="animate-pulse">🏗️</span>
                  <span className="font-medium">Wall Edit Mode</span>
                  <span className="text-purple-200 text-sm">• Click vertices or walls to select</span>
                </div>
              )}
              
              {/* Area Draw Mode Indicator */}
              {areaDrawMode && (
                <div className="absolute top-4 left-4 bg-orange-600/90 text-white px-4 py-2 rounded-lg shadow-lg z-10 flex items-center gap-2">
                  <span className="animate-pulse">✏️</span>
                  <span className="font-medium">Area Draw Mode</span>
                  <span className="text-orange-200 text-sm">
                    {drawingAreaVertices.length < 3 
                      ? `• Click to add points (${drawingAreaVertices.length}/3 min)`
                      : '• Click first vertex (green) to close'
                    }
                  </span>
                  <button
                    onClick={() => {
                      setAreaDrawMode(false)
                      setDrawingAreaVertices([])
                    }}
                    className="ml-2 px-2 py-1 bg-orange-700 hover:bg-orange-800 rounded text-xs"
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              {/* Right-Click Context Menu */}
              {contextMenu.visible && contextMenu.itemIndex !== null && (
                <div 
                  className="fixed bg-slate-800 rounded-lg shadow-2xl border border-slate-600 py-1 z-50 min-w-[180px]"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => openEditModal(contextMenu.itemIndex!)}
                    className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-3 text-sm"
                  >
                    <span>📐</span> Edit Dimensions
                  </button>
                  <button
                    onClick={contextMenuDuplicate}
                    className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-3 text-sm"
                  >
                    <span>📋</span> Duplicate
                  </button>
                  <button
                    onClick={contextMenuRotate}
                    className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-3 text-sm"
                  >
                    <span>🔄</span> Rotate 90°
                  </button>
                  <div className="border-t border-slate-600 my-1" />
                  <button
                    onClick={contextMenuDelete}
                    className="w-full px-4 py-2 text-left hover:bg-red-600 text-red-400 hover:text-white flex items-center gap-3 text-sm"
                  >
                    <span>🗑️</span> Delete
                  </button>
                </div>
              )}
              
              {/* Area Right-Click Context Menu */}
              {areaContextMenu.visible && areaContextMenu.areaId && (
                <div 
                  className="fixed bg-slate-800 rounded-lg shadow-2xl border border-slate-600 py-1 z-50 min-w-[180px]"
                  style={{ left: areaContextMenu.x, top: areaContextMenu.y }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      const area = areas.find(a => a.id === areaContextMenu.areaId)
                      if (area) {
                        setEditingArea(area)
                      }
                      setAreaContextMenu({ visible: false, x: 0, y: 0, areaId: null })
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-3 text-sm"
                  >
                    <span>📝</span> Edit Area
                  </button>
                  <button
                    onClick={() => {
                      const area = areas.find(a => a.id === areaContextMenu.areaId)
                      if (area) {
                        // Duplicate area with offset
                        const areaColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
                        const newArea: FloorArea = {
                          id: `area-${Date.now()}`,
                          name: `${area.name} (copy)`,
                          type: area.type,
                          vertices: area.vertices.map(v => ({ x: v.x + 5, y: v.y + 5 })),
                          color: areaColors[areas.length % areaColors.length],
                          rotation: area.rotation
                        }
                        setAreas([...areas, newArea])
                        setSelectedAreaId(newArea.id)
                        setHasUnsavedChanges(true)
                        toast({ title: 'Area duplicated!', variant: 'success' })
                      }
                      setAreaContextMenu({ visible: false, x: 0, y: 0, areaId: null })
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-3 text-sm"
                  >
                    <span>📋</span> Duplicate
                  </button>
                  <button
                    onClick={() => {
                      const areaIdx = areas.findIndex(a => a.id === areaContextMenu.areaId)
                      if (areaIdx >= 0) {
                        const area = areas[areaIdx]
                        const center = getAreaCenter(area.vertices)
                        const rotatedVertices = rotateVertices(area.vertices, center, 90)
                        const newAreas = [...areas]
                        newAreas[areaIdx] = { ...newAreas[areaIdx], vertices: rotatedVertices, rotation: ((area.rotation || 0) + 90) % 360 }
                        setAreas(newAreas)
                        setHasUnsavedChanges(true)
                        toast({ title: 'Area rotated 90°', variant: 'success' })
                      }
                      setAreaContextMenu({ visible: false, x: 0, y: 0, areaId: null })
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-3 text-sm"
                  >
                    <span>🔄</span> Rotate 90°
                  </button>
                  <div className="border-t border-slate-600 my-1" />
                  <button
                    onClick={() => {
                      const newAreas = areas.filter(a => a.id !== areaContextMenu.areaId)
                      setAreas(newAreas)
                      setSelectedAreaId(null)
                      setHasUnsavedChanges(true)
                      toast({ title: 'Area deleted', variant: 'success' })
                      setAreaContextMenu({ visible: false, x: 0, y: 0, areaId: null })
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-red-600 text-red-400 hover:text-white flex items-center gap-3 text-sm"
                  >
                    <span>🗑️</span> Delete
                  </button>
                </div>
              )}
              
              {/* Edit Dimensions Modal */}
              {editModalOpen && editingItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditModalOpen(false)}>
                  <div 
                    className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-600">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        <span>📐</span>
                        Edit: {editingItem.customLabel || editingItem.name}
                      </h2>
                      <button 
                        onClick={() => setEditModalOpen(false)}
                        className="text-slate-400 hover:text-white p-1"
                      >
                        ✕
                      </button>
                    </div>
                    
                    {/* Modal Body */}
                    <div className="p-4 space-y-6">
                      {/* Dimensions */}
                      <div>
                        <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                          <span>📏</span> Dimensions
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Width (ft)</label>
                            <input
                              type="number"
                              value={editingItem.w}
                              onChange={(e) => setEditingItem(prev => prev ? { ...prev, w: Number(e.target.value) || 1 } : null)}
                              min="1"
                              max="100"
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Depth (ft)</label>
                            <input
                              type="number"
                              value={editingItem.h}
                              onChange={(e) => setEditingItem(prev => prev ? { ...prev, h: Number(e.target.value) || 1 } : null)}
                              min="1"
                              max="100"
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Height (ft)</label>
                            <input
                              type="number"
                              value={editingItem.height || (getItemType(editingItem) === 'rack' ? 16 : 4)}
                              onChange={(e) => setEditingItem(prev => prev ? { ...prev, height: Number(e.target.value) || 4 } : null)}
                              min="1"
                              max="40"
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Rack Configuration (only for racks) */}
                      {getItemType(editingItem) === 'rack' && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                            <span>🏗️</span> Rack Configuration
                          </h3>
                          
                          {/* Rack Dimensions */}
                          <div className="mb-4">
                            <label className="text-xs text-slate-500 block mb-2 font-medium">📏 Rack Dimensions</label>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Width (ft)</label>
                                <input
                                  type="number"
                                  value={editingItem.w}
                                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, w: Number(e.target.value) || 1 } : null)}
                                  min="2"
                                  max="100"
                                  step="0.5"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Depth (ft)</label>
                                <input
                                  type="number"
                                  value={editingItem.h}
                                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, h: Number(e.target.value) || 1 } : null)}
                                  min="2"
                                  max="20"
                                  step="0.5"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Height (ft)</label>
                                <input
                                  type="number"
                                  value={editingItem.height || 16}
                                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, height: Number(e.target.value) || 8 } : null)}
                                  min="4"
                                  max="40"
                                  step="1"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* Beam & Level Configuration */}
                          <div className="mb-4">
                            <label className="text-xs text-slate-500 block mb-2 font-medium">🔩 Beam & Level Settings</label>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Beam Levels</label>
                                <input
                                  type="number"
                                  value={editingItem.beamLevels || 4}
                                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, beamLevels: Number(e.target.value) || 1 } : null)}
                                  min="1"
                                  max="10"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">Number of storage levels</p>
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Level Height (ft)</label>
                                <input
                                  type="number"
                                  value={((editingItem.height || 16) / (editingItem.beamLevels || 4)).toFixed(1)}
                                  onChange={(e) => {
                                    const levelHeight = Number(e.target.value) || 4
                                    const levels = editingItem.beamLevels || 4
                                    setEditingItem(prev => prev ? { ...prev, height: levelHeight * levels } : null)
                                  }}
                                  min="3"
                                  max="8"
                                  step="0.5"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">Height per level</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Bay Configuration */}
                          <div className="mb-4">
                            <label className="text-xs text-slate-500 block mb-2 font-medium">📦 Bay & Pallet Settings</label>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Bay Width (ft)</label>
                                <input
                                  type="number"
                                  value={editingItem.bayWidth || 8}
                                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, bayWidth: Number(e.target.value) || 4 } : null)}
                                  min="4"
                                  max="16"
                                  step="0.5"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">Width of each bay section</p>
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Pallets per Bay</label>
                                <input
                                  type="number"
                                  value={editingItem.palletPositions || 3}
                                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, palletPositions: Number(e.target.value) || 1 } : null)}
                                  min="1"
                                  max="6"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">Pallets per bay per level</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Clearance & Spacing */}
                          <div className="mb-4">
                            <label className="text-xs text-slate-500 block mb-2 font-medium">↔️ Clearance & Spacing</label>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Aisle Width (ft)</label>
                                <input
                                  type="number"
                                  value={editingItem.aisleWidth || 12}
                                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, aisleWidth: Number(e.target.value) || 8 } : null)}
                                  min="8"
                                  max="20"
                                  step="0.5"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">Space between racks</p>
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Upright Depth (in)</label>
                                <input
                                  type="number"
                                  value={editingItem.uprightDepth || 3}
                                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, uprightDepth: Number(e.target.value) || 3 } : null)}
                                  min="2"
                                  max="6"
                                  step="0.5"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">Upright frame depth</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Quick Presets */}
                          <div className="mb-4">
                            <label className="text-xs text-slate-500 block mb-2 font-medium">⚡ Quick Presets</label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setEditingItem(prev => prev ? { 
                                  ...prev, 
                                  w: 8, h: 4, height: 16, beamLevels: 4, bayWidth: 8, palletPositions: 3, aisleWidth: 12 
                                } : null)}
                                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                              >
                                Standard (8x4x16)
                              </button>
                              <button
                                onClick={() => setEditingItem(prev => prev ? { 
                                  ...prev, 
                                  w: 12, h: 4, height: 20, beamLevels: 5, bayWidth: 12, palletPositions: 4, aisleWidth: 12 
                                } : null)}
                                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                              >
                                Large (12x4x20)
                              </button>
                              <button
                                onClick={() => setEditingItem(prev => prev ? { 
                                  ...prev, 
                                  w: 24, h: 4, height: 24, beamLevels: 6, bayWidth: 8, palletPositions: 3, aisleWidth: 10 
                                } : null)}
                                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                              >
                                High Density (24x4x24)
                              </button>
                              <button
                                onClick={() => setEditingItem(prev => prev ? { 
                                  ...prev, 
                                  w: 40, h: 8, height: 28, beamLevels: 7, bayWidth: 10, palletPositions: 4, aisleWidth: 14 
                                } : null)}
                                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                              >
                                Warehouse Scale (40x8x28)
                              </button>
                            </div>
                          </div>
                          
                          {/* Calculated Values */}
                          <div className="p-3 bg-slate-900 rounded-lg space-y-2 text-sm">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">📊 Calculated Values</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex justify-between">
                                <span className="text-slate-400">📦 Pallet Capacity:</span>
                                <span className="font-bold text-green-400">{calculatePallets(editingItem)} pallets</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">📐 Footprint:</span>
                                <span className="font-bold">{(editingItem.w * editingItem.h).toLocaleString()} sq ft</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">🏗️ Bay Count:</span>
                                <span className="font-bold">{Math.floor(editingItem.w / (editingItem.bayWidth || 8))} bays</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">📊 Total Levels:</span>
                                <span className="font-bold">{editingItem.beamLevels || 4} levels</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">↔️ Aisle Space:</span>
                                <span className="font-bold">{editingItem.aisleWidth || 12} ft</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">📏 Level Height:</span>
                                <span className="font-bold">{((editingItem.height || 16) / (editingItem.beamLevels || 4)).toFixed(1)} ft</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Barrier Configuration */}
                      {editingItem.barrierType && !editingItem.isRentedMarker && editingItem.barrierType !== 'cage' && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                            <span>🚧</span> Barrier Configuration
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            {(editingItem.barrierType === 'fence' || editingItem.barrierType === 'tape') && (
                              <div className="col-span-2">
                                <label className="text-xs text-slate-500 block mb-1">Length (ft)</label>
                                <input
                                  type="number"
                                  value={editingItem.w}
                                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, w: Number(e.target.value) || 1 } : null)}
                                  min="1"
                                  max="200"
                                  step="1"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">Drag or enter exact length</p>
                              </div>
                            )}
                            {editingItem.barrierType === 'barrier' && (
                              <>
                                <div>
                                  <label className="text-xs text-slate-500 block mb-1">Length (ft)</label>
                                  <input
                                    type="number"
                                    value={editingItem.w}
                                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, w: Number(e.target.value) || 1 } : null)}
                                    min="1"
                                    max="50"
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-slate-500 block mb-1">Width (ft)</label>
                                  <input
                                    type="number"
                                    value={editingItem.h}
                                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, h: Number(e.target.value) || 1 } : null)}
                                    min="1"
                                    max="10"
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                  />
                                </div>
                              </>
                            )}
                            {editingItem.barrierType === 'bollard' && (
                              <div className="col-span-2">
                                <label className="text-xs text-slate-500 block mb-1">Diameter (ft)</label>
                                <input
                                  type="number"
                                  value={editingItem.w}
                                  onChange={(e) => {
                                    const size = Number(e.target.value) || 1
                                    setEditingItem(prev => prev ? { ...prev, w: size, h: size } : null)
                                  }}
                                  min="0.5"
                                  max="3"
                                  step="0.5"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                              </div>
                            )}
                          </div>
                          
                          {/* Barrier Info */}
                          <div className="mt-4 p-3 bg-slate-900 rounded-lg text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">🏷️ Type:</span>
                              <span className="font-bold capitalize">
                                {editingItem.barrierType === 'fence' ? '🚧 Wire Fence' : 
                                 editingItem.barrierType === 'tape' ? '📏 Floor Tape' :
                                 editingItem.barrierType === 'barrier' ? '🧱 Concrete Barrier' :
                                 editingItem.barrierType === 'bollard' ? '🔶 Safety Bollard' :
                                 editingItem.barrierType}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Cage Configuration */}
                      {editingItem.barrierType === 'cage' && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                            <span>🔲</span> Cage Dimensions
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-500 block mb-1">Width (ft)</label>
                              <input
                                type="number"
                                value={editingItem.w}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, w: Number(e.target.value) || 1 } : null)}
                                min="4"
                                max="50"
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 block mb-1">Depth (ft)</label>
                              <input
                                type="number"
                                value={editingItem.h}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, h: Number(e.target.value) || 1 } : null)}
                                min="4"
                                max="50"
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>
                          
                          {/* Cage Area */}
                          <div className="mt-4 p-3 bg-slate-900 rounded-lg text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">📐 Cage Area:</span>
                              <span className="font-bold">{(editingItem.w * editingItem.h).toLocaleString()} sq ft</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Zone Configuration (for rental zones and rented markers) */}
                      {(editingItem.isRentalZone || editingItem.isRentedMarker || editingItem.barrierType === 'cage') && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                            <span>{editingItem.isRentalZone ? '🏢' : '🔒'}</span> 
                            {editingItem.isRentalZone ? 'Zone Configuration' : 'Rental Info'}
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-500 block mb-1">
                                {editingItem.isRentalZone ? 'Zone Name' : 'Space Name'}
                              </label>
                              <input
                                type="text"
                                value={editingItem.zoneName || ''}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, zoneName: e.target.value || undefined } : null)}
                                placeholder={editingItem.isRentalZone ? 'e.g., Zone A, Area 1' : 'e.g., Unit 101'}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 block mb-1">Tenant Name</label>
                              <input
                                type="text"
                                value={editingItem.tenantName || ''}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, tenantName: e.target.value || undefined } : null)}
                                placeholder="e.g., Acme Corp"
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>
                          
                          {/* Zone Area Info */}
                          <div className="mt-4 p-3 bg-slate-900 rounded-lg grid grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">📐 Area:</span>
                              <span className="font-bold">{(editingItem.w * editingItem.h).toLocaleString()} sq ft</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">🏷️ Type:</span>
                              <span className="font-bold capitalize">
                                {editingItem.zoneType === 'pallet-storage' ? '📦 Pallet Storage' : 
                                 editingItem.zoneType === 'space-storage' ? '📐 Space Storage' :
                                 editingItem.isRentedMarker ? '🔒 Rented Space' :
                                 editingItem.barrierType === 'cage' ? '🔲 Storage Cage' : 'Zone'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Appearance */}
                      <div>
                        <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                          <span>🎨</span> Appearance
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Color</label>
                            <div className="flex gap-2 items-center">
                              <input
                                type="color"
                                value={editingItem.color}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, color: e.target.value } : null)}
                                className="w-10 h-10 rounded border border-slate-600 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={editingItem.color}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, color: e.target.value } : null)}
                                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm font-mono focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Custom Label</label>
                            <input
                              type="text"
                              value={editingItem.customLabel || ''}
                              onChange={(e) => setEditingItem(prev => prev ? { ...prev, customLabel: e.target.value || undefined } : null)}
                              placeholder={editingItem.name}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Notes */}
                      <div>
                        <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                          <span>📝</span> Notes
                        </h3>
                        <textarea
                          value={editingItem.notes || ''}
                          onChange={(e) => setEditingItem(prev => prev ? { ...prev, notes: e.target.value || undefined } : null)}
                          placeholder="Add notes about this item..."
                          rows={3}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white resize-none focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      
                      {/* Rotation */}
                      <div>
                        <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                          <span>🔄</span> Rotation
                        </h3>
                        <div className="flex items-center gap-4">
                          {/* Rotation slider */}
                          <div className="flex-1">
                            <input
                              type="range"
                              min="0"
                              max="360"
                              step="1"
                              value={editingItem.rotation || 0}
                              onChange={(e) => setEditingItem(prev => prev ? { ...prev, rotation: Number(e.target.value) } : null)}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                          
                          {/* Rotation input */}
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="360"
                              step="1"
                              value={editingItem.rotation || 0}
                              onChange={(e) => {
                                let val = Number(e.target.value) || 0
                                // Normalize to 0-360
                                while (val < 0) val += 360
                                while (val >= 360) val -= 360
                                setEditingItem(prev => prev ? { ...prev, rotation: val } : null)
                              }}
                              className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-center text-sm focus:border-blue-500 focus:outline-none"
                            />
                            <span className="text-slate-400 text-sm">°</span>
                          </div>
                        </div>
                        
                        {/* Quick rotation buttons */}
                        <div className="flex gap-2 mt-3">
                          {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
                            <button
                              key={angle}
                              onClick={() => setEditingItem(prev => prev ? { ...prev, rotation: angle } : null)}
                              className={`px-2 py-1 text-xs rounded transition-colors ${
                                (editingItem.rotation || 0) === angle 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              {angle}°
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Quick Info */}
                      <div className="p-3 bg-slate-900/50 rounded-lg text-xs text-slate-400 flex items-center gap-4">
                        <span>Type: <span className="text-white capitalize">{getItemType(editingItem)}</span></span>
                        <span>•</span>
                        <span>Position: ({editingItem.x.toFixed(1)}, {editingItem.y.toFixed(1)})</span>
                      </div>
                    </div>
                    
                    {/* Modal Footer */}
                    <div className="flex justify-end gap-3 p-4 border-t border-slate-600">
                      <button
                        onClick={() => setEditModalOpen(false)}
                        className="px-4 py-2 bg-slate-600 rounded hover:bg-slate-500 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveEditedItem}
                        className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 font-medium"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div 
              ref={canvasContainerRef}
              className="relative w-full h-full"
              onMouseUp={() => {
                // Handle catalog item drop in 3D mode
                if (dragItem && !dragItem.wallItem) {
                  // Position will be handled by the 3D component
                }
              }}
            >
              <FloorPlan3D 
                vertices={vertices} 
                items={items}
                wallOpenings={wallOpenings}
                wallHeight={wallHeight}
                selectedItemId={selectedItem !== null ? items[selectedItem]?.instanceId : null}
                dragItem={dragItem}
                onItemSelect={handle3DItemSelect}
                onItemMove={handle3DItemMove}
                onDropItem={handle3DDropItem}
              />
            </div>
          )}
        </div>
        
        {/* Help text */}
        <div className="mt-1 text-xs text-slate-400 flex items-center flex-wrap gap-x-3 gap-y-0.5 overflow-visible">
          {wallEditMode ? (
            // Wall edit mode help
            <>
              <span><span className="text-purple-400">Click vertex</span> drag</span>
              <span><span className="text-purple-400">Click wall</span> select</span>
              <span><span className="text-green-400">Split</span> midpoint</span>
              <span><span className="text-orange-400">Indent</span> inward</span>
              <span><span className="text-cyan-400">Bump</span> outward</span>
              <span className="text-yellow-400">[Del] Delete</span>
              <span className="text-yellow-400">[Esc] Exit</span>
            </>
          ) : (
            // Normal mode help
            <>
              <span><span className="text-blue-400">Click</span> corners</span>
              <span><span className="text-blue-400">Dbl-click</span> add corner</span>
              <span><span className="text-blue-400">Drag</span> catalog items</span>
              <span className="text-yellow-400">[R] Rotate</span>
              <span className="text-yellow-400">[Del] Delete</span>
              <span className="text-yellow-400">[Ctrl+D] Dup</span>
              <span className="text-yellow-400">[Scroll] Zoom</span>
              <span className="text-yellow-400">[Mid] Pan</span>
              {selectedItem !== null && (
                <button 
                  onClick={deleteSelected} 
                  className="ml-2 px-2 py-0.5 bg-red-600 rounded text-white text-xs hover:bg-red-700"
                >
                  🗑️ Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Right Sidebar - Catalog */}
      <div className="w-64 bg-slate-800 border-l border-slate-700 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-slate-700">
          <h2 className="text-base font-bold">Equipment Catalog</h2>
          <p className="text-xs text-slate-400">Drag items to the floor plan</p>
        </div>
        
        {/* Category tabs */}
        <div className="flex flex-wrap gap-1 p-3 border-b border-slate-700">
          {Object.keys(CATALOG).map(cat => (
            <button
              key={cat}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                category === cat ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
              }`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        
        {/* Items */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {CATALOG[category]?.map(item => (
              <div key={item.id}>
                {item.isCustomColumn ? (
                  // Custom column with size input
                  <div className="p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg flex-shrink-0 border-2 border-dashed border-slate-500"
                        style={{ backgroundColor: item.color }}
                      >
                        🏛️
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-xs text-slate-400">Enter dimensions below</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400 w-16">Type:</label>
                        <select
                          value={customColumnType}
                          onChange={(e) => setCustomColumnType(e.target.value as 'round' | 'square' | 'rectangular')}
                          className="flex-1 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs"
                        >
                          <option value="round">Round</option>
                          <option value="square">Square</option>
                          <option value="rectangular">Rectangular</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400 w-16">{customColumnType === 'round' ? 'Diameter:' : 'Width:'}</label>
                        <input
                          type="number"
                          value={customColumnWidth}
                          onChange={(e) => setCustomColumnWidth(e.target.value)}
                          placeholder="12"
                          className="flex-1 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs"
                          min="6"
                          max="48"
                        />
                        <span className="text-xs text-slate-400">in</span>
                      </div>
                      {customColumnType === 'rectangular' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400 w-16">Depth:</label>
                          <input
                            type="number"
                            value={customColumnDepth}
                            onChange={(e) => setCustomColumnDepth(e.target.value)}
                            placeholder="18"
                            className="flex-1 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs"
                            min="6"
                            max="48"
                          />
                          <span className="text-xs text-slate-400">in</span>
                        </div>
                      )}
                      <button
                        className="w-full mt-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={() => handleCustomColumnDragStart()}
                        onMouseDown={() => handleCustomColumnDragStart()}
                      >
                        Drag Custom Column
                      </button>
                    </div>
                  </div>
                ) : (
                  // Regular catalog item
                  <div
                    className="p-3 bg-slate-700 rounded-lg cursor-grab hover:bg-slate-600 active:cursor-grabbing transition-colors"
                    draggable
                    onDragStart={() => handleDragStart(item)}
                    onMouseDown={() => handleDragStart(item)}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-10 h-10 flex items-center justify-center text-white text-lg flex-shrink-0 ${
                          item.columnType === 'round' ? 'rounded-full' : 'rounded'
                        }`}
                        style={{ backgroundColor: item.color }}
                      >
                        {item.columnType ? '🏛️' : item.wallItem ? (item.id === 'window' ? '🪟' : '🚪') : (item.id.includes('pallet') ? '📦' : '🏭')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{item.name}</div>
                        <div className="text-xs text-slate-400">
                          {item.columnType ? (
                            item.columnType === 'rectangular' 
                              ? `${item.columnSize}" × ${item.columnDepth}" (${item.columnType})`
                              : `${item.columnSize}" ${item.columnType}`
                          ) : item.wallItem ? `${item.w} ft wide` : `${item.w} ft × ${item.h} ft`}
                        </div>
                        {item.pallets > 0 && (
                          <div className="text-xs text-green-400">{item.pallets} pallets</div>
                        )}
                        {item.wallItem && (
                          <div className="text-xs text-blue-400">Drag to wall</div>
                        )}
                        {item.columnType && (
                          <div className="text-xs text-purple-400">Structural column</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Stats - Collapsible */}
        <div className="bg-slate-900 border-t border-slate-700">
          <button 
            onClick={() => setSummaryCollapsed(!summaryCollapsed)}
            className="w-full p-3 flex items-center justify-between hover:bg-slate-800 transition-colors"
          >
            <h3 className="font-bold flex items-center gap-2">
              📊 Summary
              {summaryCollapsed && (
                <span className="text-xs font-normal text-slate-400 ml-2">
                  {totalArea.toLocaleString()} sq ft • {utilization}% • {totalPallets} pallets
                </span>
              )}
            </h3>
            <span className={`transition-transform ${summaryCollapsed ? '' : 'rotate-180'}`}>
              ▼
            </span>
          </button>
          
          {!summaryCollapsed && (
            <div className="px-4 pb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Area</span>
                <span className="font-medium">{totalArea.toLocaleString()} sq ft</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Equipment</span>
                <span className="font-medium">{equipArea.toLocaleString()} sq ft</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Open Area</span>
                <span className="font-medium">{Math.max(0, totalArea - equipArea).toLocaleString()} sq ft</span>
              </div>
              
              {/* Zone Stats */}
              <div className="h-px bg-slate-700 my-2" />
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Rental Zones</div>
              <div className="flex justify-between">
                <span className="text-slate-400">📦 Pallet Zones</span>
                <span className="font-medium text-blue-400">{palletZones.length} ({palletZoneArea.toLocaleString()} sq ft)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">📐 Space Zones</span>
                <span className="font-medium text-purple-400">{spaceZones.length} ({spaceZoneArea.toLocaleString()} sq ft)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">🔒 Rented Spaces</span>
                <span className="font-medium text-green-400">{rentedMarkers.length} ({rentedArea.toLocaleString()} sq ft)</span>
              </div>
              
              <div className="h-px bg-slate-700 my-2" />
              <div className="flex justify-between">
                <span className="text-slate-400">Utilization</span>
                <span className="font-medium">{utilization}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pallet Capacity</span>
                <span className="font-medium text-green-400">{totalPallets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Items Placed</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Doors/Windows</span>
                <span className="font-medium text-blue-400">{wallOpenings.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Columns</span>
                <span className="font-medium text-purple-400">{items.filter(i => i.columnType).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vertices</span>
                <span className="font-medium">{vertices.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Areas Management Panel */}
      {showAreaPanel && (
        <div className="absolute top-20 right-72 w-80 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50">
          <div className="flex items-center justify-between p-3 border-b border-slate-700">
            <h3 className="font-bold text-purple-400">📍 Floor Areas</h3>
            <button 
              onClick={() => setShowAreaPanel(false)}
              className="text-slate-400 hover:text-white"
            >✕</button>
          </div>
          
          {/* Area Type Selection for Drawing */}
          <div className="p-3 border-b border-slate-700">
            <label className="text-xs text-slate-400 block mb-2">Area Type</label>
            <select
              value={drawingAreaType}
              onChange={(e) => setDrawingAreaType(e.target.value as FloorArea['type'])}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-purple-500 outline-none"
            >
              <option value="pallet-storage">📦 Pallet Storage</option>
              <option value="space-storage">📐 Space Storage</option>
              <option value="loading-dock">🚛 Loading Dock</option>
              <option value="staging">📋 Staging Area</option>
              <option value="office">🏢 Office</option>
              <option value="other">📍 Other</option>
            </select>
            
            {/* Draw Area Button */}
            <button
              onClick={() => {
                if (areaDrawMode) {
                  // Cancel drawing
                  setAreaDrawMode(false)
                  setDrawingAreaVertices([])
                } else {
                  setAreaDrawMode(true)
                  setDrawingAreaVertices([])
                  setSelectedItem(null)
                  setSelectedAreaId(null)
                  setWallEditMode(false)
                }
              }}
              className={`w-full mt-2 px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                areaDrawMode 
                  ? 'bg-orange-600 hover:bg-orange-500 ring-2 ring-orange-400' 
                  : 'bg-purple-600 hover:bg-purple-500'
              }`}
            >
              {areaDrawMode ? (
                <>
                  <span className="animate-pulse">✏️</span>
                  <span>Cancel Drawing</span>
                </>
              ) : (
                <>
                  <span>✏️</span>
                  <span>Draw Area</span>
                </>
              )}
            </button>
            
            {areaDrawMode && (
              <div className="mt-2 p-2 bg-orange-600/20 rounded text-xs text-orange-300 border border-orange-600/50">
                <p className="font-medium">Drawing Mode Active</p>
                <p className="mt-1">• Click to add vertices</p>
                <p>• Click first vertex (green) to close</p>
                <p>• Need at least 3 points</p>
                {drawingAreaVertices.length > 0 && (
                  <p className="mt-1 text-orange-400">Points: {drawingAreaVertices.length}</p>
                )}
              </div>
            )}
          </div>
          
          <div className="p-3 max-h-64 overflow-y-auto">
            {areas.length === 0 && !areaDrawMode ? (
              <div className="text-center text-slate-400 py-4">
                <p className="text-sm">No areas defined yet</p>
                <p className="text-xs mt-1">Click &quot;Draw Area&quot; to create one</p>
              </div>
            ) : (
              <div className="space-y-2">
                {areas.map((area) => {
                  const areaSize = area.vertices ? calcPolygonArea(area.vertices) : 0
                  return (
                    <div 
                      key={area.id}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        selectedAreaId === area.id 
                          ? 'border-purple-500 bg-purple-500/20' 
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                      onClick={() => {
                        setSelectedAreaId(area.id === selectedAreaId ? null : area.id)
                        setSelectedAreaVertexIdx(null)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded" 
                            style={{ backgroundColor: area.color }}
                          />
                          <span className="font-medium text-sm">{area.name}</span>
                        </div>
                        <span className="text-xs text-slate-400 capitalize">{area.type.replace('-', ' ')}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {area.vertices?.length || 0} vertices • {areaSize.toLocaleString()} sq ft
                      </div>
                      {selectedAreaId === area.id && (
                        <div className="flex gap-2 mt-2 pt-2 border-t border-slate-600">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingArea(area)
                            }}
                            className="flex-1 px-2 py-1 bg-blue-600 rounded text-xs hover:bg-blue-500"
                          >Edit</button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              setAreas(areas.filter(a => a.id !== area.id))
                              setSelectedAreaId(null)
                              setSelectedAreaVertexIdx(null)
                              setHasUnsavedChanges(true)
                            }}
                            className="flex-1 px-2 py-1 bg-red-600 rounded text-xs hover:bg-red-500"
                          >Delete</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          {/* Area Stats */}
          {areas.length > 0 && (
            <div className="p-3 border-t border-slate-700 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400">Pallet Storage:</span>
                  <span className="ml-1 font-medium text-blue-400">
                    {areas.filter(a => a.type === 'pallet-storage').reduce((sum, a) => sum + calcPolygonArea(a.vertices || []), 0).toLocaleString()} sq ft
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Space Storage:</span>
                  <span className="ml-1 font-medium text-green-400">
                    {areas.filter(a => a.type === 'space-storage').reduce((sum, a) => sum + calcPolygonArea(a.vertices || []), 0).toLocaleString()} sq ft
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Edit Area Modal */}
      {editingArea && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-4 w-96 shadow-2xl border border-slate-600">
            <h3 className="font-bold text-lg mb-4">Edit Area</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Name</label>
                <input
                  type="text"
                  value={editingArea.name}
                  onChange={(e) => setEditingArea({ ...editingArea, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-purple-500 outline-none"
                />
              </div>
              
              <div>
                <label className="text-xs text-slate-400 block mb-1">Type</label>
                <select
                  value={editingArea.type}
                  onChange={(e) => setEditingArea({ ...editingArea, type: e.target.value as FloorArea['type'] })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-purple-500 outline-none"
                >
                  <option value="pallet-storage">📦 Pallet Storage</option>
                  <option value="space-storage">📐 Space Storage</option>
                  <option value="loading-dock">🚛 Loading Dock</option>
                  <option value="staging">📋 Staging Area</option>
                  <option value="office">🏢 Office</option>
                  <option value="other">📍 Other</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs text-slate-400 block mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'].map(c => (
                    <button
                      key={c}
                      onClick={() => setEditingArea({ ...editingArea, color: c })}
                      className={`w-8 h-8 rounded border-2 transition-all ${
                        editingArea.color === c ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="p-3 bg-slate-700/50 rounded">
                <div className="text-xs text-slate-400 mb-2">Area Info</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-400">Vertices:</span>
                    <span className="ml-1 font-medium">{editingArea.vertices?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Size:</span>
                    <span className="ml-1 font-medium">{calcPolygonArea(editingArea.vertices || []).toLocaleString()} sq ft</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  To edit shape: Select area on canvas and drag vertices
                </p>
              </div>
              
              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes (optional)</label>
                <textarea
                  value={editingArea.notes || ''}
                  onChange={(e) => setEditingArea({ ...editingArea, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-purple-500 outline-none resize-none"
                  placeholder="Additional notes about this area..."
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  // Update or add the area
                  const existingIndex = areas.findIndex(a => a.id === editingArea.id)
                  if (existingIndex >= 0) {
                    const newAreas = [...areas]
                    newAreas[existingIndex] = editingArea
                    setAreas(newAreas)
                  } else {
                    setAreas([...areas, editingArea])
                  }
                  setEditingArea(null)
                  setHasUnsavedChanges(true)
                }}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded font-medium transition-colors"
              >
                Save Area
              </button>
              <button
                onClick={() => setEditingArea(null)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
