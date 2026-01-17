'use client'

import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

interface Vertex { 
  x: number
  y: number 
}

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
}

type CameraPreset = 'iso' | 'top' | 'front' | 'side'

// Create text label sprite
function createTextLabel(text: string, fontSize: number = 20): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  
  canvas.width = 256
  canvas.height = 64
  
  // Background
  context.fillStyle = 'rgba(0, 0, 0, 0.75)'
  context.beginPath()
  context.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 8)
  context.fill()
  
  // Text
  context.font = `bold ${fontSize}px Arial, sans-serif`
  context.fillStyle = 'white'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  
  // Truncate text if too long
  let displayText = text
  const maxWidth = canvas.width - 20
  while (context.measureText(displayText).width > maxWidth && displayText.length > 3) {
    displayText = displayText.slice(0, -4) + '...'
  }
  
  context.fillText(displayText, canvas.width / 2, canvas.height / 2)
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  
  const material = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(6, 1.5, 1)
  
  return sprite
}

export default function FloorPlan3DSimple({ vertices, items, wallOpenings = [], wallHeight = 20 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const animationRef = useRef<number>(0)
  const boundsRef = useRef<{ center: { x: number; y: number }; size: number }>({ center: { x: 20, y: 15 }, size: 50 })

  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso')

  // Safe vertices
  const safeVertices = useMemo(() => {
    if (!vertices || vertices.length < 3) {
      return [
        { x: 2, y: 2 },
        { x: 42, y: 2 },
        { x: 42, y: 27 },
        { x: 2, y: 27 }
      ]
    }
    return vertices
  }, [vertices])

  // Safe items
  const safeItems = useMemo(() => {
    if (!items || !Array.isArray(items)) return []
    return items.filter(item => 
      item && 
      typeof item.x === 'number' && 
      typeof item.y === 'number' &&
      typeof item.w === 'number' &&
      typeof item.h === 'number'
    )
  }, [items])

  // Calculate bounds
  const bounds = useMemo(() => {
    const xs = safeVertices.map(v => v.x)
    const ys = safeVertices.map(v => v.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const result = {
      center: {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2
      },
      size: Math.max(maxX - minX, maxY - minY)
    }
    boundsRef.current = result
    return result
  }, [safeVertices])

  // Camera preset function
  const applyCameraPreset = useCallback((preset: CameraPreset) => {
    if (!cameraRef.current || !controlsRef.current) return
    
    const camera = cameraRef.current
    const controls = controlsRef.current
    const { center, size } = boundsRef.current
    const dist = size * 1.2

    const presets: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number] }> = {
      iso: {
        position: [center.x + dist * 0.8, dist * 0.6, center.y + dist * 0.8],
        target: [center.x, wallHeight / 4, center.y]
      },
      top: {
        position: [center.x, dist * 1.5, center.y + 0.01],
        target: [center.x, 0, center.y]
      },
      front: {
        position: [center.x, wallHeight / 2 + 5, center.y + dist * 1.5],
        target: [center.x, wallHeight / 4, center.y]
      },
      side: {
        position: [center.x + dist * 1.5, wallHeight / 2 + 5, center.y],
        target: [center.x, wallHeight / 4, center.y]
      }
    }

    const p = presets[preset]
    camera.position.set(...p.position)
    controls.target.set(...p.target)
    controls.update()
  }, [wallHeight])

  // Apply camera preset when changed
  useEffect(() => {
    applyCameraPreset(cameraPreset)
  }, [cameraPreset, applyCameraPreset])

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f172a)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    const dist = bounds.size * 1.5
    camera.position.set(bounds.center.x + dist * 0.8, dist * 0.6, bounds.center.y + dist * 0.8)
    camera.lookAt(bounds.center.x, wallHeight / 4, bounds.center.y)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(bounds.center.x, wallHeight / 4, bounds.center.y)
    controls.maxPolarAngle = Math.PI / 2.1
    controls.minDistance = 10
    controls.maxDistance = 200
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.update()
    controlsRef.current = controls

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x1e3a5f, 0.3)
    scene.add(hemisphereLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(bounds.center.x + 30, 50, bounds.center.y + 30)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 1024
    directionalLight.shadow.mapSize.height = 1024
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 200
    scene.add(directionalLight)

    const pointLight = new THREE.PointLight(0xfef3c7, 0.3, 100)
    pointLight.position.set(bounds.center.x, wallHeight - 2, bounds.center.y)
    scene.add(pointLight)

    // Grid
    const gridHelper = new THREE.GridHelper(100, 100, 0x1e293b, 0x1e293b)
    gridHelper.position.set(50, -0.01, 50)
    scene.add(gridHelper)

    // Floor
    const floorShape = new THREE.Shape()
    floorShape.moveTo(safeVertices[0].x, safeVertices[0].y)
    for (let i = 1; i < safeVertices.length; i++) {
      floorShape.lineTo(safeVertices[i].x, safeVertices[i].y)
    }
    floorShape.closePath()

    const floorGeometry = new THREE.ShapeGeometry(floorShape)
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1e3a5f, 
      side: THREE.DoubleSide 
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Walls
    for (let i = 0; i < safeVertices.length; i++) {
      const v1 = safeVertices[i]
      const v2 = safeVertices[(i + 1) % safeVertices.length]
      
      const length = Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2)
      const midX = (v1.x + v2.x) / 2
      const midZ = (v1.y + v2.y) / 2
      const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x)

      const wallGeometry = new THREE.BoxGeometry(length, wallHeight, 0.5)
      const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x475569, 
        transparent: true, 
        opacity: 0.7 
      })
      const wall = new THREE.Mesh(wallGeometry, wallMaterial)
      wall.position.set(midX, wallHeight / 2, midZ)
      wall.rotation.y = -angle
      wall.castShadow = true
      scene.add(wall)
    }

    // Wall Openings (doors/windows)
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
        dock: 0x3b82f6,
        personnel: 0x6b7280,
        emergency: 0x22c55e,
        rollup: 0xf59e0b,
        window: 0x06b6d4,
      }

      const doorGeometry = new THREE.BoxGeometry(opening.width, doorHeight, 0.8)
      const doorMaterial = new THREE.MeshStandardMaterial({ 
        color: colors[opening.type] || 0xffffff,
        transparent: isWindow,
        opacity: isWindow ? 0.4 : 1
      })
      const door = new THREE.Mesh(doorGeometry, doorMaterial)
      door.position.set(x, yPos, z)
      door.rotation.y = -angle
      scene.add(door)
    })

    // Equipment Items
    safeItems.forEach(item => {
      const isRack = item.name?.toLowerCase().includes('rack')
      const color = new THREE.Color(item.color || '#f97316')

      if (isRack) {
        // Detailed rack with posts and shelves
        const group = new THREE.Group()
        group.position.set(item.x + item.w / 2, 0, item.y + item.h / 2)

        const levels = 4
        const levelHeight = 4
        const totalHeight = levels * levelHeight

        // Posts
        const postGeometry = new THREE.BoxGeometry(0.25, totalHeight, 0.25)
        const postMaterial = new THREE.MeshStandardMaterial({ color })
        
        const postPositions = [
          [-item.w/2 + 0.15, -item.h/2 + 0.15],
          [item.w/2 - 0.15, -item.h/2 + 0.15],
          [-item.w/2 + 0.15, item.h/2 - 0.15],
          [item.w/2 - 0.15, item.h/2 - 0.15],
        ]
        
        postPositions.forEach(([px, pz]) => {
          const post = new THREE.Mesh(postGeometry, postMaterial)
          post.position.set(px, totalHeight / 2, pz)
          post.castShadow = true
          group.add(post)
        })

        // Shelves and pallets
        const beamMaterial = new THREE.MeshStandardMaterial({ color })
        const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x64748b })
        const palletMaterial = new THREE.MeshStandardMaterial({ color: 0x92400e })
        
        for (let level = 0; level < levels; level++) {
          const yPos = (level + 1) * levelHeight

          // Beams
          const beamGeometry = new THREE.BoxGeometry(item.w - 0.3, 0.15, 0.1)
          const beamFront = new THREE.Mesh(beamGeometry, beamMaterial)
          beamFront.position.set(0, yPos, -item.h/2 + 0.15)
          beamFront.castShadow = true
          group.add(beamFront)

          const beamBack = new THREE.Mesh(beamGeometry, beamMaterial)
          beamBack.position.set(0, yPos, item.h/2 - 0.15)
          beamBack.castShadow = true
          group.add(beamBack)

          // Shelf deck
          const shelfGeometry = new THREE.BoxGeometry(item.w - 0.4, 0.08, item.h - 0.4)
          const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial)
          shelf.position.set(0, yPos + 0.1, 0)
          shelf.receiveShadow = true
          group.add(shelf)

          // Pallet on shelf (except top level)
          if (level < levels - 1) {
            const palletGeometry = new THREE.BoxGeometry(item.w - 0.6, 0.5, item.h - 0.5)
            const pallet = new THREE.Mesh(palletGeometry, palletMaterial)
            pallet.position.set(0, yPos + 0.4, 0)
            group.add(pallet)
          }
        }

        scene.add(group)

        // Add label above rack
        const label = createTextLabel(item.name)
        label.position.set(item.x + item.w / 2, totalHeight + 2, item.y + item.h / 2)
        scene.add(label)
      } else {
        // Simple box for non-rack items
        const itemHeight = item.name?.toLowerCase().includes('zone') || 
                          item.name?.toLowerCase().includes('area') ||
                          item.name?.toLowerCase().includes('station') ? 0.3 : 4
        
        const boxGeometry = new THREE.BoxGeometry(item.w, itemHeight, item.h)
        const boxMaterial = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.9 })
        const box = new THREE.Mesh(boxGeometry, boxMaterial)
        box.position.set(
          item.x + item.w / 2,
          itemHeight / 2,
          item.y + item.h / 2
        )
        box.castShadow = true
        box.receiveShadow = true
        scene.add(box)

        // Add label above item
        const label = createTextLabel(item.name)
        label.position.set(item.x + item.w / 2, itemHeight + 1.5, item.y + item.h / 2)
        scene.add(label)
      }
    })

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationRef.current)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [safeVertices, safeItems, wallOpenings, wallHeight, bounds])

  return (
    <div ref={containerRef} className="w-full h-full relative bg-slate-900 rounded-lg overflow-hidden">
      {/* Camera Preset Buttons */}
      <div className="absolute top-4 left-4 flex gap-2 z-10">
        {(['iso', 'top', 'front', 'side'] as CameraPreset[]).map((preset) => (
          <button
            key={preset}
            onClick={() => setCameraPreset(preset)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              cameraPreset === preset 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {preset === 'iso' ? 'Iso' : preset.charAt(0).toUpperCase() + preset.slice(1)}
          </button>
        ))}
      </div>

      {/* Info overlay */}
      <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-3 py-2 rounded">
        🖱️ Left: Rotate • Right: Pan • Scroll: Zoom | Items: {safeItems.length} • Walls: {safeVertices.length}
      </div>
    </div>
  )
}
