import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { FLOOR_Y, CAR_LENGTH } from './sceneConfig'

const MODEL_URL = '/models/vf26.glb'

// Base heading, verified (not guessed) against the GLB's own wheel-node
// positions — see docs/superpowers/specs/2026-09-02-racing-scene-design.md.
// Kept as the car's rest orientation even now that it turns continuously,
// so it reads correctly the moment it loads, before rotation has moved it.
const CAR_YAW = Math.PI

// Slow, continuous turntable spin — this is the scene's one animation now
// that there's no road to travel down. Radians/second.
const ROTATION_SPEED = 0.28

export default function Car() {
  const { scene } = useGLTF(MODEL_URL)
  const outerRef = useRef()

  // Normalise scale + rest position once. No wheel-node lookup here any
  // more — nothing spins independently while the whole car turns.
  const { scale, offset } = useMemo(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = false
        // Let the bodywork pick up the procedural studio environment.
        if (child.material) child.material.envMapIntensity = 1.15
      }
    })

    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const nativeLength = Math.max(size.x, size.z) || 1
    const s = CAR_LENGTH / nativeLength

    return {
      scale: s,
      // Centre on X/Z, and lift so the lowest point (tyre contact) sits on FLOOR_Y.
      offset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
    }
  }, [scene])

  useFrame((_, delta) => {
    if (outerRef.current) {
      outerRef.current.rotation.y += delta * ROTATION_SPEED
    }
  })

  return (
    <group ref={outerRef} position={[0, FLOOR_Y, 0]}>
      <group scale={scale} rotation={[0, CAR_YAW, 0]}>
        <primitive object={scene} position={offset.toArray()} />
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_URL)
