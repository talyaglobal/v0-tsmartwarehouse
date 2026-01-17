"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { saveFloorPlan, loadFloorPlan } from '@/lib/actions/floor-plan'
import { exportToPNG, exportToPDF, export3DScreenshot } from '@/lib/utils/floor-plan-export'
import { useToast } from '@/lib/hooks/use-toast'

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
const CANVAS_W = 900
const CANVAS_H = 600

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
  zones: [
    { id: 'staging', name: 'Staging Area', w: 6, h: 4, color: '#fbbf24', pallets: 0 },
    { id: 'packing', name: 'Packing Station', w: 5, h: 3, color: '#10b981', pallets: 0 },
    { id: 'picking', name: 'Picking Area', w: 8, h: 5, color: '#22d3ee', pallets: 0 },
    { id: 'returns', name: 'Returns Area', w: 4, h: 4, color: '#f472b6', pallets: 0 },
    { id: 'hazmat', name: 'Hazmat Zone', w: 5, h: 5, color: '#ef4444', pallets: 0 },
  ],
  equipment: [
    { id: 'charger', name: 'Forklift Charger', w: 3, h: 2, color: '#22c55e', pallets: 0 },
    { id: 'office', name: 'Office Area', w: 6, h: 5, color: '#a78bfa', pallets: 0 },
    { id: 'breakroom', name: 'Break Room', w: 5, h: 4, color: '#f472b6', pallets: 0 },
    { id: 'restroom', name: 'Restroom', w: 3, h: 3, color: '#60a5fa', pallets: 0 },
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
}

interface PlacedItem extends CatalogItem {
  x: number
  y: number
  rotation: number
  instanceId: number
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
  
  // View state
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D')
  const [category, setCategory] = useState('racking')
  const [editingVertex, setEditingVertex] = useState<number | null>(null)
  
