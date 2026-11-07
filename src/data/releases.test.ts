import { createReleaseRemote } from './releases'

// Ruajtja e versioneve (bucket-i app-releases) si e sheh përditësuesi.
function storage(download: () => Promise<{ data: Blob | null; error: { message: string; statusCode?: string } | null }>) {
  return {
    download: vi.fn(download),
    createSignedUrl: vi.fn(async (path: string, seconds: number) => ({ data: { signedUrl: `https://x/${path}?ttl=${seconds}` }, error: null })),
  }
}

describe('versionet te Supabase', () => {
  it('latest.json lexohet si JSON', async () => {
    const remote = createReleaseRemote(storage(async () => ({ data: new Blob(['{"version":"0.16.0"}']), error: null })))
    expect(await remote.latest()).toEqual({ version: '0.16.0' })
  })

  it('para versionit të parë (404) nuk ka përditësim; çdo gabim tjetër hidhet', async () => {
    expect(await createReleaseRemote(storage(async () => ({ data: null, error: { message: 'Object not found', statusCode: '404' } }))).latest()).toBeNull()
    expect(await createReleaseRemote(storage(async () => ({ data: null, error: { message: 'not found' } }))).latest()).toBeNull()
    await expect(createReleaseRemote(storage(async () => ({ data: null, error: { message: 'JWT expired', statusCode: '401' } }))).latest()).rejects.toThrow('JWT')
  })

  it('lidhja e shkarkimit është e firmosur për 10 minuta', async () => {
    const files = storage(async () => ({ data: null, error: null }))
    expect(await createReleaseRemote(files).downloadUrl('TrainingHub-0.16.0.apk')).toBe('https://x/TrainingHub-0.16.0.apk?ttl=600')
  })
})
