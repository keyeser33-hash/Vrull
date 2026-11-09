/**
 * Id (UUID) nga një çelës natyror unik: dy telefona që krijojnë të njëjtin rresht pa u sinkronizuar
 * shkruajnë të njëjtin rresht, jo dy (MESIMET › Rishikimi i kodit). Çelësi duhet të jetë unik në gjithë
 * bazën, jo vetëm te një përdorues: një id ose përdoruesi brenda tij.
 */
export async function naturalId(parts: readonly (string | number)[]): Promise<string> {
  const text = parts.join('|')
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 16)
  hash[6] = (hash[6] & 0x0f) | 0x80
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
