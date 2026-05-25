import { useEffect, useRef } from "react"
import * as THREE from "three"

interface Props {
  isDark: boolean
}

export default function ThreeBackground({ isDark }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const count = 280
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 48
      positions[i + 1] = (Math.random() - 0.5) * 48
      positions[i + 2] = (Math.random() - 0.5) * 48
      colors[i] = 0
      colors[i + 1] = isDark ? 0.65 : 0.35
      colors[i + 2] = isDark ? 0.93 : 0.60
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    const particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: isDark ? 0.14 : 0.18,
        vertexColors: true,
        transparent: true,
        opacity: isDark ? 0.95 : 0.80,
        blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
      })
    )
    scene.add(particles)

    let lines = new THREE.LineSegments()
    scene.add(lines)
    camera.position.z = 30

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener("resize", handleResize)

    let animId: number
    function animate() {
      animId = requestAnimationFrame(animate)
      const pos = particles.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] += Math.sin(Date.now() * 0.001 + i) * 0.009
        pos[i + 1] += Math.cos(Date.now() * 0.001 + i) * 0.009
      }
      particles.geometry.attributes.position.needsUpdate = true

      const linePos: number[] = []
      for (let i = 0; i < pos.length; i += 3) {
        for (let j = i + 3; j < pos.length; j += 3) {
          const dx = pos[i] - pos[j]
          const dy = pos[i + 1] - pos[j + 1]
          const dz = pos[i + 2] - pos[j + 2]
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 6) {
            linePos.push(pos[i], pos[i + 1], pos[i + 2], pos[j], pos[j + 1], pos[j + 2])
          }
        }
      }
      const lineGeo = new THREE.BufferGeometry()
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3))
      lines.geometry.dispose()
      lines.geometry = lineGeo
      lines.material = new THREE.LineBasicMaterial({
        color: isDark ? 0x00a2ed : 0x0066a1,
        transparent: true,
        opacity: isDark ? 0.18 : 0.25,
      })

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", handleResize)
      renderer.dispose()
      scene.clear()
    }
  }, [isDark])

  return <canvas ref={canvasRef} className="fixed inset-0 z-0" />
}
