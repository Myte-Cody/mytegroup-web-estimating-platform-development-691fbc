'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Line, PointMaterial, Points } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import * as THREE from 'three'

type Theme = 'light' | 'dark'

type PortalSphereInnerProps = {
  pointCount?: number
  theme: Theme
  reduceMotion?: boolean
  radius?: number
}

type DynConnection = {
  a: THREE.Vector3
  b: THREE.Vector3
}

function generateSpherePoints(count: number, radius = 1) {
  const points: number[] = []
  const phi = Math.PI * (3 - Math.sqrt(5)) // golden angle
  for (let i = 0; i < count; i++) {
    const y = radius - (i / (count - 1)) * 2 * radius
    const r = Math.sqrt(radius * radius - y * y)
    const theta = phi * i
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    points.push(x, y, z)
  }
  return new Float32Array(points)
}

function useConnections(positions: Float32Array, maxPerPoint = 3, threshold = 0.5) {
  return useMemo(() => {
    const lines: [THREE.Vector3, THREE.Vector3][] = []
    const count = positions.length / 3
    const vecs: THREE.Vector3[] = []
    for (let i = 0; i < count; i++) {
      vecs.push(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]))
    }
    for (let i = 0; i < count; i++) {
      const origin = vecs[i]
      const neighbors: { idx: number; dist: number }[] = []
      for (let j = 0; j < count; j++) {
        if (i === j) continue
        const dist = origin.distanceTo(vecs[j])
        if (dist < threshold) {
          neighbors.push({ idx: j, dist })
        }
      }
      neighbors
        .sort((a, b) => a.dist - b.dist)
        .slice(0, maxPerPoint)
        .forEach((n) => lines.push([origin, vecs[n.idx]]))
    }
    return lines
  }, [positions, maxPerPoint, threshold])
}

function buildDynamicPool(vecs: THREE.Vector3[], poolSize: number) {
  const pool: DynConnection[] = []
  const count = vecs.length
  for (let i = 0; i < poolSize; i++) {
    const a = Math.floor(Math.random() * count)
    let b = Math.floor(Math.random() * count)
    if (b === a) b = (b + 1) % count
    pool.push({ a: vecs[a], b: vecs[b] })
  }
  return pool
}

