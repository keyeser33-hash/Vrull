// localStorage mund të mungojë ose të hedhë gabim (p.sh. modalitet privat, pamje paraprake);
// atëherë vlera mbahet në kujtesë për këtë vizitë. Për parapëlqime të vogla të telefonit, jo për të dhëna.

const memory = new Map<string, string>()

export const safeStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem(key) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return memory.get(key) ?? null
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      memory.set(key, value)
    }
  },
  removeItem(key) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      memory.delete(key)
    }
  },
}
