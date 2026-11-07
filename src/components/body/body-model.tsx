import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BODY_CENTER, facesBack, focusShade, focusView, MAX_DISTANCE, zoomed } from '@/body/model-focus'
import { hexToRgb, nearestAngle, shadeRgb, type Tone } from '@/body/model-math'
import { cn } from '@/lib/cn'

// Modeli 3D i trupit (SPEC §11, TH-05, TH-19): BodyParts3D, një nyje për çdo çelës të Shtojcës D
// (public/anatomy/body.glb, nga tools/anatomy/build.mjs). Zvarritja anash e rrotullon, dy gishta
// e zmadhojnë, prekja e një muskuli e zgjedh (prekja jashtë trupit: null). Me `focus`, muskujt e
// zgjedhur theksohen, të tjerët zbehen, dhe kamera i afrohet dhe e kthen trupin drejt tyre.
// Ngjyrat vijnë nga tokenat e temës; vizatohet vetëm kur ndryshon diçka. Ngarkohet me React.lazy,
// që three.js të mos hyjë te paketa kryesore.

const MODEL_URL = `${import.meta.env.BASE_URL}anatomy/body.glb`
const DRAG_THRESHOLD = 6
const RADIANS_PER_PIXEL = 0.012
// Muskuli pa vlerë: gri i errët mbi panel, që forma të lexohet pa u ngatërruar me legjendën.
const BASE: Tone = { token: '--panel-muted-foreground', alpha: 0.2 }
const SOLID = (token: string): Tone => ({ token, alpha: 1 })
/** Ngjyra e një toni mbi panel, si te figura 2D, me theksimin ose zbehjen e fokusit, në ngjyrën e three.js. */
function toneColor(element: Element, tone: Tone, target = new THREE.Color(), shade = focusShade(null)) {
  const read = (token: string) => hexToRgb(getComputedStyle(element).getPropertyValue(token))
  const panel = read('--panel') ?? [0, 0, 0]
  const palette = { panel, color: read(tone.token) ?? panel, foreground: read('--panel-foreground') ?? panel }
  const [r, g, b] = shadeRgb(palette, tone.alpha, shade)
  return target.setRGB(r, g, b, THREE.SRGBColorSpace)
}

interface View {
  rotation: number
  height: number
  distance: number
}

interface ModelApi {
  repaint(paint: (key: string) => Tone | null, focus: string[] | null): void
  turn(back: boolean): void
  focus(keys: string[] | null): void
}