  // Zoom & Pan
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 })
  
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
  
  // 3D wall height (ft)
  const [wallHeight, setWallHeight] = useState(initialWallHeight || 20)
  
  // Canvas container ref for 3D screenshot
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  
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
  
  // Load floor plan from database - runs once on mount
  useEffect(() => {
    // Prevent multiple loads
    if (isInitialized) return
    
    const loadData = async () => {
      // Skip if no warehouse ID
      if (!warehouseId) {
        console.log('No warehouse ID, using defaults')
        setIsInitialized(true)
        return
      }
      
      try {
        console.log('Loading floor plan for:', warehouseId)
        const result = await loadFloorPlan(warehouseId)
        
        if (result.success && result.data) {
          const data = result.data
          console.log('Floor plan loaded:', data)
          
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
          if (data.updated_at) {
            setLastSaved(new Date(data.updated_at))
          }
          
          // Initialize history with loaded data
          const historyItems = (data.items || []).map((item: { rotation?: number }) => ({
            ...item,
            rotation: item.rotation ?? 0,
          })) as PlacedItem[]
          setHistory([{ vertices: data.vertices || SHAPE_TEMPLATES.rectangle, items: historyItems }])
          setHistoryIndex(0)
        } else {
          console.log('No existing floor plan, using defaults')
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
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    
    // Apply transform
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)
    
    // Draw grid
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1 / zoom
    for (let x = 0; x <= CANVAS_W / zoom; x += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_H / zoom)
      ctx.stroke()
    }
    for (let y = 0; y <= CANVAS_H / zoom; y += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_W / zoom, y)
      ctx.stroke()
    }
    
    // Draw major grid (10 ft)
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1 / zoom
    for (let x = 0; x <= CANVAS_W / zoom; x += GRID_SIZE * 10) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_H / zoom)
      ctx.stroke()
    }
    for (let y = 0; y <= CANVAS_H / zoom; y += GRID_SIZE * 10) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_W / zoom, y)
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
      
      ctx.fillStyle = item.color + 'cc'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = selectedItem === idx ? '#22c55e' : 'rgba(255,255,255,0.5)'
      ctx.lineWidth = (selectedItem === idx ? 3 : 1) / zoom
      ctx.strokeRect(x, y, w, h)
      
      // Item label
      ctx.font = `bold ${11 / zoom}px Inter, Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // Text shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillText(item.name, x + w/2 + 1/zoom, y + h/2 + 1/zoom)
      ctx.fillStyle = '#fff'
      ctx.fillText(item.name, x + w/2, y + h/2)
      
      if (item.pallets > 0) {
        ctx.font = `${10 / zoom}px Inter, Arial, sans-serif`
        ctx.fillStyle = '#a3e635'
        ctx.fillText(`${item.pallets} pallets`, x + w/2, y + h/2 + 14/zoom)
      }
      
      ctx.restore()
    })
    
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
  }, [vertices, items, wallOpenings, selectedItem, selectedOpening, dragItem, editingVertex, editingWall, zoom, pan, isInsideWarehouse, hasCollision, findClosestWall, wallEditMode, selectedWallIdx, selectedVertexIdx])
  
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
  
  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle mouse for panning
    if (e.button === 1) {
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
    
    // Normal mode - existing logic
    
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
    setEditingVertex(null)
    setEditingWall(null)
  }, [vertices, items, wallOpenings, getGridPos, getCanvasPos, isPointOnLine, wallEditMode, findVertexAtPos, findWallAtPos])
  
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
    
    // Wall edit mode vertex dragging
    if (wallEditMode && isDraggingVertex && selectedVertexIdx !== null) {
      const newVerts = [...vertices]
      newVerts[selectedVertexIdx] = { x: Math.round(Math.max(0, pos.x)), y: Math.round(Math.max(0, pos.y)) }
      setVertices(newVerts)
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
  }, [editingVertex, selectedItem, dragItem, vertices, items, dragOffset, getGridPos, isPanning, lastPan, wallEditMode, isDraggingVertex, selectedVertexIdx])
  
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      return
    }
    
    // Wall edit mode - end vertex dragging
    if (wallEditMode && isDraggingVertex) {
      setIsDraggingVertex(false)
      saveToHistory(vertices, items)
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
  }, [dragItem, items, vertices, wallOpenings, editingVertex, isPanning, isInsideWarehouse, hasCollision, saveToHistory, findClosestWall, wallEditMode, isDraggingVertex])
  
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
  
  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.min(Math.max(z * delta, 0.5), 3))
  }, [])
  
  const handleDragStart = useCallback((item: CatalogItem) => {
    setDragItem({ ...item, x: 0, y: 0, rotation: 0 })
  }, [])
  
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
        const result = await saveFloorPlan(warehouseId, {
          vertices,
          items,
          wallOpenings,
          wallHeight,
          totalArea,
          equipmentArea: equipArea,
          palletCapacity: totalPallets,
        })
        
        if (result.success) {
          setLastSaved(new Date())
          toast({ title: 'Floor plan saved!', variant: 'success' })
        } else {
          console.error('Failed to save floor plan:', result.error)
          toast({ title: `Failed to save: ${result.error}`, variant: 'destructive' })
        }
      } catch (error) {
        console.error('Failed to save floor plan:', error)
        toast({ title: 'Failed to save floor plan', variant: 'destructive' })
      } finally {
        setIsSaving(false)
      }
    }
  }, [onSave, warehouseId, vertices, items, wallOpenings, wallHeight, totalArea, equipArea, totalPallets, toast])
  
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
      
      // Escape key - exit wall edit mode
      if (e.key === 'Escape') {
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
  }, [selectedItem, selectedOpening, deleteSelected, rotateSelected, duplicateSelected, undo, redo, wallEditMode, selectedVertexIdx, deleteVertex, exitWallEditMode])

  // Loading state
  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] bg-slate-900 text-white rounded-lg overflow-hidden">
      {/* Main Canvas Area */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-4 bg-slate-800 p-3 rounded-lg flex-wrap">
          {/* Save */}
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 flex items-center gap-2 font-medium disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⏳</span> Saving...
              </>
            ) : (
              <>💾 Save</>
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
              onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
              className="px-2 py-2 bg-slate-700 rounded hover:bg-slate-600"
              title="Zoom Out"
            >➖</button>
            <span className="w-14 text-center text-sm">{(zoom * 100).toFixed(0)}%</span>
            <button 
              onClick={() => setZoom(z => Math.min(z + 0.1, 3))}
              className="px-2 py-2 bg-slate-700 rounded hover:bg-slate-600"
              title="Zoom In"
            >➕</button>
            <button 
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
              className="px-2 py-2 bg-slate-700 rounded hover:bg-slate-600"
              title="Reset View"
            >⟲</button>
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
        <div className="flex-1 flex items-center justify-center relative">
          {viewMode === '2D' ? (
            <>
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="rounded-lg cursor-crosshair shadow-2xl"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
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
            </>
          ) : (
            <div 
              ref={canvasContainerRef}
              className="relative" 
              style={{ width: CANVAS_W, height: CANVAS_H }}
              onMouseUp={() => {
                // Handle catalog item drop in 3D mode
                if (dragItem && !dragItem.wallItem) {
                  // Position will be handled by the 3D component
                }
              }}
            >
              <FloorPlan3D 
                key={`3d-${items.length}-${vertices.length}-${wallOpenings.length}`}
                vertices={vertices} 
                items={items}
                wallOpenings={wallOpenings}
                wallHeight={wallHeight}
                selectedItemId={selectedItem !== null ? items[selectedItem]?.instanceId : null}
                dragItem={dragItem}
                onItemSelect={(instanceId) => {
                  if (instanceId === null) {
                    setSelectedItem(null)
                  } else {
                    const idx = items.findIndex(i => i.instanceId === instanceId)
                    setSelectedItem(idx >= 0 ? idx : null)
                  }
                }}
                onItemMove={(instanceId, newX, newY) => {
                  const idx = items.findIndex(i => i.instanceId === instanceId)
                  if (idx >= 0) {
                    const newItems = [...items]
                    newItems[idx] = { ...newItems[idx], x: newX, y: newY }
                    setItems(newItems)
                  }
                }}
                onDropItem={(x, y) => {
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
                }}
              />
            </div>
          )}
        </div>
        
        {/* Help text */}
        <div className="mt-3 text-sm text-slate-400 flex items-center flex-wrap gap-x-2 gap-y-1">
          {wallEditMode ? (
            // Wall edit mode help
            <>
              <span><span className="text-purple-400 font-medium">Click vertex</span> to select & drag</span>
              <span>•</span>
              <span><span className="text-purple-400 font-medium">Click wall</span> to select</span>
              <span>•</span>
              <span><span className="text-green-400 font-medium">Split</span> adds midpoint vertex</span>
              <span>•</span>
              <span><span className="text-orange-400 font-medium">Indent</span> creates inward notch</span>
              <span>•</span>
              <span><span className="text-cyan-400 font-medium">Bump</span> creates outward protrusion</span>
              <span>•</span>
              <span><span className="text-yellow-400 font-medium">[Del]</span> Delete vertex</span>
              <span>•</span>
              <span><span className="text-yellow-400 font-medium">[Esc]</span> Exit edit mode</span>
            </>
          ) : (
            // Normal mode help
            <>
              <span><span className="text-blue-400 font-medium">Click</span> corners to drag</span>
              <span>•</span>
              <span><span className="text-blue-400 font-medium">Double-click</span> wall to add corner</span>
              <span>•</span>
              <span><span className="text-blue-400 font-medium">Click</span> wall to edit length</span>
              <span>•</span>
              <span><span className="text-blue-400 font-medium">Drag</span> items/doors from catalog</span>
              <span>•</span>
              <span><span className="text-yellow-400 font-medium">[R]</span> Rotate</span>
              <span>•</span>
              <span><span className="text-yellow-400 font-medium">[Del]</span> Delete</span>
              <span>•</span>
              <span><span className="text-yellow-400 font-medium">[Ctrl+D]</span> Duplicate</span>
              <span>•</span>
              <span><span className="text-yellow-400 font-medium">[Scroll]</span> Zoom</span>
              <span>•</span>
              <span><span className="text-yellow-400 font-medium">[Middle Mouse]</span> Pan</span>
              {selectedItem !== null && (
                <button 
                  onClick={deleteSelected} 
                  className="ml-4 px-3 py-1 bg-red-600 rounded text-white text-xs font-medium hover:bg-red-700"
                >
                  🗑️ Delete Selected
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Right Sidebar - Catalog */}
      <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">Equipment Catalog</h2>
          <p className="text-xs text-slate-400 mt-1">Drag items to the floor plan</p>
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
              <div
                key={item.id}
                className="p-3 bg-slate-700 rounded-lg cursor-grab hover:bg-slate-600 active:cursor-grabbing transition-colors"
                draggable
                onDragStart={() => handleDragStart(item)}
                onMouseDown={() => handleDragStart(item)}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded flex items-center justify-center text-white text-lg flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.wallItem ? (item.id === 'window' ? '🪟' : '🚪') : (item.id.includes('pallet') ? '📦' : '🏭')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    <div className="text-xs text-slate-400">
                      {item.wallItem ? `${item.w} ft wide` : `${item.w} ft × ${item.h} ft`}
                    </div>
                    {item.pallets > 0 && (
                      <div className="text-xs text-green-400">{item.pallets} pallets</div>
                    )}
                    {item.wallItem && (
                      <div className="text-xs text-blue-400">Drag to wall</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Stats */}
        <div className="p-4 bg-slate-900 border-t border-slate-700">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            📊 Summary
          </h3>
          <div className="space-y-2 text-sm">
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
              <span className="text-slate-400">Vertices</span>
              <span className="font-medium">{vertices.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
