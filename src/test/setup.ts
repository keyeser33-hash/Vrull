import { configure } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
// IndexedDB në memorie për testet e bazës lokale (Dexie).
import 'fake-indexeddb/auto'

// Pritjet e Testing Library (findBy*, waitFor) për gjithë provat, në një vend. Ekranet lexojnë nga
// IndexedDB në memorie dhe ngarkojnë modulet me import(): kur disa procese provash ecin njëherësh
// në të njëjtat bërthama, një lexim që zgjat 300 ms vetëm mund të zgjasë dhjetëra sekonda. Parazgjedhja
// 1 s dështonte herë pas here; një pritje e gjatë nuk e ngadalëson provën që kalon, sepse waitFor
// mbaron sapo kushti plotësohet. Koha e provës dhe e hook-ëve: `test.testTimeout` te vite.config.ts.
configure({ asyncUtilTimeout: 60_000 })