export default function BodyModel({
  paint,
  onPick,
  back,
  onBackChange,
  focus = null,
  focusRequest = 0,
  face,
  overlay,
  label,
  className,
}: {
  paint: (key: string) => Tone | null
  /** Çelësi i prekur; null kur prekja bie jashtë trupit. */
  onPick: (key: string | null) => void
  /** true: modeli shikon mbrapa. Ndryshon edhe me zvarritje (onBackChange). */
  back: boolean
  onBackChange: (back: boolean) => void
  /** Çelësat e theksuar; kamera u afrohet. null: i gjithë trupi. */
  focus?: string[] | null
  /** Rritet me çdo prekje: e njëjta zgjedhje, pas një rrotullimi ose zmadhimi, e afron përsëri kamerën. */
  focusRequest?: number
  /** Çelësat nga të cilët kthehet modeli kur hapet (p.sh. muskujt kryesorë të ushtrimit). */
  face?: string[]
  /** Përmbajtje mbi pjesën e poshtme të modelit (p.sh. emri i muskulit të zgjedhur). */
  overlay?: ReactNode
  label: string
  className?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<ModelApi | null>(null)
  // Thirren nga dëgjuesit e efektit me vlerat e fundit të prindit, pa e rindërtuar skenën.
  const pick = useEffectEvent((key: string | null) => onPick(key))
  const reportFacing = useEffectEvent((toBack: boolean) => onBackChange(toBack))
  const initialFace = useRef(face)
  // Ana që modeli tregon tani. Pas një zvarritjeje ose fokusi prindi merr anën e re pa e kthyer modelin.
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
    // Zvarritja vertikale mbetet për faqen; anash rrotullon modelin, dy gishta e zmadhojnë.
    canvas.style.touchAction = 'pan-y'
    element.appendChild(canvas)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20)
    // Drita nga tokenat e panelit: e bardhë sipër, gri poshtë, që forma e muskujve të lexohet.
    scene.add(new THREE.HemisphereLight(toneColor(element, SOLID('--panel-foreground')), toneColor(element, SOLID('--panel-muted-foreground')), 2.2))
    const light = new THREE.DirectionalLight(toneColor(element, SOLID('--panel-foreground')), 1.6)
    light.position.set(1.5, 2.5, 3)
    camera.add(light)
    scene.add(camera)
    const body = new THREE.Group()
    scene.add(body)
    const muscles = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>()
    const view: View = { rotation: 0, height: BODY_CENTER, distance: MAX_DISTANCE }
    const target: View = { ...view }
    let frame = 0

    const place = () => {
      body.rotation.y = view.rotation
      camera.position.set(0, view.height + 0.02, view.distance)
      camera.lookAt(0, view.height, 0)
      // Për provat (zmadhimi me dy gishta në emulator): sa larg është kamera.
      element.dataset.distance = view.distance.toFixed(2)
    }
    const animate = () => {
      frame = 0
      let moving = false
      for (const field of ['rotation', 'height', 'distance'] as const) {
        view[field] += (target[field] - view[field]) * 0.2
        if (Math.abs(target[field] - view[field]) < 0.002) view[field] = target[field]
        else moving = true
      }
      place()
      renderer.render(scene, camera)
      if (moving) frame = requestAnimationFrame(animate)
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

    /** Kutia e disa muskujve në koordinatat e trupit (para rrotullimit). */
    const boxOf = (keys: string[]) => {
      const box = new THREE.Box3()
      for (const key of keys) {
        const mesh = muscles.get(key)
        if (!mesh) continue
        mesh.geometry.computeBoundingBox()
        box.union(mesh.geometry.boundingBox!)
      }
      return box.isEmpty() ? null : box
    }
    const settleFacing = () => {
      const toBack = Math.cos(target.rotation) < 0
      if (toBack !== facing.current) {
        facing.current = toBack
        reportFacing(toBack)
      }
    }

    // Një gisht: zvarritja rrotullon, prekja pa zvarritje zgjedh muskulin te `click` (jo te
    // `pointerup`: fleta që hapet nuk duhet ta marrë vetë klikimin që pason prekjen). Dy gishta: zmadhim.
    const pointers = new Map<number, { x: number; y: number }>()
    let drag: { id: number; x: number; from: number; moved: boolean } | null = null
    let pinch: { span: number; distance: number } | null = null
    let gesture = false
    const raycaster = new THREE.Raycaster()
    const span = () => {
      const [a, b] = [...pointers.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const onDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size === 1) {
        // Një gjest që mbaroi jashtë kanavacës nuk lë klikim pas; gjesti i ri nis pa të.
        gesture = false
        drag = { id: event.pointerId, x: event.clientX, from: target.rotation, moved: false }
      } else if (pointers.size === 2) {
        drag = null
        gesture = true
        pinch = { span: span(), distance: target.distance }
      }
    }
    const onMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pinch && pointers.size === 2) {
        target.distance = view.distance = zoomed(pinch.distance, span() / Math.max(pinch.span, 1))
        place()
        schedule()
        return
      }
      if (!drag || event.pointerId !== drag.id) return
      const dx = event.clientX - drag.x
      if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD) return
      drag.moved = true
      gesture = true
      target.rotation = view.rotation = drag.from + dx * RADIANS_PER_PIXEL
      place()
      schedule()
    }
    const onUp = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return
      if (pointers.size < 2) pinch = null
      if (drag?.id === event.pointerId) {
        drag = null
        if (gesture) settleFacing()
      }
    }
    const onClick = (event: MouseEvent) => {
      if (gesture) {
        gesture = false
        return
      }
      const box = canvas.getBoundingClientRect()
      const pointer = new THREE.Vector2(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const [hit] = raycaster.intersectObjects([...muscles.values()], false)
      pick(hit ? hit.object.name : null)
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('click', onClick)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

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
        // Ana e nisjes: nga prindi, ose nga muskujt që duhet të duken (p.sh. Romanian Deadlift mbrapa).
        if (!facing.current && initialFace.current && facesBack(initialFace.current)) {
          facing.current = true
          reportFacing(true)
        }
        target.rotation = view.rotation = facing.current ? Math.PI : 0
        place()
        api.current = {
          repaint(next, focused) {
            for (const [name, mesh] of muscles) {
              toneColor(element, next(name) ?? BASE, mesh.material.color, focusShade(focused ? focused.includes(name) : null))
            }
            schedule()
          },
          turn(toBack) {
            target.rotation = nearestAngle(toBack ? Math.PI : 0, view.rotation)
            schedule()
          },
          focus(keys) {
            const box = keys ? boxOf(keys) : null
            if (!keys || !box) {
              target.height = BODY_CENTER
              target.distance = MAX_DISTANCE
            } else {
              const fit = focusView({ min: box.min.toArray(), max: box.max.toArray() })
              target.rotation = nearestAngle(facesBack(keys) ? Math.PI : 0, view.rotation)
              target.height = fit.height
              target.distance = fit.distance
              settleFacing()
            }
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
      window.removeEventListener('pointercancel', onUp)
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

  const focusKey = focus?.join(',') ?? ''
  useEffect(() => {
    if (state === 'ready') api.current?.repaint(paint, focusKey ? focusKey.split(',') : null)
  }, [paint, focusKey, state])

  useEffect(() => {
    if (state === 'ready') api.current?.focus(focusKey ? focusKey.split(',') : null)
  }, [focusKey, focusRequest, state])

  useEffect(() => {
    if (state !== 'ready' || back === facing.current) return
    facing.current = back
    api.current?.turn(back)
  }, [back, state])

  return (
    <div className={cn('relative h-[360px] w-full', className)}>
      <div ref={host} role="img" aria-label={label} className="absolute inset-0" />
      {state === 'ready' ? null : (
        <span className="absolute inset-0 flex items-center justify-center text-sm leading-5 text-panel-muted-foreground">
          {state === 'loading' ? 'Po ngarkohet modeli' : 'Modeli 3D nuk u ngarkua'}
        </span>
      )}
      {state === 'ready' && overlay ? (
        // Shiriti rreth emrit nuk i merr prekjet: vetëm vetë emri, modeli poshtë tij rrotullohet dhe zgjedh.
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-2 [&>*]:pointer-events-auto">{overlay}</div>
      ) : null}
    </div>
  )
}
