import { useEffect, useEffectEvent, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { blendOver, hexToRgb, nearestAngle, type Tone } from '@/body/model-math'
import { cn } from '@/lib/cn'

// Modeli 3D i trupit (SPEC §11, TH-05): BodyParts3D, një nyje për çdo çelës të Shtojcës D
// (public/anatomy/body.glb, nga tools/anatomy/build.mjs). Zvarritja anash e rrotullon, prekja e
// një muskuli e zgjedh. Ngjyrat vijnë nga tokenat e temës; vizatohet vetëm kur ndryshon diçka.
// Ngarkohet me React.lazy, që three.js të mos hyjë te paketa kryesore.

const MODEL_URL = `${import.meta.env.BASE_URL}anatomy/body.glb`
const DRAG_THRESHOLD = 6
const RADIANS_PER_PIXEL = 0.012
// Muskuli pa vlerë: gri i errët mbi panel, që forma të lexohet pa u ngatërruar me legjendën.
const BASE: Tone = { token: '--panel-muted-foreground', alpha: 0.2 }
const SOLID = (token: string): Tone => ({ token, alpha: 1 })

/** Ngjyra e një toni mbi panel, si te figura 2D, në ngjyrën e three.js. */
function toneColor(element: Element, tone: Tone, target = new THREE.Color()) {
  const read = (token: string) => hexToRgb(getComputedStyle(element).getPropertyValue(token))
  const panel = read('--panel') ?? [0, 0, 0]
  const [r, g, b] = blendOver(panel, read(tone.token) ?? panel, tone.alpha)
  return target.setRGB(r, g, b, THREE.SRGBColorSpace)
}

export default function BodyModel({
  paint,
  onPick,
  back,
  onBackChange,
  label,
  className,
}: {
  paint: (key: string) => Tone | null
  onPick: (key: string) => void
  /** true: modeli shikon mbrapa. Ndryshon edhe me zvarritje (onBackChange). */
  back: boolean
  onBackChange: (back: boolean) => void
  label: string
  className?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<{ repaint: (paint: (key: string) => Tone | null) => void; turn: (back: boolean) => void } | null>(null)
  // Thirren nga dëgjuesit e efektit me vlerat e fundit të prindit, pa e rindërtuar skenën.
  const pick = useEffectEvent((key: string) => onPick(key))
  const reportFacing = useEffectEvent((toBack: boolean) => onBackChange(toBack))
  // Ana që modeli tregon tani. Pas një zvarritjeje prindi merr anën e re pa e kthyer modelin.
  const facing = useRef(back)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const element = host.current
    if (!element) return
    let disposed = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      // Pa kontekst WebGL (p.sh. WebView-i i ka mbaruar kontekstet): thuhet si gabimi i ngarkimit.
      void Promise.resolve().then(() => {
        if (!disposed) setState('error')
      })
      return () => {
        disposed = true
      }
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0, 0)
    const canvas = renderer.domElement
    canvas.style.display = 'block'
    // Zvarritja vertikale mbetet për faqen; anash rrotullon modelin.
    canvas.style.touchAction = 'pan-y'
    element.appendChild(canvas)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20)
    camera.position.set(0, 0.88, 3.75)
    camera.lookAt(0, 0.86, 0)
    // Drita nga tokenat e panelit: e bardhë sipër, gri poshtë, që forma e muskujve të lexohet.
    scene.add(new THREE.HemisphereLight(toneColor(element, SOLID('--panel-foreground')), toneColor(element, SOLID('--panel-muted-foreground')), 2.2))
    const key = new THREE.DirectionalLight(toneColor(element, SOLID('--panel-foreground')), 1.6)
    key.position.set(1.5, 2.5, 3)
    camera.add(key)
    scene.add(camera)
    const body = new THREE.Group()
    scene.add(body)
    const muscles = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>()
    let rotation = 0
    let target = 0
    let frame = 0

    const animate = () => {
      frame = 0
      rotation += (target - rotation) * 0.2
      if (Math.abs(target - rotation) < 0.002) rotation = target
      body.rotation.y = rotation
      renderer.render(scene, camera)
      if (rotation !== target) frame = requestAnimationFrame(animate)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(animate)
    }
    const resize = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      if (!width || !height) return
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      schedule()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)

    // Zvarritja rrotullon; prekja pa zvarritje zgjedh muskulin te `click`, jo te `pointerup`: fleta
    // që hapet nuk duhet ta marrë vetë klikimin që pason prekjen.
    let drag: { id: number; x: number; from: number; moved: boolean } | null = null
    let dragged = false
    const raycaster = new THREE.Raycaster()
    const onDown = (event: PointerEvent) => {
      if (drag) return
      // Një zvarritje që mbaroi jashtë kanavacës nuk lë klikim pas; gjesti i ri nis pa të.
      dragged = false
      drag = { id: event.pointerId, x: event.clientX, from: target, moved: false }
    }
    const onMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return
      const dx = event.clientX - drag.x
      if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD) return
      drag.moved = true
      target = rotation = drag.from + dx * RADIANS_PER_PIXEL
      body.rotation.y = rotation
      schedule()
    }
    const onUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return
      dragged = drag.moved
      drag = null
      if (dragged) {
        facing.current = Math.cos(target) < 0
        reportFacing(facing.current)
      }
    }
    const onClick = (event: MouseEvent) => {
      if (dragged) {
        dragged = false
        return
      }
      const box = canvas.getBoundingClientRect()
      const pointer = new THREE.Vector2(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const [hit] = raycaster.intersectObjects([...muscles.values()], false)
      if (hit) pick(hit.object.name)
    }
    const onCancel = () => {
      drag = null
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('click', onClick)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)

    new GLTFLoader()
      .loadAsync(MODEL_URL)
      .then((gltf) => {
        if (disposed) return
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          object.geometry.computeVertexNormals()
          if (object.name === 'skin') {
            // Lëkura: siluetë e tejdukshme që nuk fsheh muskujt dhe nuk kap prekjen.
            object.material = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.12, depthWrite: false, roughness: 1 })
            toneColor(element, SOLID('--panel-muted-foreground'), object.material.color)
            object.renderOrder = 1
          } else {
            object.material = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 })
            muscles.set(object.name, object)
          }
        })
        body.add(gltf.scene)
        target = rotation = facing.current ? Math.PI : 0
        api.current = {
          repaint(next) {
            for (const [name, mesh] of muscles) toneColor(element, next(name) ?? BASE, mesh.material.color)
            schedule()
          },
          turn(toBack) {
            target = nearestAngle(toBack ? Math.PI : 0, rotation)
            schedule()
          },
        }
        setState('ready')
      })
      .catch(() => {
        if (!disposed) setState('error')
      })

    return () => {
      disposed = true
      api.current = null
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('click', onClick)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          ;(object.material as THREE.Material).dispose()
        }
      })
      renderer.dispose()
      canvas.remove()
    }
  }, [])

  useEffect(() => {
    if (state === 'ready') api.current?.repaint(paint)
  }, [paint, state])

  useEffect(() => {
    if (state !== 'ready' || back === facing.current) return
    facing.current = back
    api.current?.turn(back)
  }, [back, state])

  return (
    <div ref={host} role="img" aria-label={label} className={cn('relative h-[360px] w-full', className)}>
      {state === 'ready' ? null : (
        <span className="absolute inset-0 flex items-center justify-center text-sm leading-5 text-panel-muted-foreground">
          {state === 'loading' ? 'Po ngarkohet modeli' : 'Modeli 3D nuk u ngarkua'}
        </span>
      )}
    </div>
  )
}