function PortalSphereInner({ pointCount = 320, theme, reduceMotion = false, radius = 1 }: PortalSphereInnerProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const matRef = useRef<THREE.PointsMaterial | null>(null)
  const groupRef = useRef<THREE.Group>(null)

  const [energy, setEnergy] = useState(0)
  const energyRef = useRef(0)

  const [dynamicConnections, setDynamicConnections] = useState<DynConnection[]>([])
  const dynTimer = useRef(0)

  const positions = useMemo(() => generateSpherePoints(pointCount, radius), [pointCount, radius])
  const connections = useConnections(positions, 4, 0.5)

  const dynamicPool = useMemo(() => {
    const vecs: THREE.Vector3[] = []
    const count = positions.length / 3
    for (let i = 0; i < count; i++) {
      vecs.push(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]))
    }
    return buildDynamicPool(vecs, Math.min(180, Math.floor(pointCount * 0.6)))
  }, [pointCount, positions])

  const basePointColor =
    theme === 'light' ? new THREE.Color('#2563eb') : new THREE.Color('#9ec5ff')
  const hotPointColor =
    theme === 'light' ? new THREE.Color('#60a5fa') : new THREE.Color('#e5f2ff')
  const haloColor =
    theme === 'light' ? new THREE.Color('#dbeafe') : new THREE.Color('#e0f2ff')
  const lineColor = theme === 'light' ? '#1d4ed8' : '#64748b'
  const dynamicLineColor = theme === 'light' ? '#3b82f6' : '#93c5fd'

  useFrame((state) => {
    const { clock, viewport } = state
    const t = clock.getElapsedTime()
    const pulse = reduceMotion ? 1 : 1 + Math.sin(t * 1.2) * 0.05
    const targetEnergy = reduceMotion ? 0 : energy
    energyRef.current = THREE.MathUtils.lerp(energyRef.current, targetEnergy, 0.08)

    if (groupRef.current) {
      const base = Math.min(viewport.width, viewport.height)
      const sizeFactor = (base / 6) * pulse
      groupRef.current.scale.setScalar(sizeFactor * 1.12)
      if (!reduceMotion) {
        groupRef.current.rotation.y = t * 0.12
        groupRef.current.rotation.x = t * 0.04
      } else {
        groupRef.current.rotation.set(0, 0, 0)
      }
    }

    if (matRef.current) {
      const color = basePointColor.clone().lerp(hotPointColor, energyRef.current)
      matRef.current.color.copy(color)
      matRef.current.size = reduceMotion ? 0.032 : 0.032 + 0.03 * energyRef.current
    }

    if (!reduceMotion) {
      dynTimer.current += state.clock.getDelta()
      if (dynTimer.current > 0.8) {
        dynTimer.current = 0
        const subsetSize = Math.max(18, Math.floor(dynamicPool.length * 0.2))
        const shuffled = [...dynamicPool].sort(() => Math.random() - 0.5).slice(0, subsetSize)
        setDynamicConnections(shuffled)
      }
    }
  })

  return (
    <group
      ref={groupRef}
      onPointerMove={(e) => {
        const d = Math.sqrt(e.pointer.x * e.pointer.x + e.pointer.y * e.pointer.y)
        const target = THREE.MathUtils.clamp(1 - d, 0, 1)
        setEnergy(target)
      }}
      onPointerLeave={() => setEnergy(0)}
    >
      <Points positions={positions} stride={3} ref={pointsRef} frustumCulled>
        <PointMaterial
          ref={matRef}
          transparent
          color={basePointColor}
          size={0.06}
          sizeAttenuation
          depthWrite={false}
          opacity={0.4}
          toneMapped={false}
        />
      </Points>
      {connections.map(([a, b], idx) => (
        <Line
          key={`stable-${idx}`}
          points={[a, b]}
          color={lineColor}
          lineWidth={1.6}
          transparent
          opacity={1}
          toneMapped={false}
        />
      ))}
      {dynamicConnections.map((conn, idx) => (
        <Line
          key={`dyn-${idx}`}
          points={[conn.a, conn.b]}
          color={dynamicLineColor}
          lineWidth={1.9}
          transparent
          opacity={1}
          toneMapped={false}
        />
      ))}
    </group>
  )
}

function resolveTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  const attr = (document.documentElement.dataset.theme as Theme) || undefined
  if (attr === 'light' || attr === 'dark') return attr
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
}

type PortalSphereProps = {
  className?: string
  reduceMotion?: boolean
  radius?: number
}

export default function PortalSphere({ className, reduceMotion = false, radius = 1 }: PortalSphereProps = {}) {
  if (reduceMotion) {
    return null
  }

  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(resolveTheme())
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as Theme | undefined
      if (detail === 'light' || detail === 'dark') {
        setTheme(detail)
      } else {
        setTheme(resolveTheme())
      }
    }
    window.addEventListener('myte-theme-change', handler)
    return () => window.removeEventListener('myte-theme-change', handler)
  }, [])

  const blendClass = theme === 'light' ? 'portal-layer-light' : 'portal-layer-dark'

  return (
    <div className={clsx('portal-sphere', blendClass, className)} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 2.4], fov: 42 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor('#000000', 0)}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={theme === 'light' ? 1.4 : 1.05} color={theme === 'light' ? '#d8e9ff' : undefined} />
        <directionalLight
          position={[2, 2, 3]}
          intensity={theme === 'light' ? 1.32 : 0.82}
          color={theme === 'light' ? '#b2d4ff' : '#9bb8ff'}
        />
        <PortalSphereInner theme={theme} reduceMotion={reduceMotion} pointCount={reduceMotion ? 200 : 320} radius={radius} />
      </Canvas>
    </div>
  )
}
