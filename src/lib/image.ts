// Kompresimi i fotove të progresit në telefon (SPEC §8): ana më e gjatë deri në 1600 px, JPEG.

export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Foto nga kamera ose galeria si JPEG i vogël; orientimi i EXIF-it zbatohet. */
export async function compressPhoto(file: Blob, max = 1600, quality = 0.82): Promise<{ data: ArrayBuffer; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const size = fitWithin(bitmap.width, bitmap.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Kompresimi i fotos nuk u arrit.')
  context.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Kompresimi i fotos nuk u arrit.')
  return { data: await blob.arrayBuffer(), ...size }
}
