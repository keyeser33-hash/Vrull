import { open } from './cdp.mjs'
const b = await open()
try {
  await b.go('/')
  await b.sleep(3000)
  console.log(await b.evaluate(`(async () => {
    const dbs = await indexedDB.databases()
    const out = []
    for (const info of dbs) {
      const db = await new Promise((res, rej) => { const r = indexedDB.open(info.name); r.onsuccess = () => res(r.result); r.onerror = rej })
      const names = [...db.objectStoreNames]
      if (names.includes('daily_states')) {
        await new Promise((res, rej) => { const tx = db.transaction(['daily_states', '_meta', 'daily_choices'], 'readwrite'); tx.objectStore('daily_states').clear(); tx.objectStore('daily_choices').clear(); const meta = tx.objectStore('_meta'); const c = meta.openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { if (/stories-seen|checkin-draft|checkin-skip/.test(String(cur.key))) cur.delete(); cur.continue() } }; tx.oncomplete = res; tx.onerror = rej })
        out.push(info.name + ' reset')
      }
      db.close()
    }
    return out.join(',')
  })()`))
} finally { await b.close() }
