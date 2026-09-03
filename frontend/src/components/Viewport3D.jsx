import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import GlassPanel from './GlassPanel'
import styles from './Viewport3D.module.css'

const MODEL_URL = '/models/vf26.glb'

// Shared ground height for the car and the road — same reasoning as
// before, just no longer paired with a circular stage.
const FLOOR_Y = -1.1

// Fixed heading — the car must face -Z (away from camera, down the road).
// Verified, not guessed: the GLB's own front-wheel nodes (WHEEL_LF/RF,
// see WHEEL_NODE_NAMES below) sit at native Z=+1.1, rear wheels at
// Z=-1.49 — so the model's native front faces +Z. Rotating by π points
// that front at world -Z, which is this scene's direction of travel.
const MODEL_ROTATION_Y = Math.PI

// Exact node names from the GLB's own hierarchy (Sketchfab export),
// confirmed by inspecting the loaded scene rather than assumed — each
// one is a direct child holding that corner's tyre+rim as one rigid
// group, separate from the suspension/caliper nodes, so rotating it
// spins only the wheel, nothing else. All four share the same local
// rotation axis (checked individually): local X is the axle.
const WHEEL_NODE_NAMES = {
  frontLeft: 'WHEEL_LF_60_86',
  frontRight: 'WHEEL_RF_45_60',
  rearLeft: 'WHEEL_LR_117_171',
  rearRight: 'WHEEL_RR_96_136',
}
const ROAD_WIDTH = 9
const ROAD_LENGTH = 56
// How far the road's center sits in front of the car (world -Z), so most
// of the plane extends into the distance rather than being split evenly
// front/back — that asymmetry is what sells "the road stretches ahead."
const ROAD_FORWARD_BIAS = 20
// Texture-space units per second — how fast the lane markings scroll.
const ROAD_SCROLL_SPEED = 0.45
// Radians/second, deliberately expressed as a multiple of the road's
// own scroll speed so the two can never drift out of sync with each
// other — "wheel speed corresponds to vehicle movement" by construction,
// not by two independently-tuned constants. Sign derived analytically,
// not eyeballed: WHEEL_LF_60_86's matrixWorld maps local+Y to world+Z
// (native front) and local+Z to world-Y (down), so a point at the
// wheel's top (local -Z) gains +Y under a POSITIVE local-X rotation,
// i.e. moves toward local+Y = world+Z = front — the top of the wheel
// advancing toward the nose is exactly correct forward-rolling motion.
const WHEEL_SPIN_SPEED = ROAD_SCROLL_SPEED * 16

/**
 * Builds a small tileable asphalt + lane-marking tile on an offscreen
 * canvas and wraps it as a THREE.CanvasTexture. Procedural on purpose —
 * no external image asset to fetch/license, and it keeps the look fully
 * controllable (dark, restrained, no neon) rather than depending on
 * whatever a stock texture happens to look like.
 */
function createRoadTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#1b1d21'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Subtle grain so the surface doesn't read as a flat color fill.
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    const v = 22 + Math.random() * 18
    ctx.fillStyle = `rgba(${v}, ${v}, ${v + 2}, ${0.12 + Math.random() * 0.18})`
    ctx.fillRect(x, y, 1.4, 1.4)
  }

  // Red/white curb blocks along both edges — real F1 kerb convention,
  // restrained (muted, not saturated) so they read at a glance without
  // turning the road into a decoration.
  const kerbW = 12
  const kerbBlock = 34
  ;[0, canvas.width - kerbW].forEach((kx) => {
    for (let y = 0, i = 0; y < canvas.height; y += kerbBlock, i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(178, 42, 46, 0.85)' : 'rgba(214, 214, 218, 0.85)'
      ctx.fillRect(kx, y, kerbW, kerbBlock)
    }
  })

  // Muted lane edge lines, just inside the kerbs.
  ctx.fillStyle = 'rgba(190, 195, 205, 0.28)'
  ctx.fillRect(kerbW + 6, 0, 3, canvas.height)
  ctx.fillRect(canvas.width - kerbW - 9, 0, 3, canvas.height)

  // Center dashed line.
  ctx.fillStyle = 'rgba(225, 228, 234, 0.8)'
  const dashH = 78
  const gapH = 64
  const dashW = 9
  const cx = canvas.width / 2 - dashW / 2
  for (let y = -gapH; y < canvas.height; y += dashH + gapH) {
    ctx.fillRect(cx, y, dashW, dashH)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 24)
  return texture
}

function createGlowSprite() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

// Fixed, hand-placed positions rather than random-per-render, so the
// scene doesn't reshuffle on every hot reload — warm and cool points
// mixed like distant trackside/stand lighting, not a neon wall.
const DISTANT_LIGHTS = [
  { pos: [-5.5, 1.8, -22], color: '#ffb37a', scale: 1.1 },
  { pos: [5.8, 2.4, -28], color: '#9fd8ff', scale: 1.3 },
  { pos: [-6.2, 1.4, -34], color: '#ffd79a', scale: 0.9 },
  { pos: [6.4, 2.0, -18], color: '#ffb37a', scale: 0.8 },
  { pos: [-4.8, 3.0, -40], color: '#9fd8ff', scale: 1.0 },
]

