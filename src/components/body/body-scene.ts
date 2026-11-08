import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { boxCenter, limbCenters, morphPositions, SHAPE_MEASURES, type ShapeMeasure, type ShapeScales, sideBox, type Vec3 } from '@/body/body-shape'
import { focusShade } from '@/body/model-focus'
import { hexToRgb, shadeRgb, type Tone } from '@/body/model-math'

// Skena e modelit 3D (SPEC §11, TH-05, V2-E1-14), e përbashkët për shikuesin (body-model.tsx) dhe
// imazhet e palëvizshme (body-still.ts): BodyParts3D, një nyje për çdo çelës të Shtojcës D
// (public/anatomy/body.glb, nga tools/anatomy/build.mjs) dhe lëkura si siluetë. Ngjyrat vijnë nga
// tokenat e Vrullit të temës, të lexuara nga CSS-i i elementit: muskujt mbi `surface`, drita nga
// `model-light` (e bardhë në çdo temë; jo nga ngjyra e tekstit, që në Ditë do ta nxinte trupin),
// theksimi i fokusit drejt `model-light`, zbehja drejt `surface`. Ngarkohet vetëm me three.js (lazy).

const MODEL_URL = `${import.meta.env.BASE_URL}anatomy/body.glb`

/** Muskuli pa vlerë: gri i errët mbi kartë, që forma të lexohet pa u ngatërruar me legjendën. */
export const BASE_TONE: Tone = { token: '--muted-foreground', alpha: 0.2 }
const SOLID = (token: string): Tone => ({ token, alpha: 1 })
/** Mbulesat e tejdukshme (Shtresat): gri, që të duken edhe mbi kartën e bardhë të Ditës. */
const GHOST_OPACITY = 0.22
const SKIN_OPACITY = 0.12

export type MuscleMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>

export interface BodyMeshes {
  root: THREE.Group
  muscles: Map<string, MuscleMesh>
  skin: MuscleMesh | null
}

// GLB-ja shkarkohet një herë; çdo skenë e analizon vetë, që të mos ndajë gjeometri me një skenë që
// lirohet. Pas një gabimi provohet sërish herën tjetër.
let source: Promise<ArrayBuffer> | null = null
function fetchModel() {
  source ??= fetch(MODEL_URL).then((response) => {
    if (!response.ok) throw new Error(`body.glb: ${response.status}`)
    return response.arrayBuffer()
  })
  source.catch(() => {
    source = null
  })
  return source
}

/** Ngjyra e një toni mbi kartë, me theksimin ose zbehjen e fokusit, në ngjyrën e three.js. */
export function toneColor(element: Element, tone: Tone, target = new THREE.Color(), shade = focusShade(null)) {
  const style = getComputedStyle(element)
  const read = (token: string) => hexToRgb(style.getPropertyValue(token))
  const surface = read('--surface') ?? [0, 0, 0]
  const palette = { panel: surface, color: read(tone.token) ?? surface, foreground: read('--model-light') ?? [1, 1, 1] }
  const [r, g, b] = shadeRgb(palette, tone.alpha, shade)
  return target.setRGB(r, g, b, THREE.SRGBColorSpace)
}

/** Drita: `model-light` nga sipër dhe nga kamera, gri poshtë, që forma e muskujve të lexohet. */
export function addLights(scene: THREE.Scene, camera: THREE.Camera, element: Element) {
  scene.add(new THREE.HemisphereLight(toneColor(element, SOLID('--model-light')), toneColor(element, SOLID('--muted-foreground')), 2.2))
  const light = new THREE.DirectionalLight(toneColor(element, SOLID('--model-light')), 1.6)
  light.position.set(1.5, 2.5, 3)
  camera.add(light)
  scene.add(camera)
}

/** Modeli i analizuar, me materialet e Vrullit dhe kulmet origjinale të çdo muskuli (për formën). */
export async function loadBody(element: Element): Promise<BodyMeshes> {
  const buffer = await fetchModel()
  const gltf = await new GLTFLoader().parseAsync(buffer, '')
  const muscles = new Map<string, MuscleMesh>()
  let skin: MuscleMesh | null = null
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const mesh = object as MuscleMesh
    mesh.geometry.computeVertexNormals()
    if (mesh.name === 'skin') {
      // Lëkura: siluetë e tejdukshme që nuk fsheh muskujt dhe nuk kap prekjen.
      mesh.material = new THREE.MeshStandardMaterial({ transparent: true, opacity: SKIN_OPACITY, depthWrite: false, roughness: 1 })
      toneColor(element, SOLID('--muted-foreground'), mesh.material.color)
      mesh.renderOrder = 1
      skin = mesh
    } else {
      mesh.material = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 })
      mesh.userData.base = Float32Array.from(mesh.geometry.getAttribute('position').array)
      muscles.set(mesh.name, mesh)
    }
  })
  return { root: gltf.scene, muscles, skin }
}

