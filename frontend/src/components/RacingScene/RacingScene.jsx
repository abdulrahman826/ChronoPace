import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import Car from './Car'
import Overlay from './Overlay'
import { FLOOR_Y } from './sceneConfig'
import styles from './RacingScene.module.css'

// Product-shot camera: centred, slightly elevated three-quarter view, far
// enough back to leave real negative space around a car that's now the
// stationary subject rather than something travelling past the lens.
const CAMERA_POSITION = [3.6, 1.85, 5.6]
const CAMERA_LOOKAT = [0, 0.55, 0]
const CAMERA_FOV = 36
const EXPOSURE = 1.6

function CameraRig() {
  const { camera, gl } = useThree()
  useEffect(() => {
    camera.lookAt(...CAMERA_LOOKAT)
    camera.updateProjectionMatrix()
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = EXPOSURE
  }, [camera, gl])
  return null
}

function Lighting() {
  return (
    <>
      {/* Base ambient + sky/ground fill so nothing crushes to pure black. */}
      <ambientLight intensity={0.5} color="#9fb2cc" />
      <hemisphereLight args={['#9fb6d6', '#161a20', 0.9]} />

      {/* Key light, warm-white, front-right-high (camera side). Shadow caster. */}
      <directionalLight
        position={[5.5, 9, 4]}
        intensity={3.2}
        color="#fef3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />

      {/* Rim from behind-left to peel the car off the dark background —
          dramatic motorsport red, the one accent colour in the lighting,
          matching the red/black identity elsewhere in the dashboard. */}
      <directionalLight position={[-6, 3.2, -6]} intensity={2.3} color="#ff3348" />

      {/* Frontal fill on the far (left) flank so it doesn't sink to black. */}
      <directionalLight position={[-4, 2.4, 6]} intensity={1.9} color="#d4deec" />

      {/* Low warm bounce from the tarmac to lift the underbody a touch. */}
      <pointLight position={[1.5, 0.4, 1]} intensity={0.6} distance={9} decay={2} color="#ffd9b0" />

      {/* Procedural studio environment — soft bright panels the glossy
          bodywork can reflect, which is what actually makes the car read as
          a polished object rather than flat plastic. No HDR fetch. */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#0a0d12']} />
        <Lightformer intensity={2.4} position={[0, 5, -4]} scale={[10, 4, 1]} color="#fff4f0" />
        <Lightformer intensity={1.8} position={[-5, 2, 2]} scale={[3, 6, 1]} color="#ff4f5e" />
        <Lightformer intensity={1.2} position={[5, 2, 2]} scale={[3, 6, 1]} color="#ffe6cc" />
        <Lightformer intensity={1.8} position={[0, 3, 6]} scale={[8, 3, 1]} color="#f5ece8" />
        <Lightformer intensity={0.8} position={[0, -3, 0]} scale={[12, 12, 1]} color="#170f10" />
      </Environment>
    </>
  )
}

function Scene() {
  return (
    <>
      <CameraRig />
      <Lighting />

      <Suspense fallback={null}>
        <Car />
      </Suspense>

      {/* Grounded contact — a real soft shadow blob under the car so the
          tyres read as touching a surface, with no visible floor/road
          needed to sell it. */}
      <ContactShadows
        position={[0, FLOOR_Y + 0.01, 0]}
        scale={9}
        far={4}
        blur={2.4}
        opacity={0.65}
        resolution={512}
        color="#000000"
        frames={60}
      />
    </>
  )
}

function LoadingOverlay() {
  const { progress, active } = useProgress()
  if (!active) return null
  return <div className={styles.loading}>Loading scene · {Math.round(progress)}%</div>
}

/**
 * Isolated, reusable 3D scene: the car as a stationary, slowly-rotating
 * subject (no road, no travel animation — see Car.jsx). Fills its parent
 * container. Not coupled to any dashboard feature or backend — the parent
 * only supplies a sized box.
 *
 * @param {boolean} [showOverlay=true]  minimal presentational HUD labels
 * @param {string}  [className]         extra class on the wrapper
 */
export default function RacingScene({ showOverlay = true, className }) {
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <Canvas
        className={styles.canvas}
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV, near: 0.1, far: 400 }}
      >
        <Scene />
      </Canvas>

      <div className={styles.vignette} />
      {showOverlay && <Overlay />}
      <LoadingOverlay />
    </div>
  )
}
