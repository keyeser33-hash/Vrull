import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ShapeScales } from '@/body/body-shape'
import { BODY_CENTER, facesBack, FIELD_OF_VIEW_DEGREES, focusView, MAX_DISTANCE, zoomed } from '@/body/model-focus'
import { nearestAngle, type Tone } from '@/body/model-math'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { addLights, type BodyMeshes, boxOf, disposeScene, loadBody, paintMuscles, shapeMuscles } from './body-scene'

// Modeli 3D i trupit (SPEC §11, TH-05, TH-19, V2-E1-14). Zvarritja anash e rrotullon, dy gishta e
// zmadhojnë, prekja e një muskuli e zgjedh (prekja jashtë trupit: null). Me `focus`, muskujt e
// zgjedhur theksohen, të tjerët zbehen, dhe kamera i afrohet dhe e kthen trupin drejt tyre; me
// `leader`, një vijë lidh çipin sipër me muskulin. `ghost` i bën të tejdukshme mbulesat (Shtresat),
// `shape` ndjek perimetrat (Trupi sipas matjeve). Ngjyrat dhe drita vijnë nga tokenat e temës
// (body-scene.ts); vizatohet vetëm kur ndryshon diçka. Ngarkohet me React.lazy, që three.js të mos
// hyjë te paketa kryesore. "Trupi në ritëm" (E1-12) përdor të njëjtën skenë: imazhet e palëvizshme
// të body-still.ts, ose `paint` me tonet e pulsit.

const DRAG_THRESHOLD = 6
const RADIANS_PER_PIXEL = 0.012
/** Ku nis vija nga çipi sipër (px nga maja): çipi 46 px, 8 px larg cepit. */
const LEADER_FROM = 54

interface View {
  rotation: number
  height: number
  distance: number
}

interface ModelApi {
  repaint(paint: (key: string) => Tone | null, focus: string[] | null, ghost: Set<string>, shade: boolean): void
  reshape(shape: ShapeScales): void
  turn(back: boolean): void
  focus(keys: string[] | null): void
}

export interface BodyModelProps {
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
  /** false: fokusi lëviz vetëm kamerën, pa ndriçuar e zbehur muskujt (Shtresat i ngjyros vetë). */
  shadeFocus?: boolean
  /** Muskujt e tejdukshëm (mbulesat e Shtresave); nuk kapin prekjen. */
  ghost?: string[]
  /** Raporti i perimetrit për çdo zonë (Trupi sipas matjeve); pa të, modeli origjinal. */
  shape?: ShapeScales
  /** Çelësat nga të cilët kthehet modeli kur hapet (p.sh. muskujt kryesorë të ushtrimit). */
  face?: string[]
  /** Përmbajtje mbi model: emri i muskulit të zgjedhur. */
  overlay?: ReactNode
  /** Ku rri `overlay`: poshtë (parazgjedhja) ose sipër, si te bordi "Trupi". */
  overlayAt?: 'top' | 'bottom'
  /** Vija nga çipi sipër te qendra e muskujve në fokus. */
  leader?: boolean
  label: string
  className?: string
}