/** Faint points of light far down the road — suggests a night race
 * environment (trackside/stand lighting) without turning the track
 * itself into a neon fixture. Kept deliberately dim/small. */
function DistantLights() {
  const texture = useMemo(() => createGlowSprite(), [])
  return (
    <>
      {DISTANT_LIGHTS.map((l, i) => (
        <sprite key={i} position={l.pos} scale={[l.scale, l.scale, 1]}>
          <spriteMaterial
            map={texture}
            color={l.color}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </sprite>
      ))}
    </>
  )
}

/** The scrolling road surface — this, not a circular platform, is what
 * now sells "the car is racing," per the explicit redesign direction:
 * the car stays put, the road moves under it. */
function RoadSurface() {
  const texture = useMemo(() => createRoadTexture(), [])

  useFrame((_, delta) => {
    texture.offset.y += delta * ROAD_SCROLL_SPEED
  })

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, FLOOR_Y, -ROAD_FORWARD_BIAS]}
      receiveShadow
    >
      <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH]} />
      <meshStandardMaterial map={texture} roughness={0.96} metalness={0.04} />
    </mesh>
  )
}

/**
 * Normalizes the loaded GLTF to a known size/origin so a fixed camera
 * always frames it correctly, regardless of the source file's native
 * units/scale/pivot — unchanged from the turntable version. What's gone
 * is the continuous Y-rotation: this car holds a fixed heading and only
 * gets a tiny vertical bob, so it reads as driving in place rather than
 * spinning on display.
 */
function RoadCar() {
  const { scene } = useGLTF(MODEL_URL)
  const groupRef = useRef()
  const wheelsRef = useRef([])

  const { scale, offset } = useMemo(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = false
      }
    })
    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    return { scale: 4 / maxDim, offset: new THREE.Vector3(-center.x, -box.min.y, -center.z) }
  }, [scene])

  // Resolve the four wheel nodes once per model load, by the exact names
  // confirmed from the GLB's own hierarchy (see WHEEL_NODE_NAMES above) —
  // not a guess-and-hope, and not touching anything else in the model
  // (suspension/calipers are separate sibling nodes, left alone).
  useEffect(() => {
    wheelsRef.current = Object.values(WHEEL_NODE_NAMES)
      .map((name) => scene.getObjectByName(name))
      .filter(Boolean)
  }, [scene])

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      groupRef.current.position.y = FLOOR_Y + Math.sin(clock.elapsedTime * 1.6) * 0.02
    }
    const spin = delta * WHEEL_SPIN_SPEED
    for (const wheel of wheelsRef.current) {
      wheel.rotation.x += spin
    }
  })

  return (
    <group ref={groupRef} scale={scale} position={[0, FLOOR_Y, 0]}>
      <primitive
        object={scene}
        position={[offset.x, offset.y, offset.z]}
        rotation={[0, MODEL_ROTATION_Y, 0]}
      />
    </group>
  )
}

/** Explicit look-at target, aimed slightly down the road rather than
 * dead-center on the car — this is most of what closes the "huge empty
 * space above the car" gap, versus relying on the default origin-facing
 * camera the turntable version used. */
function CameraRig() {
  const { camera } = useThree()
  useEffect(() => {
    camera.lookAt(0, -0.35, -4)
  }, [camera])
  return null
}

function LoadingOverlay() {
  const { progress } = useProgress()
  return (
    <div className={styles.loadingOverlay}>
      <span className="num">LOADING MODEL &middot; {Math.round(progress)}%</span>
    </div>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 8, 4]} intensity={1.6} />
      <directionalLight position={[-6, 3, -2]} intensity={0.7} />
      {/* Faint accent only, matching the project's "restrained cyan"
          rule — not a colored light source doing real illumination. */}
      <pointLight position={[-4, 2, 2]} intensity={0.15} color="#00e5ff" />
      <spotLight
        position={[1, 6.5, 4]}
        angle={0.55}
        penumbra={0.7}
        intensity={5.5}
        decay={0}
        color="#f4f8ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Suspense fallback={null}>
        <RoadCar />
      </Suspense>
      <RoadSurface />
      <DistantLights />
      {/* Lets the road's far edge fade into the background instead of
          showing a hard cutoff — this is most of what makes the plane
          read as "extends into the distance" rather than "a rectangle." */}
      <fog attach="fog" args={['#05070a', 14, 38]} />
    </>
  )
}

/** Component 6 — central hero 3D viewport (main row, center column). */
export default function Viewport3D() {
  return (
    <GlassPanel className={styles.wrap}>
      <div className={styles.canvasWrap}>
        <Canvas shadows camera={{ position: [2.0, 2.6, 8.5], fov: 38 }} dpr={[1, 1.5]}>
          <CameraRig />
          <Scene />
        </Canvas>
        <Suspense fallback={<LoadingOverlay />}>
          <LoadingProbe />
        </Suspense>
      </div>
    </GlassPanel>
  )
}

// Renders nothing — its only job is to keep the outer Suspense boundary
// "loading" (so LoadingOverlay shows) until the GLTF resolves.
function LoadingProbe() {
  useGLTF(MODEL_URL)
  return null
}

useGLTF.preload(MODEL_URL)
