'use client'

import { useMemo, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'

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
  rotation?: number
  color: string
  pallets?: number
}

interface WallOpening {
  id: number
  wallIndex: number
  type: string
  position: number
  width: number
  height: number
}

interface FloorPlan3DProps {
  vertices: Vertex[]
  items: PlacedItem[]
  wallOpenings?: WallOpening[]
  wallHeight?: number
}

// Floor component
function Floor({ vertices }: { vertices: Vertex[] }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      s.lineTo(vertices[i].x, vertices[i].y)
    }
    s.closePath()
    return s
  }, [vertices])

  const geometry = useMemo(() => {
    return new THREE.ShapeGeometry(shape)
  }, [shape])

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial color="#1e3a5f" side={THREE.DoubleSide} />
    </mesh>
  )
}

// Walls component
function Walls({ vertices, height }: { vertices: Vertex[]; height: number }) {
  return (
    <group>
      {vertices.map((v1, i) => {
        const v2 = vertices[(i + 1) % vertices.length]
        const length = Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2)
        const midX = (v1.x + v2.x) / 2
        const midZ = (v1.y + v2.y) / 2
        const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x)

        return (
          <mesh
            key={`wall-${i}`}
            position={[midX, height / 2, midZ]}
            rotation={[0, -angle, 0]}
            castShadow
          >
            <boxGeometry args={[length, height, 0.5]} />
            <meshStandardMaterial 
              color="#475569" 
              transparent 
              opacity={0.7}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// Single Rack component
function Rack({ item }: { item: PlacedItem }) {
  const levels = 4
  const levelHeight = 4
  const totalHeight = levels * levelHeight
  const { w, h, x, y, color } = item

  return (
    <group position={[x + w / 2, 0, y + h / 2]}>
      {/* 4 vertical posts */}
      {[
        [-w/2 + 0.15, -h/2 + 0.15],
        [w/2 - 0.15, -h/2 + 0.15],
        [-w/2 + 0.15, h/2 - 0.15],
        [w/2 - 0.15, h/2 - 0.15],
      ].map(([px, pz], i) => (
        <mesh key={`post-${i}`} position={[px, totalHeight / 2, pz]} castShadow>
          <boxGeometry args={[0.25, totalHeight, 0.25]} />
          <meshStandardMaterial color={color || '#f97316'} />
        </mesh>
      ))}

      {/* Shelves at each level */}
      {Array.from({ length: levels }).map((_, level) => {
        const yPos = (level + 1) * levelHeight
        return (
          <group key={`level-${level}`} position={[0, yPos, 0]}>
            {/* Horizontal beams */}
            <mesh position={[0, 0, -h/2 + 0.15]} castShadow>
              <boxGeometry args={[w - 0.3, 0.15, 0.1]} />
              <meshStandardMaterial color={color || '#f97316'} />
            </mesh>
            <mesh position={[0, 0, h/2 - 0.15]} castShadow>
              <boxGeometry args={[w - 0.3, 0.15, 0.1]} />
              <meshStandardMaterial color={color || '#f97316'} />
            </mesh>
            {/* Shelf deck */}
            <mesh position={[0, 0.1, 0]} receiveShadow>
              <boxGeometry args={[w - 0.4, 0.08, h - 0.4]} />
              <meshStandardMaterial color="#64748b" />
            </mesh>
            {/* Pallet/boxes on shelf (except top) */}
            {level < levels - 1 && (
              <mesh position={[0, 0.4, 0]}>
                <boxGeometry args={[w - 0.6, 0.5, h - 0.5]} />
                <meshStandardMaterial color="#92400e" />
              </mesh>
            )}
          </group>
        )
      })}

      {/* Label */}
      <Text
        position={[0, totalHeight + 1.5, 0]}
        fontSize={1}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {item.name}
      </Text>
    </group>
  )
}

// Simple box for non-rack items
function SimpleItem({ item }: { item: PlacedItem }) {
  const height = 4
  
  return (
    <group position={[item.x + item.w / 2, height / 2, item.y + item.h / 2]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[item.w, height, item.h]} />
        <meshStandardMaterial color={item.color || '#6b7280'} />
      </mesh>
      <Text
        position={[0, height / 2 + 1, 0]}
        fontSize={0.8}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {item.name}
      </Text>
    </group>
  )
}

// Door on wall
function DoorOpening({ opening, vertices, wallHeight }: { 
  opening: WallOpening
  vertices: Vertex[]
  wallHeight: number
}) {
  const v1 = vertices[opening.wallIndex]
  const v2 = vertices[(opening.wallIndex + 1) % vertices.length]
  
  if (!v1 || !v2) return null
  
  const x = v1.x + (v2.x - v1.x) * opening.position
  const z = v1.y + (v2.y - v1.y) * opening.position
  const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x)
  
  const isWindow = opening.type === 'window'
  const doorHeight = opening.height || (isWindow ? 4 : 8)
  const yPos = isWindow ? wallHeight * 0.5 : doorHeight / 2

  const colors: Record<string, string> = {
    dock: '#3b82f6',
    personnel: '#6b7280',
    emergency: '#22c55e',
    rollup: '#f59e0b',
    window: '#06b6d4',
  }

  return (
    <group position={[x, yPos, z]} rotation={[0, -angle, 0]}>
      <mesh>
        <boxGeometry args={[opening.width, doorHeight, 0.8]} />
        <meshStandardMaterial 
          color={colors[opening.type] || '#ffffff'}
          transparent={isWindow}
          opacity={isWindow ? 0.4 : 1}
        />
      </mesh>
    </group>
  )
}

// Grid floor helper
function GridFloor() {
  return (
    <gridHelper 
      args={[100, 100, '#1e293b', '#1e293b']} 
      position={[50, -0.05, 50]}
    />
  )
}

// Camera controller to set initial position
function CameraSetup({ center, distance, wallHeight }: { center: { x: number; y: number }; distance: number; wallHeight: number }) {
  const { camera } = useThree()
  
  useEffect(() => {
    camera.position.set(
      center.x + distance * 0.8,
      distance * 0.6,
      center.y + distance * 0.8
    )
    camera.lookAt(center.x, wallHeight / 4, center.y)
  }, [camera, center, distance, wallHeight])

  return null
}

// Main scene content
function Scene({ vertices, items, wallOpenings, wallHeight }: FloorPlan3DProps & { wallHeight: number }) {
  // Calculate center and camera distance
  const { center, distance } = useMemo(() => {
    const xs = vertices.map(v => v.x)
    const ys = vertices.map(v => v.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    
    return {
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      distance: Math.max(maxX - minX, maxY - minY) * 1.2
    }
  }, [vertices])

  return (
    <>
      <CameraSetup center={center} distance={distance} wallHeight={wallHeight} />
      
      <OrbitControls
        target={[center.x, wallHeight / 4, center.y]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={10}
        maxDistance={200}
        enableDamping
        dampingFactor={0.05}
      />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#87ceeb', '#1e3a5f', 0.3]} />
      <directionalLight
        position={[center.x + 30, 50, center.y + 30]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[center.x, wallHeight - 2, center.y]} intensity={0.3} />

      {/* Grid */}
      <GridFloor />

      {/* Warehouse floor */}
      <Floor vertices={vertices} />

      {/* Walls */}
      <Walls vertices={vertices} height={wallHeight} />

      {/* Equipment items */}
      {items.map((item) => {
        const isRack = item.name?.toLowerCase().includes('rack')
        return isRack ? (
          <Rack key={item.instanceId} item={item} />
        ) : (
          <SimpleItem key={item.instanceId} item={item} />
        )
      })}

      {/* Door/window openings */}
      {wallOpenings?.map((opening) => (
        <DoorOpening
          key={opening.id}
          opening={opening}
          vertices={vertices}
          wallHeight={wallHeight}
        />
      ))}
    </>
  )
}

// Main exported component
export default function FloorPlan3D({ 
  vertices, 
  items, 
  wallOpenings = [], 
  wallHeight = 20 
}: FloorPlan3DProps) {
  
  // Validate data
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

  const safeOpenings = useMemo(() => {
    if (!wallOpenings || !Array.isArray(wallOpenings)) return []
    return wallOpenings.filter(o => 
      o && 
      typeof o.wallIndex === 'number' &&
      typeof o.position === 'number'
    )
  }, [wallOpenings])

  // Debug log
  useEffect(() => {
    console.log('FloorPlan3D rendering:', {
      vertices: safeVertices.length,
      items: safeItems.length,
      openings: safeOpenings.length,
      wallHeight
    })
  }, [safeVertices, safeItems, safeOpenings, wallHeight])

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ fov: 50, near: 0.1, far: 1000 }}
        style={{ background: '#0f172a' }}
      >
        <Scene
          vertices={safeVertices}
          items={safeItems}
          wallOpenings={safeOpenings}
          wallHeight={wallHeight}
        />
      </Canvas>

      {/* Info overlay */}
      <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-3 py-2 rounded">
        🖱️ Left: Rotate • Right: Pan • Scroll: Zoom | 
        Items: {safeItems.length} • Walls: {safeVertices.length}
      </div>
    </div>
  )
}
