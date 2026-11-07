// Publikon versionin e ri për përditësimin brenda app-it (SPEC §3b, TH-23): APK-ja dhe latest.json
// te bucket-i privat app-releases i Supabase-it, që app-i i lexon me sesionin e përdoruesit.
// Përdorimi (GitHub Actions, pas Release-it):
//   SUPABASE_SECRET_KEY=… node scripts/publish-update.mjs <APK> <versioni> [shënimet.txt]
// Pa SUPABASE_SECRET_KEY nuk publikon asgjë dhe nuk dështon: Release-i në GitHub mbetet.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BUCKET = 'app-releases'
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hxwkyhfqcadtipkpopnq.supabase.co'
const APK_NAME = /^TrainingHub-(\d+)\.(\d+)\.(\d+)\.apk$/

/** Titujt e commit-eve që nga versioni i kaluar, si "Çfarë ka të re". */
export function releaseNotes(subjects) {
  const notes = subjects
    .map((subject) => subject.replace(/\s*\((TH-\d+(,\s*TH-\d+)*)\)\s*$/, '').trim())
    .filter((subject) => subject && !/^Versioni \d+\.\d+\.\d+/.test(subject))
  return [...new Set(notes)].slice(0, 12)
}

export function latestJson({ version, sha256, bytes, notes, publishedAt }) {
  return { version, apk: `TrainingHub-${version}.apk`, sha256: sha256.toLowerCase(), bytes, notes, publishedAt }
}

/** APK-të që hiqen nga bucket-i: mbahen dy më të rejat (e reja dhe e mëparshmja). */
export function staleApks(names) {
  const key = (name) => APK_NAME.exec(name).slice(1).map(Number)
  const newestFirst = names
    .filter((name) => APK_NAME.test(name))
    .sort((a, b) => {
      const [x, y] = [key(a), key(b)]
      return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]
    })
  return newestFirst.slice(2)
}

async function main() {
  const [apkPath, version, notesPath] = process.argv.slice(2)
  if (!apkPath || !version) throw new Error('Përdorimi: node scripts/publish-update.mjs <APK> <versioni> [shënimet.txt]')
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) {
    console.log('::warning title=Përditësimi brenda app-it::Mungon SUPABASE_SECRET_KEY; versioni nuk u publikua te app-i (shih docs/INSTALL.md).')
    return
  }
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const storage = supabase.storage.from(BUCKET)
  const apk = readFileSync(apkPath)
  const release = latestJson({
    version,
    sha256: createHash('sha256').update(apk).digest('hex'),
    bytes: apk.length,
    notes: notesPath ? releaseNotes(readFileSync(notesPath, 'utf8').split('\n')) : [],
    publishedAt: new Date().toISOString(),
  })

  // APK-ja e para, latest.json pas saj: app-i nuk sheh kurrë një version pa skedarin e tij.
  const uploaded = await storage.upload(release.apk, apk, { contentType: 'application/vnd.android.package-archive', upsert: true })
  if (uploaded.error) throw uploaded.error
  const json = await storage.upload('latest.json', Buffer.from(JSON.stringify(release, null, 2)), {
    contentType: 'application/json',
    cacheControl: '60',
    upsert: true,
  })
  if (json.error) throw json.error

  const listed = await storage.list('', { limit: 100 })
  if (listed.error) throw listed.error
  const stale = staleApks(listed.data.map((file) => file.name))
  if (stale.length) {
    const removed = await storage.remove(stale)
    if (removed.error) throw removed.error
  }
  console.log(JSON.stringify({ published: release.apk, sha256: release.sha256, notes: release.notes.length, removed: stale }))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`::error title=Përditësimi brenda app-it::${error.message ?? error}`)
    process.exit(1)
  })
}
