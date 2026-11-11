import { safeStorage } from './safe-storage'

// Ndihma e gjesteve të modelit 3D ("Ktheje me një gisht, zmadhoje me dy.", V53): shfaqet derisa
// përdoruesi ta ketë kthyer ose zmadhuar modelin një herë. Mbahet vetëm në telefon, si tema.

const STORAGE_KEY = 'th-model-hint'

export const modelHint = {
  seen: () => safeStorage.getItem(STORAGE_KEY) === '1',
  dismiss: () => safeStorage.setItem(STORAGE_KEY, '1'),
}