/**
 * Ngjyrat e muskujve: toni i çdo çelësi (ose muskuli pa vlerë), theksimi i fokusit dhe mbulesat e
 * tejdukshme të Shtresave, që nuk kapin prekjen.
 */
export function paintMuscles(
  element: Element,
  muscles: Map<string, MuscleMesh>,
  paint: (key: string) => Tone | null,
  focused: string[] | null,
  ghost: ReadonlySet<string> = new Set(),
) {
  for (const [name, mesh] of muscles) {
    const material = mesh.material
    const ghosted = ghost.has(name)
    if (ghosted) toneColor(element, SOLID('--muted-foreground'), material.color)
    else toneColor(element, paint(name) ?? BASE_TONE, material.color, focusShade(focused ? focused.includes(name) : null))
    mesh.userData.ghost = ghosted
    mesh.renderOrder = ghosted ? 2 : 0
    material.opacity = ghosted ? GHOST_OPACITY : 1
    // Programi i materialit rindërtohet vetëm kur ndryshon tejdukshmëria, jo me çdo ngjyrë.
    if (material.transparent !== ghosted) {
      material.transparent = ghosted
      material.depthWrite = !ghosted
      material.needsUpdate = true
    }
  }
}

const baseOf = (mesh: MuscleMesh) => mesh.userData.base as Float32Array

/**
 * Trupi sipas matjeve: muskujt e çdo zone largohen nga boshti i saj me raportin e perimetrit (1 =
 * modeli origjinal). Gjithnjë nga kulmet origjinale, që ndryshimet të mos mblidhen.
 */
export function shapeMuscles(muscles: Map<string, MuscleMesh>, scales: ShapeScales) {
  for (const measure of SHAPE_MEASURES) {
    const meshes = measure.muscles.map((key) => muscles.get(key)).filter((mesh): mesh is MuscleMesh => Boolean(mesh))
    if (meshes.length === 0) continue
    const scale = scales[measure.id] ?? 1
    const centers = measure.axis === 'trunk' ? ([0, 0] as [number, number]) : limbCenters(meshes.map(baseOf))
    for (const mesh of meshes) {
      const attribute = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      ;(attribute.array as Float32Array).set(morphPositions(baseOf(mesh), scale, centers))
      attribute.needsUpdate = true
      mesh.geometry.computeVertexNormals()
      mesh.geometry.computeBoundingBox()
      mesh.geometry.computeBoundingSphere()
    }
  }
}

export interface RegionPoints {
  mid: Vec3
  left: Vec3 | null
  right: Vec3 | null
}

/** Pikat e çdo zone të matjeve (në mes dhe te secila anë), nga forma e tanishme e muskujve. */
export function regionPoints(muscles: Map<string, MuscleMesh>): Partial<Record<ShapeMeasure, RegionPoints>> {
  const points: Partial<Record<ShapeMeasure, RegionPoints>> = {}
  for (const measure of SHAPE_MEASURES) {
    const arrays = measure.muscles.flatMap((key) => {
      const mesh = muscles.get(key)
      return mesh ? [mesh.geometry.getAttribute('position').array] : []
    })
    const all = sideBox(arrays, 'all')
    if (!all) continue
    const side = (which: 'left' | 'right') => {
      const box = sideBox(arrays, which)
      return box ? boxCenter(box) : null
    }
    // Në mes: boshti i trupit, në lartësinë e zonës dhe para saj.
    const [, y] = boxCenter(all)
    points[measure.id] = { mid: [0, y, all.max[2]], left: side('left'), right: side('right') }
  }
  return points
}

/** Kutia e disa muskujve në koordinatat e trupit (para rrotullimit). */
export function boxOf(muscles: Map<string, MuscleMesh>, keys: string[]) {
  const box = new THREE.Box3()
  for (const key of keys) {
    const mesh = muscles.get(key)
    if (!mesh) continue
    mesh.geometry.computeBoundingBox()
    box.union(mesh.geometry.boundingBox!)
  }
  return box.isEmpty() ? null : box
}

/** Liron gjeometritë dhe materialet e një skene. */
export function disposeScene(scene: THREE.Object3D) {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      ;(object.material as THREE.Material).dispose()
    }
  })
}
