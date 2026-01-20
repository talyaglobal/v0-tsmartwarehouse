'use client'

import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

interface Vertex { x: number; y: number }

interface PlacedItem {
  instanceId: number
  id?: string
  name: string
  x: number
  y: number
  w: number
  h: number
  color: string
  pallets?: number
  rotation?: number
}

interface WallOpening {
  id: number
  wallIndex: number
  type: string
  position: number
  width: number
  height: number
}

interface Props {
  vertices: Vertex[]
  items: PlacedItem[]
  wallOpenings?: WallOpening[]
  wallHeight?: number
  selectedItemId?: number | null
  dragItem?: { name: string; w: number; h: number; color: string } | null
  onItemSelect?: (instanceId: number | null) => void
  onItemMove?: (instanceId: number, newX: number, newY: number) => void
  onDropItem?: (x: number, y: number) => void
}

export default function FloorPlan3DSimple({
  vertices,
  items,
  wallOpenings = [],
  wallHeight = 20,
  selectedItemId,
  dragItem,
  onItemSelect,
  onItemMove,
  onDropItem
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Three.js objects - persist across renders (don't reset camera!)
  const threeRef = useRef<{
    scene: THREE.Scene | null
    camera: THREE.PerspectiveCamera | null
    renderer: THREE.WebGLRenderer | null
    controls: OrbitControls | null
    itemGroups: Map<number, THREE.Group>
    floorGroup: THREE.Group | null
    wallGroup: THREE.Group | null
    openingsGroup: THREE.Group | null
    dragPreview: THREE.Mesh | null
    initialized: boolean
  }>({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    itemGroups: new Map(),
    floorGroup: null,
    wallGroup: null,
    openingsGroup: null,
    dragPreview: null,
    initialized: false
  })

  // Drag state
  const dragState = useRef({
    isDragging: false,
    draggedId: null as number | null,
    startFloor: { x: 0, z: 0 },
    startItemCenter: { x: 0, z: 0 },
    itemDims: { w: 0, h: 0 }
  })

  const [status, setStatus] = useState('Ready - Click items to drag')

  // Safe data
  const safeVertices = useMemo(() => {
    if (!vertices || vertices.length < 3) {
      return [
        { x: 2, y: 2 }, { x: 42, y: 2 }, { x: 42, y: 27 }, { x: 2, y: 27 }
      ]
    }
    return vertices
  }, [vertices])

  const safeItems = useMemo(() => {
    if (!items || !Array.isArray(items)) return []
    return items.filter(item => 
      item && typeof item.x === 'number' && typeof item.y === 'number' &&
      typeof item.w === 'number' && typeof item.h === 'number'
    )
  }, [items])

  const bounds = useMemo(() => {
    const xs = safeVertices.map(v => v.x)
    const ys = safeVertices.map(v => v.y)
    return {
      cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      size: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    }
  }, [safeVertices])

  // Raycast to find item mesh (works from ANY angle!)
  const raycastToItem = useCallback((clientX: number, clientY: number): number | null => {
    const t = threeRef.current
    if (!containerRef.current || !t.camera || !t.scene) return null

    const rect = containerRef.current.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, t.camera)

    // Collect all item meshes
    const meshes: THREE.Object3D[] = []
    t.itemGroups.forEach(group => {
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child)
        }
      })
    })

    const hits = raycaster.intersectObjects(meshes, false)
    
    if (hits.length > 0) {
      // Find parent group with itemId
      let obj: THREE.Object3D | null = hits[0].object
      while (obj) {
        if (obj.userData?.itemId !== undefined) {
          return obj.userData.itemId
        }
        obj = obj.parent
      }
    }
    return null
  }, [])

  // Raycast to floor plane
  const raycastToFloor = useCallback((clientX: number, clientY: number): { x: number; z: number } | null => {
    const t = threeRef.current
    if (!containerRef.current || !t.camera) return null

    const rect = containerRef.current.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, t.camera)
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const point = new THREE.Vector3()
    
    if (raycaster.ray.intersectPlane(plane, point)) {
      return { x: point.x, z: point.z }
    }
    return null
  }, [])

  // Stable callback refs for event handlers
  const handlersRef = useRef({
    onItemSelect,
    onItemMove,
    onDropItem,
    items: safeItems,
    dragItem
  })
  
  // Update refs when props change
  useEffect(() => {
    handlersRef.current = {
      onItemSelect,
      onItemMove,
      onDropItem,
      items: safeItems,
      dragItem
    }
  }, [onItemSelect, onItemMove, onDropItem, safeItems, dragItem])

  // Mouse handlers - use refs to avoid recreating
  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.button !== 0) return
    
    const t = threeRef.current
    const ds = dragState.current
    const handlers = handlersRef.current

    // Check for catalog item drop first
    if (handlers.dragItem) {
      const floorPos = raycastToFloor(e.clientX, e.clientY)
      if (floorPos) {
        const x = Math.round(floorPos.x - handlers.dragItem.w / 2)
        const z = Math.round(floorPos.z - handlers.dragItem.h / 2)
        handlers.onDropItem?.(x, z)
        setStatus(`Dropped "${handlers.dragItem.name}" at (${x}, ${z})`)
      }
      return
    }

    // Try to hit an item mesh (works from any angle!)
    const hitItemId = raycastToItem(e.clientX, e.clientY)
    
    if (hitItemId !== null) {
      const item = handlers.items.find(i => i.instanceId === hitItemId)
      if (!item) return

      const floorPos = raycastToFloor(e.clientX, e.clientY)
      if (!floorPos) return

      e.preventDefault()
      e.stopPropagation()

      ds.isDragging = true
      ds.draggedId = hitItemId
      ds.startFloor = { x: floorPos.x, z: floorPos.z }
      ds.startItemCenter = { x: item.x + item.w / 2, z: item.y + item.h / 2 }
      ds.itemDims = { w: item.w, h: item.h }

      // Disable orbit controls
      if (t.controls) {
        t.controls.enabled = false
      }

      handlers.onItemSelect?.(hitItemId)
      setStatus(`Dragging: ${item.name}`)
      
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
    // If no item hit, OrbitControls handles it
  }, [raycastToItem, raycastToFloor])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const t = threeRef.current
    const ds = dragState.current
    const handlers = handlersRef.current

    // Update drag preview for catalog items
    if (handlers.dragItem && t.dragPreview) {
      const floorPos = raycastToFloor(e.clientX, e.clientY)
      if (floorPos) {
        t.dragPreview.position.x = floorPos.x
        t.dragPreview.position.z = floorPos.z
        t.dragPreview.visible = true
      }
    }

    if (!ds.isDragging || ds.draggedId === null) return

    const floorPos = raycastToFloor(e.clientX, e.clientY)
    if (!floorPos) return

    const group = t.itemGroups.get(ds.draggedId)
    if (!group) return

    // Calculate new position
    const dx = floorPos.x - ds.startFloor.x
    const dz = floorPos.z - ds.startFloor.z
    
    const newX = Math.round(ds.startItemCenter.x + dx)
    const newZ = Math.round(ds.startItemCenter.z + dz)

    // Update mesh position directly (smooth)
    group.position.x = newX
    group.position.z = newZ

    const cornerX = newX - Math.floor(ds.itemDims.w / 2)
    const cornerZ = newZ - Math.floor(ds.itemDims.h / 2)
    setStatus(`Moving: (${cornerX}, ${cornerZ})`)
  }, [raycastToFloor])

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const t = threeRef.current
    const ds = dragState.current
    const handlers = handlersRef.current

    // Hide drag preview
    if (t.dragPreview) {
      t.dragPreview.visible = false
    }

    if (ds.isDragging && ds.draggedId !== null) {
      const group = t.itemGroups.get(ds.draggedId)

      if (group) {
        const finalX = Math.round(group.position.x - ds.itemDims.w / 2)
        const finalZ = Math.round(group.position.z - ds.itemDims.h / 2)
        
        handlers.onItemMove?.(ds.draggedId, finalX, finalZ)
        setStatus(`Dropped at (${finalX}, ${finalZ})`)
      }

      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // Ignore
      }
    }

    // Re-enable orbit controls
    if (t.controls) {
      t.controls.enabled = true
    }

    ds.isDragging = false
    ds.draggedId = null
  }, [])

  // Initialize Three.js scene ONCE
  useEffect(() => {
    if (!containerRef.current || threeRef.current.initialized) return

    const container = containerRef.current
    const t = threeRef.current
    const w = container.clientWidth
    const h = container.clientHeight

    // Scene
    t.scene = new THREE.Scene()
    t.scene.background = new THREE.Color(0x0f172a)

    // Camera - initial position
    const dist = bounds.size * 1.2
    t.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500)
    t.camera.position.set(bounds.cx + dist, dist * 0.7, bounds.cy + dist)
    t.camera.lookAt(bounds.cx, 0, bounds.cy)

    // Renderer
    t.renderer = new THREE.WebGLRenderer({ antialias: true })
    t.renderer.setSize(w, h)
    t.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    t.renderer.shadowMap.enabled = false // Shadows disabled
    t.renderer.domElement.style.touchAction = 'none'
    container.appendChild(t.renderer.domElement)

    // Controls
    t.controls = new OrbitControls(t.camera, t.renderer.domElement)
    t.controls.target.set(bounds.cx, 0, bounds.cy)
    t.controls.enableDamping = true
    t.controls.dampingFactor = 0.1
    t.controls.maxPolarAngle = Math.PI / 2 - 0.05

    // Lights (no shadows)
    t.scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    t.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x1e3a5f, 0.4))
    const sun = new THREE.DirectionalLight(0xffffff, 0.7)
    sun.position.set(bounds.cx + 30, 50, bounds.cy + 30)
    // sun.castShadow = false - shadows disabled globally
    t.scene.add(sun)

    // Grid - covers entire scene, centered on warehouse
    const gridSize = 500
    const gridDivisions = 500 // 1 foot per square
    const grid = new THREE.GridHelper(gridSize, gridDivisions, 0x334155, 0x1e293b)
    // Center grid on warehouse bounds
    grid.position.set(bounds.cx, -0.02, bounds.cy)
    t.scene.add(grid)

    // Groups for organized updates
    t.floorGroup = new THREE.Group()
    t.wallGroup = new THREE.Group()
    t.openingsGroup = new THREE.Group()
    t.scene.add(t.floorGroup)
    t.scene.add(t.wallGroup)
    t.scene.add(t.openingsGroup)

    // Drag preview - base geometry is 1x1x1, scale will set actual size
    t.dragPreview = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, transparent: true, opacity: 0.5 })
    )
    t.dragPreview.visible = false
    t.dragPreview.position.y = 2
    t.scene.add(t.dragPreview)

    // Events
    t.renderer.domElement.addEventListener('pointerdown', handlePointerDown)
    t.renderer.domElement.addEventListener('pointermove', handlePointerMove)
    t.renderer.domElement.addEventListener('pointerup', handlePointerUp)
    t.renderer.domElement.addEventListener('pointercancel', handlePointerUp)
    t.renderer.domElement.addEventListener('pointerleave', handlePointerUp)

    // Animation loop
    let frameId: number
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      t.controls?.update()
      if (t.renderer && t.scene && t.camera) {
        t.renderer.render(t.scene, t.camera)
      }
    }
    animate()

    // Resize handler
    const onResize = () => {
      if (!t.camera || !t.renderer) return
      const nw = container.clientWidth
      const nh = container.clientHeight
      t.camera.aspect = nw / nh
      t.camera.updateProjectionMatrix()
      t.renderer.setSize(nw, nh)
    }
    window.addEventListener('resize', onResize)

    t.initialized = true

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      if (t.renderer) {
        t.renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
        t.renderer.domElement.removeEventListener('pointermove', handlePointerMove)
        t.renderer.domElement.removeEventListener('pointerup', handlePointerUp)
        t.renderer.domElement.removeEventListener('pointercancel', handlePointerUp)
        t.renderer.domElement.removeEventListener('pointerleave', handlePointerUp)
        t.renderer.dispose()
        if (container.contains(t.renderer.domElement)) {
          container.removeChild(t.renderer.domElement)
        }
      }
      t.controls?.dispose()
      t.initialized = false
    }
  }, [bounds.cx, bounds.cy, bounds.size, handlePointerDown, handlePointerMove, handlePointerUp])

  // Build floor when vertices change
  useEffect(() => {
    const t = threeRef.current
    if (!t.scene || !t.initialized || !t.floorGroup) return

    const floorGroup = t.floorGroup

    // Clear floor group
    while (floorGroup.children.length > 0) {
      floorGroup.remove(floorGroup.children[0])
    }

    if (safeVertices.length >= 3) {
      const shape = new THREE.Shape()
      shape.moveTo(safeVertices[0].x, safeVertices[0].y)
      safeVertices.slice(1).forEach(v => shape.lineTo(v.x, v.y))
      shape.closePath()

      const floor = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({ color: 0x1e3a5f, side: THREE.DoubleSide })
      )
      floor.rotation.x = -Math.PI / 2
      // floor.receiveShadow = false // Shadows disabled
      floorGroup.add(floor)
    }
  }, [safeVertices])

  // Build walls when vertices/wallHeight change
  useEffect(() => {
    const t = threeRef.current
    if (!t.scene || !t.initialized || !t.wallGroup) return

    const wallGroup = t.wallGroup

    // Clear wall group
    while (wallGroup.children.length > 0) {
      wallGroup.remove(wallGroup.children[0])
    }

    if (safeVertices.length >= 3) {
      safeVertices.forEach((v1, i) => {
        const v2 = safeVertices[(i + 1) % safeVertices.length]
        const len = Math.hypot(v2.x - v1.x, v2.y - v1.y)
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(len, wallHeight, 0.8),
          new THREE.MeshStandardMaterial({ 
            color: 0x64748b, 
            transparent: true, 
            opacity: 0.35,  // More transparent to see items behind
            side: THREE.DoubleSide,
            depthWrite: false  // Prevents z-fighting with objects behind
          })
        )
        wall.position.set((v1.x + v2.x) / 2, wallHeight / 2, (v1.y + v2.y) / 2)
        wall.rotation.y = -Math.atan2(v2.y - v1.y, v2.x - v1.x)
        wall.renderOrder = 1  // Render walls after other objects
        wallGroup.add(wall)
      })
    }
  }, [safeVertices, wallHeight])

  // Build wall openings
  useEffect(() => {
    const t = threeRef.current
    if (!t.scene || !t.initialized || !t.openingsGroup) return

    const openingsGroup = t.openingsGroup

    // Clear openings group
    while (openingsGroup.children.length > 0) {
      openingsGroup.remove(openingsGroup.children[0])
    }

    wallOpenings.forEach(opening => {
      if (opening.wallIndex >= safeVertices.length) return
      
      const v1 = safeVertices[opening.wallIndex]
      const v2 = safeVertices[(opening.wallIndex + 1) % safeVertices.length]
      
      const x = v1.x + (v2.x - v1.x) * opening.position
      const z = v1.y + (v2.y - v1.y) * opening.position
      const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x)
      
      const isWindow = opening.type === 'window'
      const doorHeight = opening.height || (isWindow ? 4 : 8)
      const yPos = isWindow ? wallHeight * 0.5 : doorHeight / 2

      const colors: Record<string, number> = {
        dock: 0x3b82f6, personnel: 0x6b7280, emergency: 0x22c55e,
        rollup: 0xf59e0b, window: 0x06b6d4,
      }

      const door = new THREE.Mesh(
        new THREE.BoxGeometry(opening.width, doorHeight, 0.8),
        new THREE.MeshStandardMaterial({ 
          color: colors[opening.type] || 0xffffff,
          transparent: isWindow, opacity: isWindow ? 0.4 : 1
        })
      )
      door.position.set(x, yPos, z)
      door.rotation.y = -angle
      openingsGroup.add(door)
    })
  }, [wallOpenings, safeVertices, wallHeight])

  // Build items - DON'T touch camera!
  useEffect(() => {
    const t = threeRef.current
    if (!t.scene || !t.initialized) return

    // Remove old items
    t.itemGroups.forEach(g => t.scene!.remove(g))
    t.itemGroups.clear()

    // Add items
    safeItems.forEach(item => {
      const group = new THREE.Group()
      group.userData.itemId = item.instanceId
      group.position.set(item.x + item.w / 2, 0, item.y + item.h / 2)

      const isRack = item.name?.toLowerCase().includes('rack')
      const isColumn = !!(item as { columnType?: string }).columnType
      const columnType = (item as { columnType?: string }).columnType
      const itemHeight = isRack ? 16 : (isColumn ? wallHeight : 4)
      const color = new THREE.Color(item.color || '#f97316')
      const isSelected = selectedItemId === item.instanceId

      if (isColumn) {
        // Structural column
        const columnMat = new THREE.MeshStandardMaterial({ 
          color: 0x4b5563, 
          metalness: 0.3, 
          roughness: 0.7 
        })
        
        if (columnType === 'round') {
          // Cylindrical column
          const radius = item.w / 2
          const columnGeom = new THREE.CylinderGeometry(radius, radius, itemHeight, 16)
          const column = new THREE.Mesh(columnGeom, columnMat)
          column.position.y = itemHeight / 2
          // column.castShadow = false // Shadows disabled
          column.userData.itemId = item.instanceId
          group.add(column)
          
          // Column base (wider)
          const baseMat = new THREE.MeshStandardMaterial({ color: 0x374151 })
          const baseGeom = new THREE.CylinderGeometry(radius * 1.3, radius * 1.3, 0.5, 16)
          const base = new THREE.Mesh(baseGeom, baseMat)
          base.position.y = 0.25
          base.userData.itemId = item.instanceId
          group.add(base)
          
          // Column top cap
          const capGeom = new THREE.CylinderGeometry(radius * 1.2, radius * 1.2, 0.3, 16)
          const cap = new THREE.Mesh(capGeom, baseMat)
          cap.position.y = itemHeight - 0.15
          cap.userData.itemId = item.instanceId
          group.add(cap)
        } else {
          // Rectangular/square column
          const columnGeom = new THREE.BoxGeometry(item.w, itemHeight, item.h)
          const column = new THREE.Mesh(columnGeom, columnMat)
          column.position.y = itemHeight / 2
          // column.castShadow = false // Shadows disabled
          column.userData.itemId = item.instanceId
          group.add(column)
          
          // Column base
          const baseMat = new THREE.MeshStandardMaterial({ color: 0x374151 })
          const baseGeom = new THREE.BoxGeometry(item.w + 0.3, 0.5, item.h + 0.3)
          const base = new THREE.Mesh(baseGeom, baseMat)
          base.position.y = 0.25
          base.userData.itemId = item.instanceId
          group.add(base)
          
          // Column top cap
          const capGeom = new THREE.BoxGeometry(item.w + 0.2, 0.3, item.h + 0.2)
          const cap = new THREE.Mesh(capGeom, baseMat)
          cap.position.y = itemHeight - 0.15
          cap.userData.itemId = item.instanceId
          group.add(cap)
        }
      } else if (isRack) {
        // Rack structure with posts and shelves
        const postGeom = new THREE.BoxGeometry(0.25, itemHeight, 0.25)
        const postMat = new THREE.MeshStandardMaterial({ color })
        
        const postPositions = [
          [-item.w/2 + 0.15, -item.h/2 + 0.15],
          [item.w/2 - 0.15, -item.h/2 + 0.15],
          [-item.w/2 + 0.15, item.h/2 - 0.15],
          [item.w/2 - 0.15, item.h/2 - 0.15],
        ]
        
        postPositions.forEach(([px, pz]) => {
          const post = new THREE.Mesh(postGeom, postMat)
          post.position.set(px, itemHeight / 2, pz)
          // post.castShadow = false // Shadows disabled
          post.userData.itemId = item.instanceId
          group.add(post)
        })

        // Shelves
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0x64748b })
        const palletMat = new THREE.MeshStandardMaterial({ color: 0x92400e })
        
        for (let level = 0; level < 4; level++) {
          const yPos = (level + 1) * 4
          const shelf = new THREE.Mesh(
            new THREE.BoxGeometry(item.w - 0.4, 0.1, item.h - 0.4),
            shelfMat
          )
          shelf.position.set(0, yPos, 0)
          shelf.userData.itemId = item.instanceId
          group.add(shelf)

          if (level < 3) {
            const pallet = new THREE.Mesh(
              new THREE.BoxGeometry(item.w - 0.6, 0.5, item.h - 0.5),
              palletMat
            )
            pallet.position.set(0, yPos + 0.35, 0)
            pallet.userData.itemId = item.instanceId
            group.add(pallet)
          }
        }
      } else {
        // Simple box
        const isZone = item.name?.toLowerCase().includes('zone') || 
                       item.name?.toLowerCase().includes('area') ||
                       item.name?.toLowerCase().includes('station')
        const boxHeight = isZone ? 0.3 : itemHeight
        
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(item.w - 0.1, boxHeight, item.h - 0.1),
          new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.9 })
        )
        body.position.y = boxHeight / 2
        // body.castShadow = false // Shadows disabled
        body.userData.itemId = item.instanceId
        group.add(body)
      }

      // Selection highlight (green platform)
      if (isSelected) {
        const highlight = new THREE.Mesh(
          new THREE.BoxGeometry(item.w + 0.4, 0.2, item.h + 0.4),
          new THREE.MeshBasicMaterial({ color: 0x22c55e })
        )
        highlight.position.y = 0.1
        group.add(highlight)
      }

      // Label sprite
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 48
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'rgba(0,0,0,0.8)'
      ctx.roundRect(4, 4, 248, 40, 6)
      ctx.fill()
      ctx.font = 'bold 18px Arial'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      
      // Use appropriate label
      const labelText = isColumn 
        ? (item as { columnSize?: number; columnDepth?: number }).columnDepth
          ? `${(item as { columnSize?: number }).columnSize}"×${(item as { columnDepth?: number }).columnDepth}"`
          : `${(item as { columnSize?: number }).columnSize}"`
        : item.name
      ctx.fillText(labelText, 128, 30)

      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
      )
      sprite.scale.set(isColumn ? 3 : 5, 1.2, 1)
      sprite.position.y = itemHeight + 1.5
      group.add(sprite)

      t.scene!.add(group)
      t.itemGroups.set(item.instanceId, group)
    })
  }, [safeItems, selectedItemId])

  // Update drag preview
  useEffect(() => {
    const t = threeRef.current
    if (t.dragPreview && dragItem) {
      // Use actual item dimensions for preview
      const previewW = dragItem.w || 2
      const previewH = dragItem.h || 2
      // Height based on item type
      const isRack = dragItem.name?.toLowerCase().includes('rack')
      const isZone = dragItem.name?.toLowerCase().includes('zone') || 
                     dragItem.name?.toLowerCase().includes('area') ||
                     dragItem.name?.toLowerCase().includes('station')
      const previewY = isRack ? 8 : (isZone ? 0.5 : 4)
      
      t.dragPreview.scale.set(previewW, previewY, previewH)
      t.dragPreview.position.y = previewY / 2
      
      const color = parseInt(dragItem.color?.replace('#', '0x') || '0x22c55e', 16)
      if (t.dragPreview.material instanceof THREE.MeshStandardMaterial) {
        t.dragPreview.material.color.setHex(color)
      }
    }
  }, [dragItem])

  // Camera presets
  const setCameraPreset = useCallback((preset: 'iso' | 'top' | 'front' | 'side') => {
    const t = threeRef.current
    if (!t.camera || !t.controls) return
    
    const d = bounds.size * 1.2
    
    const positions: Record<string, [number, number, number]> = {
      iso: [bounds.cx + d, d * 0.7, bounds.cy + d],
      top: [bounds.cx, d * 1.5, bounds.cy + 0.01],
      front: [bounds.cx, wallHeight / 2 + 5, bounds.cy + d * 1.3],
      side: [bounds.cx + d * 1.3, wallHeight / 2 + 5, bounds.cy]
    }
    
    const pos = positions[preset]
    t.camera.position.set(pos[0], pos[1], pos[2])
    t.controls.target.set(bounds.cx, 0, bounds.cy)
  }, [bounds, wallHeight])

  return (
    <div ref={containerRef} className="w-full h-full relative bg-slate-900 rounded-lg overflow-hidden">
      {/* Camera Presets */}
      <div className="absolute top-4 left-4 flex gap-2 z-10">
        <button 
          onClick={() => setCameraPreset('iso')} 
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium transition-colors"
        >
          Iso
        </button>
        <button 
          onClick={() => setCameraPreset('top')} 
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition-colors"
        >
          Top
        </button>
        <button 
          onClick={() => setCameraPreset('front')} 
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition-colors"
        >
          Front
        </button>
        <button 
          onClick={() => setCameraPreset('side')} 
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition-colors"
        >
          Side
        </button>
      </div>

      {/* Status */}
      <div className="absolute top-4 right-4 bg-black/70 text-white text-xs px-3 py-2 rounded z-10 font-mono">
        {status} | Items: {safeItems.length}
      </div>

      {/* Help */}
      <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-3 py-2 rounded z-10">
        🖱️ <span className="text-green-400">Click item:</span> Select & Drag • 
        <span className="text-yellow-300"> Drag empty:</span> Rotate • 
        Right: Pan • Scroll: Zoom
      </div>
      
      {/* Catalog drop hint */}
      {dragItem && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-green-600/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-pulse z-10">
          ✋ Click anywhere to drop &quot;{dragItem.name}&quot;
        </div>
      )}
    </div>
  )
}
