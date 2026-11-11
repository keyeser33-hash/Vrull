import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ShapeScales } from '@/body/body-shape'
import { angleAt, angleView, auraFade, auraScale, focusAngle, fullView, isFreeView, leaderEnd, pinched, tilted, type ViewAngle } from '@/body/model-camera'
import { BODY_CENTER, facesBack, FIELD_OF_VIEW_DEGREES, focusView, MAX_DISTANCE, zoomed } from '@/body/model-focus'
import { nearestAngle, type Tone } from '@/body/model-math'
import { Icon } from '@/components/ui/icons'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { modelHint } from '@/lib/model-hint'
import { addGround, addLights, type BodyMeshes, boxOf, disposeScene, loadBody, paintMuscles, setAuraView, shapeMuscles, sidePoints } from './body-scene'
import { ViewRail } from './view-rail'

// Modeli 3D i trupit (SPEC §11, TH-05, TH-19, V2-E1-14, V53). Zvarritja anash e rrotullon, dy gishta e
// zmadhojnë, prekja e një muskuli e zgjedh (prekja jashtë trupit: null). Me `focus`, muskujt e
// zgjedhur theksohen, të tjerët zbehen, dhe kamera i afrohet dhe e kthen trupin drejt tyre; me
// `leader`, një vijë lidh çipin sipër (ose kartën poshtë, `overlayAt="card"`) me muskulin. `ghost` i
// bën të tejdukshme mbulesat (Shtresat), `shape` ndjek perimetrat (Trupi sipas matjeve). Ngjyrat,
// drita dhe shkëlqimi vijnë nga tokenat e temës (body-scene.ts); vizatohet vetëm kur ndryshon diçka.
// Ngarkohet me React.lazy, që three.js të mos hyjë te paketa kryesore. "Trupi në ritëm" (E1-12)
// përdor të njëjtën skenë: imazhet e palëvizshme të body-still.ts, ose `paint` me tonet e pulsit.
//
// Kamera e lirë (`controls`, V53; bordet "Trupi 3D · drita dhe kamera"): zvarritja e kthen trupin
// dhe e anon kamerën lart-poshtë, dy gishta afrojnë te vendi që tregojnë dhe e zhvendosin trupin,
// shina e këndeve (Para, 3/4, Anash, Mbrapa) zë vendin e "Shiko mbrapa", dhe "Pamja e plotë" e kthen
// te fillimi. Te trupi i plotë zvarritja vertikale mbetet e faqes; kur kamera është afruar, modeli i
// merr të gjitha gjestet.

const DRAG_THRESHOLD = 6
const RADIANS_PER_PIXEL = 0.012
const TILT_PER_PIXEL = 0.008
/** Ku nis vija nga çipi sipër (px nga maja): çipi 46 px, 8 px larg cepit. */
const LEADER_FROM = 54
/** Me kartën e muskulit: kamera rri më larg dhe muskuli ngjitet mbi kartë (pjesë e lartësisë së pamjes). */
const CARD_MARGIN = 1.9
const CARD_SHIFT = -0.14
const FIELD_OF_VIEW = (FIELD_OF_VIEW_DEGREES * Math.PI) / 180

interface View {
  rotation: number
  elevation: number
  height: number
  distance: number
  /** Zhvendosja e pamjes lart-poshtë pa ndryshuar këndin, si pjesë e lartësisë së saj. */
  shift: number
}
const VIEW_FIELDS = ['rotation', 'elevation', 'height', 'distance', 'shift'] as const

interface ModelApi {
  repaint(paint: (key: string) => Tone | null, focus: string[] | null, ghost: Set<string>, shade: boolean): void
  reshape(shape: ShapeScales): void
  turn(back: boolean): void
  focus(keys: string[] | null): void
  angle(id: ViewAngle): void
  full(): void
}

export interface BodyModelProps {
  paint: (key: string) => Tone | null
  /** Çelësi i prekur; null kur prekja bie jashtë trupit. */
  onPick: (key: string | null) => void
  /** true: modeli shikon mbrapa. Ndryshon edhe me zvarritje (onBackChange). Me `controls` e mban shina. */
  back?: boolean
  onBackChange?: (back: boolean) => void
  /** Kamera e lirë me shinën e këndeve, "Pamja e plotë" dhe ndihmën e gjesteve (Trupi, V53). */
  controls?: boolean
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
  /** Përmbajtje mbi model: emri i muskulit të zgjedhur, ose karta e tij. */
  overlay?: ReactNode
  /** Ku rri `overlay`: poshtë (parazgjedhja), sipër si çip, ose poshtë majtas si kartë (bordi "Muskuli i prekur"). */
  overlayAt?: 'top' | 'bottom' | 'card'
  /** Vija nga çipi sipër te qendra e muskujve në fokus; me kartën, nga muskuli te karta. */
  leader?: boolean
  label: string
  className?: string
}

