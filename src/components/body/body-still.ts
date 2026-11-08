import * as THREE from 'three'
import type { ShapeMeasure, ShapeScales, Vec3 } from '@/body/body-shape'
import { FIELD_OF_VIEW_DEGREES, fitView } from '@/body/model-focus'
import type { Tone } from '@/body/model-math'
import { addLights, boxOf, disposeScene, loadBody, paintMuscles, regionPoints, shapeMuscles } from './body-scene'

// Imazhe të palëvizshme të modelit 3D (V2-E1-14): trupi i plotë përpara (ose mbrapa), me ngjyrat dhe
// formën e çdo kuadri, i renderuar një herë dhe i shfaqur si <img>. "Trupi sipas matjeve" krahason
// kështu Javën 0 me sot; "Trupi në ritëm" (E1-12, SPEC V29) mund të renderojë dy pamjet e pulsit dhe
// t'i ndërrojë me CSS, pa WebGL në çdo goditje. Ngarkohet me `import()` vetëm kur ka WebGL.

export interface StillFrame {
  /** Toni i çdo çelësi; pa të, muskujt pa vlerë. */
  paint?: (key: string) => Tone | null
  /** Raporti i perimetrave (Trupi sipas matjeve); pa të, modeli origjinal. */
  shape?: ShapeScales
  back?: boolean
}

/** Një pikë e zonës në imazh, në px nga cepi i sipërm majtas. */
export type StillPoint = [number, number]

export interface Still {
  /** Adresa `blob:` e imazhit PNG; thirrësi e liron me URL.revokeObjectURL. */
  url: string
  /** Pikat e çdo zone të matjeve: në mes të trupit dhe te secila anë (ana e majtë e imazhit e para). */
  points: Partial<Record<ShapeMeasure, { mid: StillPoint; sides: StillPoint[] }>>
}

/**
 * Renderon kuadrot me një kontekst WebGL dhe e liron menjëherë (WebView-i lejon pak kontekste).
 * `element` jep tokenat e temës (ngjyrat lexohen nga CSS-i i tij); `size` në px CSS.
 */
export async function renderBodyStills(element: Element, frames: StillFrame[], size: { width: number; height: number }): Promise<Still[]> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' })
  const scene = new THREE.Scene()
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(size.width, size.height, false)
    renderer.setClearColor(0, 0)
    const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW_DEGREES, size.width / size.height, 0.1, 20)
    addLights(scene, camera, element)
    const body = await loadBody(element)
    scene.add(body.root)
    // Kamera e nxë gjithë trupin (lëkurën), me krahët, në formën e imazhit.
    const outline = body.skin ? new THREE.Box3().setFromObject(body.skin) : boxOf(body.muscles, [...body.muscles.keys()])!
    const fit = fitView({ min: outline.min.toArray(), max: outline.max.toArray() }, size.width / size.height)
    camera.position.set(0, fit.height, fit.distance)
    camera.lookAt(0, fit.height, 0)
    camera.updateMatrixWorld()

    const stills: Still[] = []
    for (const frame of frames) {
      paintMuscles(element, body.muscles, frame.paint ?? (() => null), null)
      shapeMuscles(body.muscles, frame.shape ?? {})
      body.root.rotation.y = frame.back ? Math.PI : 0
      body.root.updateMatrixWorld()
      renderer.render(scene, camera)
      const blob = await new Promise<Blob | null>((resolve) => renderer.domElement.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Imazhi i modelit nuk u krijua')
      const project = ([x, y, z]: Vec3): StillPoint => {
        const point = body.root.localToWorld(new THREE.Vector3(x, y, z)).project(camera)
        return [((point.x + 1) / 2) * size.width, ((1 - point.y) / 2) * size.height]
      }
      const points: Still['points'] = {}
      for (const [id, region] of Object.entries(regionPoints(body.muscles))) {
        const sides = [region.left, region.right].filter((side): side is Vec3 => side !== null).map(project)
        points[id as ShapeMeasure] = { mid: project(region.mid), sides: sides.sort((a, b) => a[0] - b[0]) }
      }
      stills.push({ url: URL.createObjectURL(blob), points })
    }
    return stills
  } finally {
    disposeScene(scene)
    renderer.dispose()
    renderer.forceContextLoss()
  }
}
