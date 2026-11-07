import { createClient } from '@supabase/supabase-js'

// Projekti training-hub. Çelësi "publishable" është bërë për t'u përfshirë në app: vetëm
// politikat RLS vendosin çfarë lexon ose shkruan secili, dhe pa hyrje nuk lexohet asgjë.
// Prova në emulator ndërton me VITE_SUPABASE_URL=https://smoke.invalid dhe i imiton përgjigjet,
// që asnjë kërkesë prove të mos arrijë te projekti i vërtetë (scripts/android-smoke.mjs).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || 'https://hxwkyhfqcadtipkpopnq.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ifgYyLvgDITa1NZo_lCVZw_SVLHlwv1'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Sesioni ruhet në telefon: pas hyrjes së parë app-i punon edhe pa internet.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