export default function BodyModel({
  paint,
  onPick,
  back,
  onBackChange,
  focus = null,
  focusRequest = 0,
  shadeFocus = true,
  ghost,
  shape,
  face,
  overlay,
  overlayAt = 'bottom',
  leader = false,
  label,
  className,
}: BodyModelProps) {
  const { t } = useI18n()
  const host = useRef<HTMLDivElement>(null)
  const leaderRef = useRef<SVGSVGElement>(null)
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
    const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW_DEGREES, 1, 0.1, 20)
    addLights(scene, camera, element)
    const body = new THREE.Group()
    scene.add(body)
    let meshes: BodyMeshes | null = null
    const view: View = { rotation: 0, height: BODY_CENTER, distance: MAX_DISTANCE }
    const target: View = { ...view }
    // Qendra e muskujve në fokus (koordinatat e trupit), për vijën nga çipi.
    let focusCenter: THREE.Vector3 | null = null
    let frame = 0

    const drawLeader = () => {
      const svg = leaderRef.current
      if (!svg) return
      const width = element.clientWidth
      const height = element.clientHeight
      if (!focusCenter || !width) {
        svg.style.display = 'none'
        return
      }
      const point = body.localToWorld(focusCenter.clone()).project(camera)
      const x = ((point.x + 1) / 2) * width
      const y = ((1 - point.y) / 2) * height
      const visible = point.z < 1 && x > 0 && x < width && y > LEADER_FROM + 12 && y < height
      svg.style.display = visible ? 'block' : 'none'
      if (!visible) return
      svg.querySelector('path')!.setAttribute('d', `M${x.toFixed(1)} ${LEADER_FROM}V${(y - 5).toFixed(1)}`)
      const circle = svg.querySelector('circle')!
      circle.setAttribute('cx', x.toFixed(1))
      circle.setAttribute('cy', y.toFixed(1))
    }
    const place = () => {
      body.rotation.y = view.rotation
      camera.position.set(0, view.height + 0.02, view.distance)
      camera.lookAt(0, view.height, 0)
      camera.updateMatrixWorld()
      body.updateMatrixWorld()
      // Për provat (zmadhimi me dy gishta në emulator): sa larg është kamera.
      element.dataset.distance = view.distance.toFixed(2)
      drawLeader()
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
      if (!meshes) return
      const box = canvas.getBoundingClientRect()
      const pointer = new THREE.Vector2(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      // Mbulesat e tejdukshme nuk kapin prekjen: prekja kalon te muskuli i thellë poshtë tyre.
      const solid = [...meshes.muscles.values()].filter((mesh) => !mesh.userData.ghost)
      const [hit] = raycaster.intersectObjects(solid, false)
      pick(hit ? hit.object.name : null)
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('click', onClick)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    loadBody(element)
      .then((loaded) => {
        if (disposed) {
          disposeScene(loaded.root)
          return
        }
        meshes = loaded
        body.add(loaded.root)
        // Ana e nisjes: nga prindi, ose nga muskujt që duhet të duken (p.sh. Romanian Deadlift mbrapa).
        if (!facing.current && initialFace.current && facesBack(initialFace.current)) {
          facing.current = true
          reportFacing(true)
        }
        target.rotation = view.rotation = facing.current ? Math.PI : 0
        place()
        api.current = {
          repaint(next, focused, ghosts, shade) {
            paintMuscles(element, loaded.muscles, next, shade ? focused : null, ghosts)
            schedule()
          },
          reshape(scales) {
            shapeMuscles(loaded.muscles, scales)
            schedule()
          },
          turn(toBack) {
            target.rotation = nearestAngle(toBack ? Math.PI : 0, view.rotation)
            schedule()
          },
          focus(keys) {
            const box = keys ? boxOf(loaded.muscles, keys) : null
            if (!keys || !box) {
              focusCenter = null
              target.height = BODY_CENTER
              target.distance = MAX_DISTANCE
            } else {
              focusCenter = box.getCenter(new THREE.Vector3())
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
      disposeScene(scene)
      renderer.dispose()
      canvas.remove()
    }
  }, [])

  const focusKey = focus?.join(',') ?? ''
  const ghostKey = ghost?.join(',') ?? ''
  const shapeKey = JSON.stringify(shape ?? {})
  useEffect(() => {
    if (state === 'ready') api.current?.reshape(JSON.parse(shapeKey) as ShapeScales)
  }, [shapeKey, state])

  useEffect(() => {
    if (state === 'ready') api.current?.repaint(paint, focusKey ? focusKey.split(',') : null, new Set(ghostKey ? ghostKey.split(',') : []), shadeFocus)
  }, [paint, focusKey, ghostKey, shadeFocus, state])

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
      {leader ? (
        <svg ref={leaderRef} aria-hidden className="pointer-events-none absolute inset-0 hidden size-full text-foreground">
          <path d="" fill="none" stroke="currentColor" strokeWidth={1.5} />
          <circle r={5} fill="none" stroke="currentColor" strokeWidth={2} />
        </svg>
      ) : null}
      {state === 'ready' ? null : (
        <span className="absolute inset-0 flex items-center justify-center type-caption text-muted-foreground">
          {state === 'loading' ? t('bodyModel.loading') : t('bodyModel.error')}
        </span>
      )}
      {state === 'ready' && overlay ? (
        // Shiriti rreth emrit nuk i merr prekjet: vetëm vetë emri, modeli poshtë tij rrotullohet dhe zgjedh.
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 flex justify-center px-2 [&>*]:pointer-events-auto',
            overlayAt === 'top' ? 'top-2' : 'bottom-0',
          )}
        >
          {overlay}
        </div>
      ) : null}
    </div>
  )
}
