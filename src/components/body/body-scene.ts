import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { boxCenter, limbCenters, morphPositions, SHAPE_MEASURES, type ShapeMeasure, type ShapeScales, sideBox, type Vec3 } from '@/body/body-shape'
import { focusShade } from '@/body/model-focus'
import { AURA_FROM, focusGlow, lookOf, type ModelLook } from '@/body/model-look'
import { hexToRgb, shadeRgb, type Tone } from '@/body/model-math'

// Skena e modelit 3D (SPEC §11, TH-05, V2-E1-14, V53), e përbashkët për shikuesin (body-model.tsx) dhe
// imazhet e palëvizshme (body-still.ts): BodyParts3D, një nyje për çdo çelës të Shtojcës D
// (public/anatomy/body.glb, nga tools/anatomy/build.mjs) dhe lëkura si siluetë. Ngjyrat vijnë nga
// tokenat e Vrullit të temës, të lexuara nga CSS-i i elementit: muskujt mbi `surface`, drita nga
// `model-light` (e bardhë në çdo temë; jo nga ngjyra e tekstit, që në Ditë do ta nxinte trupin),
// theksimi i fokusit drejt `model-light`, zbehja drejt `surface`. Pamja (V53; bordet "Trupi 3D · drita
// dhe kamera"): një dritë kryesore dhe dy drita konturi nga pas, lëkura si xham, muskujt me `glow`
// që ndriçojnë nga brenda me një aureolë rreth siluetës, dhe dyshemeja; vlerat te body/model-look.ts.
// Pa post-procesim dhe pa hije të llogaritura. Ngarkohet vetëm me three.js (lazy).

const MODEL_URL = `${import.meta.env.BASE_URL}anatomy/body.glb`

/** Muskuli pa vlerë: gri i errët mbi kartë, që forma të lexohet pa u ngatërruar me legjendën. */
export const BASE_TONE: Tone = { token: '--muted-foreground', alpha: 0.2 }
const SOLID = (token: string): Tone => ({ token, alpha: 1 })
/** Mbulesat e tejdukshme (Shtresat): gri, që të duken edhe mbi kartën e bardhë të Ditës. */
const GHOST_OPACITY = 0.22

export type MuscleMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
type AuraMesh = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>

