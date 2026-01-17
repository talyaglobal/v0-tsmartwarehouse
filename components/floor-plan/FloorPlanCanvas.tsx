"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'

const GRID_SIZE = 20 // pixels per foot
const CANVAS_W = 900
const CANVAS_H = 600

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
    { id: 'dock', name: 'Dock Door', w: 3, h: 1, color: '#3b82f6', pallets: 0 },
    { id: 'personnel', name: 'Personnel Door', w: 1, h: 1, color: '#6b7280', pallets: 0 },
    { id: 'rollup', name: 'Roll-Up Door', w: 4, h: 1, color: '#1d4ed8', pallets: 0 },
    { id: 'emergency', name: 'Emergency Exit', w: 2, h: 1, color: '#dc2626', pallets: 0 },
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
}

interface PlacedItem extends CatalogItem {
  x: number
  y: number
  instanceId: number
}

interface Vertex {
  x: number
  y: number
}

interface FloorPlanCanvasProps {
  onSave?: (data: {
    vertices: Vertex[]
    items: PlacedItem[]
    totalArea: number
    equipmentArea: number
    palletCapacity: number
  }) => void
  initialVertices?: Vertex[]
  initialItems?: PlacedItem[]
}

export default function FloorPlanCanvas({ onSave, initialVertices, initialItems }: FloorPlanCanvasProps) {
  // Warehouse shape (vertices in feet)
  const [vertices, setVertices] = useState<Vertex[]>(initialVertices || [
    { x: 2, y: 2 },
    { x: 42, y: 2 },
    { x: 42, y: 27 },
    { x: 2, y: 27 }
  ])
  
  // Placed items
  const [items, setItems] = useState<PlacedItem[]>(initialItems || [])
  const [selectedItem, setSelectedItem] = useState<number | null>(null)
  const [dragItem, setDragItem] = useState<(CatalogItem & { x: number; y: number }) | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // View state
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D')
  const [category, setCategory] = useState('racking')
  const [editingVertex, setEditingVertex] = useState<number | null>(null)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Calculate area using Shoelace formula
  const calcArea = useCallback(() => {
    let a = 0
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length
      a += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y
    }
    return Math.abs(a / 2)
  }, [vertices])
  
  // Equipment area
  const equipArea = items.reduce((sum, item) => sum + item.w * item.h, 0)
  const totalArea = calcArea()
  const utilization = totalArea > 0 ? ((equipArea / totalArea) * 100).toFixed(1) : '0'
  const totalPallets = items.reduce((sum, item) => sum + (item.pallets || 0), 0)
  
  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    
    // Draw grid
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    for (let x = 0; x <= CANVAS_W; x += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_H)
      ctx.stroke()
    }
    for (let y = 0; y <= CANVAS_H; y += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_W, y)
      ctx.stroke()
    }
    
    // Draw major grid (10 ft)
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    for (let x = 0; x <= CANVAS_W; x += GRID_SIZE * 10) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_H)
      ctx.stroke()
    }
    for (let y = 0; y <= CANVAS_H; y += GRID_SIZE * 10) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_W, y)
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
      ctx.lineWidth = 3
      ctx.stroke()
    }
    
    // Draw wall measurements
    ctx.font = 'bold 12px Inter, Arial, sans-serif'
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
      const offsetX = mx - Math.sin(angle) * 15
      const offsetY = my + Math.cos(angle) * 15
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.fillRect(offsetX - 28, offsetY - 10, 56, 20)
      ctx.fillStyle = '#fff'
      ctx.fillText(`${len.toFixed(0)} ft`, offsetX, offsetY)
    }
    
    // Draw vertices
    vertices.forEach((v, i) => {
      ctx.beginPath()
      ctx.arc(v.x * GRID_SIZE, v.y * GRID_SIZE, editingVertex === i ? 10 : 8, 0, Math.PI * 2)
      ctx.fillStyle = editingVertex === i ? '#22c55e' : '#3b82f6'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Inner dot
      ctx.beginPath()
      ctx.arc(v.x * GRID_SIZE, v.y * GRID_SIZE, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
    })
    
    // Draw placed items
    items.forEach((item, idx) => {
      const x = item.x * GRID_SIZE
      const y = item.y * GRID_SIZE
      const w = item.w * GRID_SIZE
      const h = item.h * GRID_SIZE
      
      ctx.fillStyle = item.color + 'cc'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = selectedItem === idx ? '#22c55e' : 'rgba(255,255,255,0.5)'
      ctx.lineWidth = selectedItem === idx ? 3 : 1
      ctx.strokeRect(x, y, w, h)
      
      // Item label
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px Inter, Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // Text shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillText(item.name, x + w/2 + 1, y + h/2 + 1)
      ctx.fillStyle = '#fff'
      ctx.fillText(item.name, x + w/2, y + h/2)
      
      if (item.pallets > 0) {
        ctx.font = '10px Inter, Arial, sans-serif'
        ctx.fillStyle = '#a3e635'
        ctx.fillText(`${item.pallets} pallets`, x + w/2, y + h/2 + 14)
      }
    })
    
    // Draw drag preview
    if (dragItem) {
      const x = dragItem.x * GRID_SIZE
      const y = dragItem.y * GRID_SIZE
      const w = dragItem.w * GRID_SIZE
      const h = dragItem.h * GRID_SIZE
      
      ctx.fillStyle = dragItem.color + '66'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
    }
  }, [vertices, items, selectedItem, dragItem, editingVertex])
  
  // Mouse handlers
  const getGridPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.floor((e.clientX - rect.left) / GRID_SIZE),
      y: Math.floor((e.clientY - rect.top) / GRID_SIZE)
    }
  }, [])
  
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getGridPos(e)
    
    // Check vertex click
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i]
      if (Math.abs(pos.x - v.x) <= 1 && Math.abs(pos.y - v.y) <= 1) {
        setEditingVertex(i)
        setSelectedItem(null)
        return
      }
    }
    
    // Check item click
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      if (pos.x >= item.x && pos.x < item.x + item.w &&
          pos.y >= item.y && pos.y < item.y + item.h) {
        setSelectedItem(i)
        setDragOffset({ x: pos.x - item.x, y: pos.y - item.y })
        setEditingVertex(null)
        return
      }
    }
    
    setSelectedItem(null)
    setEditingVertex(null)
  }, [vertices, items, getGridPos])
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getGridPos(e)
    
    if (editingVertex !== null) {
      const newVerts = [...vertices]
      newVerts[editingVertex] = { x: Math.max(0, pos.x), y: Math.max(0, pos.y) }
      setVertices(newVerts)
    }
    
    if (selectedItem !== null && e.buttons === 1) {
      const newItems = [...items]
      newItems[selectedItem] = {
        ...newItems[selectedItem],
        x: Math.max(0, pos.x - dragOffset.x),
        y: Math.max(0, pos.y - dragOffset.y)
      }
      setItems(newItems)
    }
    
    if (dragItem) {
      setDragItem({ ...dragItem, x: pos.x, y: pos.y })
    }
  }, [editingVertex, selectedItem, dragItem, vertices, items, dragOffset, getGridPos])
  
  const handleMouseUp = useCallback(() => {
    if (dragItem) {
      setItems([...items, { ...dragItem, instanceId: Date.now() }])
      setDragItem(null)
    }
    setEditingVertex(null)
  }, [dragItem, items])
  
  const handleDragStart = useCallback((item: CatalogItem) => {
    setDragItem({ ...item, x: 0, y: 0 })
  }, [])
  
  const deleteSelected = useCallback(() => {
    if (selectedItem !== null) {
      setItems(items.filter((_, i) => i !== selectedItem))
      setSelectedItem(null)
    }
  }, [selectedItem, items])
  
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave({
        vertices,
        items,
        totalArea,
        equipmentArea: equipArea,
        palletCapacity: totalPallets,
      })
    }
  }, [onSave, vertices, items, totalArea, equipArea, totalPallets])

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItem !== null) {
          deleteSelected()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem, deleteSelected])

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] bg-slate-900 text-white rounded-lg overflow-hidden">
      {/* Main Canvas Area */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-4 bg-slate-800 p-3 rounded-lg">
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 flex items-center gap-2 font-medium"
          >
            💾 Save
          </button>
          <div className="flex gap-1">
            <button className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600">↩️</button>
            <button className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600">↪️</button>
          </div>
          <div className="flex-1" />
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
          </div>
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
        <div className="flex-1 flex items-center justify-center">
          {viewMode === '2D' ? (
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="rounded-lg cursor-crosshair shadow-2xl"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          ) : (
            <div className="w-full max-w-[900px] h-[600px] bg-slate-800 rounded-lg flex items-center justify-center">
              <div className="text-center text-slate-400">
                <div className="text-6xl mb-4">🏗️</div>
                <p className="text-lg font-medium">3D View - Coming Soon</p>
                <p className="text-sm">Three.js integration required</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Help text */}
        <div className="mt-3 text-sm text-slate-400 flex items-center gap-2">
          <span><span className="text-blue-400 font-medium">Click</span> corners to drag</span>
          <span>•</span>
          <span><span className="text-blue-400 font-medium">Drag</span> items from catalog</span>
          <span>•</span>
          <span><span className="text-blue-400 font-medium">Click</span> item to select</span>
          <span>•</span>
          <span><span className="text-blue-400 font-medium">Delete</span> key to remove</span>
          {selectedItem !== null && (
            <button 
              onClick={deleteSelected} 
              className="ml-4 px-3 py-1 bg-red-600 rounded text-white text-xs font-medium hover:bg-red-700"
            >
              🗑️ Delete Selected
            </button>
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
                    📦
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.w} ft × {item.h} ft</div>
                    {item.pallets > 0 && (
                      <div className="text-xs text-green-400">{item.pallets} pallets</div>
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
          </div>
        </div>
      </div>
    </div>
  )
}
