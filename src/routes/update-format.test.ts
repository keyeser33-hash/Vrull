import { i18nFor, NBSP } from '@/i18n'
import type { Release } from '@/update/updater'
import { failureText, megabytes, updateDetail, versionRowDetail } from './update-format'

const release = { version: '0.16.0', apk: 'TrainingHub-0.16.0.apk', sha256: 'a'.repeat(64), bytes: 28_336_570, notes: [], publishedAt: '' } satisfies Release

describe('tekstet e përditësimit', () => {
  it('rreshti te Sot dhe te Cilësimet thonë gjendjen me fjalë', () => {
    expect(updateDetail({ status: 'available', release })).toBe('Shiko çfarë ka të re')
    expect(updateDetail({ status: 'downloading', release, progress: 0.999 })).toBe('Po shkarkohet · 100%')
    expect(updateDetail({ status: 'failed', reason: 'check' })).toBeNull()
    expect(updateDetail({ status: 'idle' })).toBeNull()
    expect(versionRowDetail({ status: 'available', release })).toBe('0.16.0 është gati')
    expect(versionRowDetail({ status: 'failed', reason: 'install', release })).toBe('0.16.0 është gati')
    expect(versionRowDetail({ status: 'current' })).toBe('I fundit')
    expect(versionRowDetail({ status: 'installing', release })).toBe('Po instalohet')
    expect(megabytes(28_336_570)).toBe(`27${NBSP}MB`)
    expect(failureText('mismatch')).toMatch(/nuk përputhet/)
  })

  it('në anglisht', () => {
    const en = i18nFor('en')
    expect(updateDetail({ status: 'available', release }, en)).toBe('See what’s new')
    expect(updateDetail({ status: 'downloading', release, progress: 0.456 }, en)).toBe('Downloading · 46%')
    expect(versionRowDetail({ status: 'available', release }, en)).toBe('0.16.0 is ready')
    expect(versionRowDetail({ status: 'current' }, en)).toBe('Up to date')
    expect(failureText('download', en)).toBe('The download did not finish. Check your internet and try again.')
  })
})