export interface BodyMeshes {
  root: THREE.Group
  muscles: Map<string, MuscleMesh>
  skin: THREE.Mesh | null
  /** Pamja e temës ku u ngarkua modeli (e errët ose Ditë). */
  look: ModelLook
  /** Të përbashkëta për çdo aureolë: fortësia dhe gjerësia sipas largësisë së kamerës (`setAuraView`). */
  aura: { fade: { value: number }; scale: { value: number } }
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

/** Pamja e modelit për temën e elementit: karta `surface` e errët ose e çelët. */
export function readLook(element: Element) {
  return lookOf(hexToRgb(getComputedStyle(element).getPropertyValue('--surface')) ?? [0, 0, 0])
}

/**
 * Drita (V53): pak dritë e përgjithshme, një dritë kryesore nga lart-majtas e kamerës dhe dy drita
 * konturi nga pas, që nxjerrin relievin dhe skajet e trupit. Rrinë në vend ndërsa trupi rrotullohet,
 * pra ndjekin kamerën. Të gjitha `model-light`.
 */
export function addLights(scene: THREE.Scene, element: Element) {
  const look = readLook(element)
  const white = toneColor(element, SOLID('--model-light'))
  scene.add(new THREE.HemisphereLight(white, toneColor(element, SOLID(look.light ? '--muted-foreground' : '--surface')), look.hemisphere))
  const add = (x: number, y: number, z: number, intensity: number) => {
    const light = new THREE.DirectionalLight(white, intensity)
    light.position.set(x, y, z)
    scene.add(light)
  }
  add(-1.6, 2.0, 2.6, look.key)
  add(-2.6, 1.2, -2.4, look.rim)
  add(2.6, 0.6, -2.4, look.rim * 0.8)
}

// Kontura e ndritshme te skajet e muskulit (fresnel), e shtuar te drita që ai lëshon vetë.
const RIM_UNIFORM = 'uniform vec3 uRim;'
const RIM_LIGHT = 'totalEmissiveRadiance += uRim * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.4);'

function muscleMaterial(look: ModelLook) {
  const material = new THREE.MeshStandardMaterial({ roughness: look.roughness, metalness: 0 })
  const rim = { value: new THREE.Color(0, 0, 0) }
  material.userData.rim = rim
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = rim
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${RIM_UNIFORM}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n  ${RIM_LIGHT}`)
  }
  material.customProgramCacheKey = () => 'vrull-rim'
  return material
}

// Lëkura si xham: e tejdukshme përballë kamerës, e dukshme vetëm te skajet e siluetës.
const SKIN_VERTEX = `
varying float vEdge;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vEdge = 1.0 - abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`
const SKIN_FRAGMENT = `
uniform vec3 uColor;
uniform float uStrength;
varying float vEdge;
void main() {
  gl_FragColor = vec4(uColor, pow(vEdge, 2.6) * uStrength + 0.05);
}`

function skinMaterial(element: Element, look: ModelLook) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: toneColor(element, SOLID(look.light ? '--muted-foreground' : '--model-light')) }, uStrength: { value: look.skin } },
    vertexShader: SKIN_VERTEX,
    fragmentShader: SKIN_FRAGMENT,
    transparent: true,
    depthWrite: false,
  })
}

// Aureola: i njëjti muskul pak më i fryrë, i vizatuar nga brenda dhe i shtyrë pas tij përgjatë rrezes
// së shikimit, që të dalë vetëm rreth siluetës dhe jo mbi muskujt fqinjë.
const AURA_VERTEX = `
uniform float uWidth;
uniform float uPush;
uniform float uScale;
varying float vFacing;
void main() {
  vec3 moved = position + normal * uWidth * uScale;
  vec4 mv = modelViewMatrix * vec4(moved, 1.0);
  vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  mv.xyz += normalize(mv.xyz) * uPush * uScale;
  gl_Position = projectionMatrix * mv;
}`
const AURA_FRAGMENT = `
uniform vec3 uColor;
uniform float uStrength;
uniform float uFade;
uniform float uAdd;
varying float vFacing;
void main() {
  float glow = pow(vFacing, 1.6) * uStrength * uFade;
  gl_FragColor = vec4(uColor * mix(1.0, glow, uAdd), glow);
}`

function auraMaterial({ look, aura }: BodyMeshes) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color() },
      uStrength: { value: 0 },
      uFade: aura.fade,
      uScale: aura.scale,
      uWidth: { value: look.auraWidth },
      uPush: { value: look.auraPush },
      uAdd: { value: look.light ? 0 : 1 },
    },
    vertexShader: AURA_VERTEX,
    fragmentShader: AURA_FRAGMENT,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    // Temat e errëta: dritë e shtuar. Ditë: ngjyrë e tejdukshme mbi kartën e bardhë.
    ...(look.light ? { blending: THREE.NormalBlending } : { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }),
  })
}

/** Vendos ose heq aureolën e një muskuli; `glow` 0 e heq. Aureola ndan gjeometrinë e muskulit, pra ndjek edhe formën e matjeve. */
function setAura(mesh: MuscleMesh, glow: number, body: BodyMeshes) {
  let aura = mesh.userData.aura as AuraMesh | undefined
  if (glow <= 0) {
    if (aura) {
      mesh.remove(aura)
      aura.material.dispose()
      delete mesh.userData.aura
    }
    return
  }
  if (!aura) {
    aura = new THREE.Mesh(mesh.geometry, auraMaterial(body))
    aura.renderOrder = 3
    mesh.add(aura)
    mesh.userData.aura = aura
  }
  ;(aura.material.uniforms.uColor.value as THREE.Color).copy(mesh.material.color)
  aura.material.uniforms.uStrength.value = glow * body.look.aura
}

/** Aureola sipas largësisë së kamerës: `fade` e dobëson nga afër, `scale` e mban po aq të hollë në ekran. */
export function setAuraView(body: BodyMeshes, fade: number, scale: number) {
  body.aura.fade.value = fade
  body.aura.scale.value = scale
}

/** Modeli i analizuar, me materialet e Vrullit dhe kulmet origjinale të çdo muskuli (për formën). */
export async function loadBody(element: Element): Promise<BodyMeshes> {
  const buffer = await fetchModel()
  const gltf = await new GLTFLoader().parseAsync(buffer, '')
  const look = readLook(element)
  const muscles = new Map<string, MuscleMesh>()
  let skin: THREE.Mesh | null = null
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const mesh = object as MuscleMesh
    mesh.geometry.computeVertexNormals()
    if (mesh.name === 'skin') {
      // Lëkura: siluetë si xham, që nuk fsheh muskujt dhe nuk kap prekjen.
      object.material = skinMaterial(element, look)
      object.renderOrder = 1
      skin = object
    } else {
      mesh.material = muscleMaterial(look)
      mesh.userData.base = Float32Array.from(mesh.geometry.getAttribute('position').array)
      muscles.set(mesh.name, mesh)
    }
  })
  return { root: gltf.scene, muscles, skin, look, aura: { fade: { value: 1 }, scale: { value: 1 } } }
}

/**
 * Ngjyrat e muskujve: toni i çdo çelësi (ose muskuli pa vlerë), theksimi i fokusit, shkëlqimi i
 * toneve me `glow` (drita nga brenda, kontura dhe aureola; gjatë fokusit vetëm te i zgjedhuri) dhe
 * mbulesat e tejdukshme të Shtresave, që nuk kapin prekjen dhe nuk ndriçojnë.
 */
export function paintMuscles(element: Element, body: BodyMeshes, paint: (key: string) => Tone | null, focused: string[] | null, ghost: ReadonlySet<string> = new Set()) {
  const { look } = body
  const white = toneColor(element, SOLID('--model-light'))
  for (const [name, mesh] of body.muscles) {
    const material = mesh.material
    const ghosted = ghost.has(name)
    const tone = paint(name) ?? BASE_TONE
    const inFocus = focused ? focused.includes(name) : null
    const glow = ghosted ? 0 : focusGlow(tone.glow, inFocus)
    if (ghosted) toneColor(element, SOLID('--muted-foreground'), material.color)
    else toneColor(element, tone, material.color, focusShade(inFocus, tone.glow))
    material.emissive.copy(material.color)
    material.emissiveIntensity = glow * look.emissive
    const rim = (material.userData.rim as { value: THREE.Color }).value
    if (glow > 0) rim.copy(material.color).multiplyScalar(glow * look.fresnel)
    else rim.copy(white).multiplyScalar(look.fresnelBase)
    setAura(mesh, glow >= AURA_FROM ? glow : 0, body)
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

/** Maska e dyshemesë: e plotë në mes, e zbehur drejt skajit. Vetëm alfa, ngjyrën e jep materiali. */
function groundMask() {
  const size = 128
  const data = new Uint8Array(size * size * 4).fill(255)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.min(1, Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2))
      const alpha = radius < 0.45 ? 1 - (radius / 0.45) * 0.55 : 0.45 * (1 - (radius - 0.45) / 0.55)
      data[(y * size + x) * 4 + 3] = Math.round(alpha * 255)
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/** Dyshemeja (V53): një pellg i butë drite poshtë këmbëve në temat e errëta, hije në Ditë, që trupi të mos rrijë pezull. */
export function addGround(scene: THREE.Scene, element: Element, body: BodyMeshes) {
  const feet = new THREE.Box3().setFromObject(body.skin ?? body.root).min.y
  const color = toneColor(element, SOLID(body.look.light ? '--foreground' : '--model-light'))
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), new THREE.MeshBasicMaterial({ map: groundMask(), color, transparent: true, opacity: body.look.ground, depthWrite: false }))
  disc.rotation.x = -Math.PI / 2
  disc.position.set(0, feet + 0.004, 0)
  disc.renderOrder = -1
  scene.add(disc)
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

/**
 * Qendrat e disa muskujve në koordinatat e trupit, veç për secilën anë (vija e kartës së muskulit bie
 * mbi muskulin, jo mes dy anëve); kur muskujt janë vetëm në njërën anë, qendra e të gjithëve.
 */
export function sidePoints(muscles: Map<string, MuscleMesh>, keys: string[]): Vec3[] {
  const arrays = keys.flatMap((key) => {
    const mesh = muscles.get(key)
    return mesh ? [mesh.geometry.getAttribute('position').array] : []
  })
  const sides = (['left', 'right'] as const).map((side) => sideBox(arrays, side)).filter((box) => box !== null)
  if (sides.length === 2) return sides.map(boxCenter)
  const all = sideBox(arrays, 'all')
  return all ? [boxCenter(all)] : []
}

/** Liron gjeometritë, materialet dhe teksturat e një skene. */
export function disposeScene(scene: THREE.Object3D) {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      const material = object.material as THREE.Material & { map?: THREE.Texture | null }
      material.map?.dispose()
      material.dispose()
    }
  })
}
