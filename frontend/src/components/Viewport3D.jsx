import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import GlassPanel from './GlassPanel'
import styles from './Viewport3D.module.css'

const MODEL_URL = '/models/rb22.glb'

/**
 * Normalizes the loaded GLTF to a known size/origin so a fixed camera and
 * a fixed-radius floor ring always frame it correctly, regardless of the
 * source file's native units/scale/pivot. Every mesh is set to cast a
 * shadow so the spotlight below reads as a real light, not just a highlight.
 */
function RotatingModel() {
  const { scene } = useGLTF(MODEL_URL)
  const groupRef = useRef()

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
    return { scale: 4 / maxDim, offset: center }
  }, [scene])

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.25
  })

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={scene} position={[-offset.x, -offset.y, -offset.z]} />
    </group>
  )
}

/** A dark, mostly-invisible floor that only shows itself where the
 * spotlight and the car's shadow land — keeps the "floating in a black
 * box" background while still making the spotlight legible. */
function SpotlightStage() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]}>
      <mesh receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#050608" roughness={0.95} metalness={0} />
      </mesh>
      <mesh>
        <ringGeometry args={[2.3, 2.34, 96]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[2.55, 2.56, 96]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
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
      {/* Base fill so no part of the car ever renders pure black. */}
      <ambientLight intensity={0.9} />
      {/* Key light, angled from above-front. */}
      <directionalLight position={[5, 8, 5]} intensity={1.8} />
      {/* Fill light from the opposite side — this is what keeps the far
          side of the bodywork and the wheels readable instead of going
          into shadow. */}
      <directionalLight position={[-6, 3, -5]} intensity={0.9} />
      {/* A faint accent only — kept low so it reads as a rim highlight,
          not a colored/neon light source. */}
      <pointLight position={[-5, 2, -4]} intensity={0.25} color="#00e5ff" />
      {/* The overhead spotlight — the dominant, controlled light source.
          decay=0 keeps its brightness predictable regardless of exact
          distance to the car (physically-correct inverse-square falloff
          was crushing this to near-nothing by the time it reached the
          model — that was the actual cause of "almost invisible"). */}
      <spotLight
        position={[0.5, 6.5, 3]}
        angle={0.5}
        penumbra={0.7}
        intensity={6}
        decay={0}
        color="#f4f8ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Suspense fallback={null}>
        <RotatingModel />
      </Suspense>
      <SpotlightStage />
    </>
  )
}

/** Component 6 — Interactive 3D Viewport (right column, bottom). */
export default function Viewport3D() {
  return (
    <GlassPanel className={styles.wrap}>
      <div className={styles.canvasWrap}>
        <Canvas shadows camera={{ position: [5, 2.4, 6], fov: 38 }} dpr={[1, 1.5]}>
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
