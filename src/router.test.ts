/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RouteObject } from 'react-router'
import { routes } from '@/router'

// Ndarja e paketës (V2-E1-16a): ekranet ngarkohen kur hapet rruga, që paketa e nisjes të mbetet nën
// kufirin e paralajmërimit (800 kB, vite.config.ts); korniza dhe porta mbeten në nisje.

const flatten = (list: RouteObject[]): RouteObject[] => list.flatMap((route) => [route, ...flatten(route.children ?? [])])

describe('rrugët', () => {
  it('router-i nuk i importon ekranet drejtpërdrejt, përveç portës dhe ridrejtimit', () => {
    const source = readFileSync(join(process.cwd(), 'src/router.tsx'), 'utf8')
    const eager = [...source.matchAll(/^import .* from '@\/routes\/([^']+)'/gm)].map((match) => match[1])
    expect(eager.sort()).toEqual(['gate', 'moved'])
  })

  it('çdo ekran ngarkohet kur hapet, me një vend bosh për hapjen e parë', async () => {
    const screens = flatten(routes).filter((route) => route.lazy)
    expect(screens.length).toBeGreaterThan(30)
    for (const route of screens) {
      expect(route.hydrateFallbackElement, route.path).toBeDefined()
      expect(route.element, route.path).toBeUndefined()
    }
    const today = flatten(routes).find((route) => route.index)!
    const loaded = await (today.lazy as () => Promise<{ Component: unknown }>)()
    expect(loaded.Component).toBeTypeOf('function')
  })
})