export default function BodyModel({
  paint,
  onPick,
  back,
  onBackChange,
  controls = false,
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
  const overlayRef = useRef<HTMLDivElement>(null)
  const api = useRef<ModelApi | null>(null)
  // Thirren nga dëgjuesit e efektit me vlerat e fundit të prindit, pa e rindërtuar skenën.
  const pick = useEffectEvent((key: string | null) => onPick(key))
  const reportFacing = useEffectEvent((toBack: boolean) => onBackChange?.(toBack))
  const initialFace = useRef(face)
  // Mënyra e shikuesit nuk ndryshon gjatë jetës së tij: kamera e lirë dhe karta vendosen kur hapet.
  const mode = useRef({ controls, card: overlayAt === 'card' })
  // Ana që modeli tregon tani. Pas një zvarritjeje ose fokusi prindi merr anën e re pa e kthyer modelin.
  const facing = useRef(back ?? false)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  // Kamera e lirë: këndi i shinës ku është pamja, a është larguar nga trupi i plotë, dhe ndihma e gjesteve.
  const [angle, setAngle] = useState<ViewAngle | null>('front')
  const [free, setFree] = useState(false)
  const [hint, setHint] = useState(() => controls && !modelHint.seen())
  const usedGesture = useEffectEvent(() => {
    if (!hint) return
    modelHint.dismiss()
    setHint(false)
  })

  useEffect(() => {
    const element = host.current
    if (!element) return
    const { controls: freeCamera, card } = mode.current
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
    addLights(scene, element)
    const body = new THREE.Group()
    scene.add(body)
    let meshes: BodyMeshes | null = null
    const view: View = { rotation: 0, elevation: 0, height: BODY_CENTER, distance: MAX_DISTANCE, shift: 0 }
    const target: View = { ...view }
    // Qendra e muskujve në fokus (koordinatat e trupit) për vijën nga çipi; me kartën, qendra e çdo ane.
    let focusCenter: THREE.Vector3 | null = null
    let focusSides: THREE.Vector3[] = []
    let hadFocus = false
    let frame = 0
    // Lëvizje e reduktuar (DESIGN.md › Lëvizja): kamera shkon te vendi pa animacion.
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    const onScreen = (point: THREE.Vector3, width: number, height: number) => {
      const projected = body.localToWorld(point.clone()).project(camera)
      return { x: ((projected.x + 1) / 2) * width, y: ((1 - projected.y) / 2) * height, front: projected.z < 1 }
    }
    const drawLeader = () => {
      const svg = leaderRef.current
      if (!svg) return
      const width = element.clientWidth
      const height = element.clientHeight
      const path = svg.querySelector('path')!
      const circle = svg.querySelector('circle')!
      const show = (x: number, y: number, d: string) => {
        svg.style.display = 'block'
        path.setAttribute('d', d)
        circle.setAttribute('cx', x.toFixed(1))
        circle.setAttribute('cy', y.toFixed(1))
      }
      svg.style.display = 'none'
      if (!width) return
      if (card) {
        // Karta poshtë majtas: vija zbret nga muskuli më afër saj deri te kreu i kartës.
        const frameBox = overlayRef.current?.firstElementChild?.getBoundingClientRect()
        if (!frameBox) return
        const hostBox = element.getBoundingClientRect()
        const top = frameBox.top - hostBox.top
        const [point] = focusSides
          .map((side) => onScreen(side, width, height))
          .filter(({ x, y, front }) => front && x > 6 && x < width - 6 && y > 6 && y < top - 14)
          .sort((a, b) => a.x - b.x)
        if (!point) return
        const end = leaderEnd(point.x, frameBox.left - hostBox.left, frameBox.right - hostBox.left)
        show(point.x, point.y, `M${point.x.toFixed(1)} ${(point.y + 5).toFixed(1)}L${end.toFixed(1)} ${top.toFixed(1)}`)
        return
      }
      if (!focusCenter) return
      const { x, y, front } = onScreen(focusCenter, width, height)
      if (front && x > 0 && x < width && y > LEADER_FROM + 12 && y < height) show(x, y, `M${x.toFixed(1)} ${LEADER_FROM}V${(y - 5).toFixed(1)}`)
    }
    const place = () => {
      body.rotation.y = view.rotation
      camera.position.set(0, view.height + Math.sin(view.elevation) * view.distance, Math.cos(view.elevation) * view.distance)
      camera.lookAt(0, view.height, 0)
      // Zhvendosja në planin e ekranit: këndi nuk ndryshon, muskuli ngjitet mbi kartë.
      if (view.shift) camera.translateY(view.shift * 2 * Math.tan(FIELD_OF_VIEW / 2) * view.distance)
      camera.updateMatrixWorld()
      body.updateMatrixWorld()
      if (meshes) setAuraView(meshes, auraFade(view.distance), auraScale(view.distance))
      // Për provat (gjestet në emulator dhe në Chrome headless): ku është kamera.
      element.dataset.distance = view.distance.toFixed(2)
      element.dataset.rotation = view.rotation.toFixed(3)
      element.dataset.elevation = view.elevation.toFixed(3)
      element.dataset.height = view.height.toFixed(3)
      drawLeader()
    }
    const animate = () => {
      frame = 0
      let moving = false
      for (const field of VIEW_FIELDS) {
        view[field] += (target[field] - view[field]) * (still ? 1 : 0.2)
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
    // Pas çdo gjesti ose lëvizjeje të kamerës: ana që duket, dhe me kamerën e lirë shina, "Pamja e
    // plotë" dhe kush i merr zvarritjet vertikale (faqja te trupi i plotë, modeli kur është afruar).
    const settle = () => {
      settleFacing()
      if (!freeCamera) return
      canvas.style.touchAction = target.distance < MAX_DISTANCE - 0.05 ? 'none' : 'pan-y'
      setAngle(angleAt(target.rotation, target.elevation))
      setFree(isFreeView(target))
    }

    // Një gisht: zvarritja rrotullon (dhe anon, me kamerën e lirë), prekja pa zvarritje zgjedh muskulin
    // te `click` (jo te `pointerup`: fleta që hapet nuk duhet ta marrë vetë klikimin që pason prekjen).
    // Dy gishta: zmadhim, dhe me kamerën e lirë zhvendosje.
    const pointers = new Map<number, { x: number; y: number }>()
    let drag: { id: number; x: number; from: number; elevation: number; tiltFrom: number; moved: boolean } | null = null
    let pinch: { span: number; from: { height: number; distance: number }; middle: number } | null = null
    let gesture = false
    const raycaster = new THREE.Raycaster()
    const span = () => {
      const [a, b] = [...pointers.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    /** Mesi i dy gishtave, në px nga mesi i pamjes (poshtë pozitiv). */
    const middle = () => {
      const [a, b] = [...pointers.values()]
      const box = canvas.getBoundingClientRect()
      return (a.y + b.y) / 2 - (box.top + box.height / 2)
    }
    const onDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size === 1) {
        // Një gjest që mbaroi jashtë kanavacës nuk lë klikim pas; gjesti i ri nis pa të.
        gesture = false
        drag = { id: event.pointerId, x: event.clientX, from: target.rotation, elevation: target.elevation, tiltFrom: event.clientY, moved: false }
      } else if (pointers.size === 2) {
        drag = null
        gesture = true
        pinch = { span: span(), from: { height: target.height, distance: target.distance }, middle: middle() }
        usedGesture()
      }
    }
    const onMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pinch && pointers.size === 2) {
        const scale = span() / Math.max(pinch.span, 1)
        if (freeCamera) {
          const next = pinched(pinch.from, scale, pinch.middle, middle(), element.clientHeight)
          target.height = view.height = next.height
          target.distance = view.distance = next.distance
        } else target.distance = view.distance = zoomed(pinch.from.distance, scale)
        place()
        schedule()
        return
      }
      if (!drag || event.pointerId !== drag.id) return
      const dx = event.clientX - drag.x
      if (!drag.moved) {
        // Te trupi i plotë zvarritja vertikale me gisht është e faqes: gjesti nis vetëm kur shkon më
        // shumë anash se lart-poshtë, që një rrëshqitje e faqes të mos e anojë modelin. Me miun, ose
        // kur kamera është afruar (modeli i merr gjestet), nis në çdo drejtim.
        const dy = event.clientY - drag.tiltFrom
        const anyDirection = freeCamera && (event.pointerType === 'mouse' || canvas.style.touchAction === 'none')
        const far = anyDirection ? Math.hypot(dx, dy) >= DRAG_THRESHOLD : Math.abs(dx) >= DRAG_THRESHOLD && (!freeCamera || Math.abs(dx) >= Math.abs(dy))
        if (!far) return
        drag.moved = true
        drag.tiltFrom = event.clientY
        gesture = true
        usedGesture()
      }
      target.rotation = view.rotation = drag.from + dx * RADIANS_PER_PIXEL
      if (freeCamera) target.elevation = view.elevation = tilted(drag.elevation, (event.clientY - drag.tiltFrom) * TILT_PER_PIXEL)
      place()
      schedule()
    }
    const onUp = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return
      if (pointers.size < 2 && pinch) {
        pinch = null
        settle()
      }
      if (drag?.id === event.pointerId) {
        drag = null
        if (gesture) settle()
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
        addGround(scene, element, loaded)
        // Ana e nisjes: nga prindi, ose nga muskujt që duhet të duken (p.sh. Romanian Deadlift mbrapa).
        if (!facing.current && initialFace.current && facesBack(initialFace.current)) {
          facing.current = true
          reportFacing(true)
        }
        target.rotation = view.rotation = facing.current ? Math.PI : 0
        place()
        api.current = {
          repaint(next, focused, ghosts, shade) {
            paintMuscles(element, loaded, next, shade ? focused : null, ghosts)
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
          angle(id) {
            Object.assign(target, angleView(id, view.rotation))
            schedule()
            settle()
          },
          full() {
            Object.assign(target, fullView(view.rotation), { shift: 0 })
            schedule()
            settle()
          },
          focus(keys) {
            const box = keys ? boxOf(loaded.muscles, keys) : null
            if (!keys || !box) {
              focusCenter = null
              focusSides = []
              target.height = BODY_CENTER
              target.distance = MAX_DISTANCE
              target.shift = 0
              // Me kamerën e lirë, heqja e fokusit kthen te trupi i plotë nga ana ku ishte muskuli.
              if (freeCamera && hadFocus) {
                target.rotation = nearestAngle(Math.cos(target.rotation) < 0 ? Math.PI : 0, view.rotation)
                target.elevation = 0
              }
              hadFocus = false
            } else {
              focusCenter = box.getCenter(new THREE.Vector3())
              focusSides = card ? sidePoints(loaded.muscles, keys).map(([x, y, z]) => new THREE.Vector3(x, y, z)) : []
              const fit = focusView({ min: box.min.toArray(), max: box.max.toArray() }, card ? CARD_MARGIN : undefined)
              if (freeCamera) Object.assign(target, focusAngle(facesBack(keys), view.rotation))
              else target.rotation = nearestAngle(facesBack(keys) ? Math.PI : 0, view.rotation)
              target.height = fit.height
              target.distance = fit.distance
              target.shift = card ? CARD_SHIFT : 0
              hadFocus = true
            }
            schedule()
            settle()
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
    if (state !== 'ready' || back === undefined || back === facing.current) return
    facing.current = back
    api.current?.turn(back)
  }, [back, state])

  const ready = state === 'ready'
  return (
    <div className={cn('relative h-[360px] w-full', className)}>
      <div ref={host} role="img" aria-label={label} className="absolute inset-0" />
      {leader ? (
        <svg ref={leaderRef} aria-hidden className="pointer-events-none absolute inset-0 hidden size-full text-foreground">
          <path d="" fill="none" stroke="currentColor" strokeWidth={1.5} />
          <circle r={5} className={overlayAt === 'card' ? 'fill-background' : 'fill-none'} stroke="currentColor" strokeWidth={2} />
        </svg>
      ) : null}
      {ready ? null : (
        <span className="absolute inset-0 flex items-center justify-center type-caption text-muted-foreground">
          {state === 'loading' ? t('bodyModel.loading') : t('bodyModel.error')}
        </span>
      )}
      {ready && controls && hint && !focusKey ? <p className="pointer-events-none absolute top-2.5 left-3 max-w-[132px] type-caption text-muted-foreground">{t('bodyModel.hint')}</p> : null}
      {ready && controls ? <ViewRail selected={angle} onSelect={(id) => api.current?.angle(id)} /> : null}
      {ready && controls && free && !overlay ? (
        <button
          type="button"
          onClick={() => api.current?.full()}
          className="absolute bottom-2.5 left-2.5 flex h-11 items-center gap-1.5 rounded-pill border border-subtle bg-background px-3.5 font-display text-[17px] font-bold text-foreground uppercase outline-none focus-visible:outline-2 focus-visible:outline-foreground"
        >
          <Icon name="rrotullo" size={18} />
          {t('bodyModel.fullView')}
        </button>
      ) : null}
      {ready && overlay ? (
        // Shiriti rreth emrit nuk i merr prekjet: vetëm vetë emri ose karta, modeli poshtë rrotullohet dhe zgjedh.
        <div
          ref={overlayRef}
          className={cn(
            'pointer-events-none absolute [&>*]:pointer-events-auto',
            overlayAt === 'card' ? 'bottom-2 left-2' : cn('inset-x-0 flex justify-center px-2', overlayAt === 'top' ? 'top-2' : 'bottom-0'),
          )}
        >
          {overlay}
        </div>
      ) : null}
    </div>
  )
}
