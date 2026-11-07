// @vitest-environment node
import { latestJson, releaseNotes, staleApks } from './publish-update.mjs'

describe('publikimi i përditësimit brenda app-it', () => {
  it('shënimet: titujt e commit-eve pa "Versioni …", pa biletat dhe pa përsëritje', () => {
    expect(
      releaseNotes([
        'Versioni 0.15.0: përditësimi brenda app-it',
        'Përditësimi brenda app-it: njoftimi te Sot dhe instalimi nga app-i (TH-23)',
        'Trupi në 3D: muskujt e ushtrimit (TH-19)',
        'Trupi në 3D: muskujt e ushtrimit (TH-19)',
        '',
      ]),
    ).toEqual(['Përditësimi brenda app-it: njoftimi te Sot dhe instalimi nga app-i', 'Trupi në 3D: muskujt e ushtrimit'])
  })

  it('latest.json ka formën që pret app-i', () => {
    expect(latestJson({ version: '0.15.0', sha256: 'A'.repeat(64), bytes: 1000, notes: ['x'], publishedAt: '2026-11-08T10:00:00.000Z' })).toEqual({
      version: '0.15.0',
      apk: 'TrainingHub-0.15.0.apk',
      sha256: 'a'.repeat(64),
      bytes: 1000,
      notes: ['x'],
      publishedAt: '2026-11-08T10:00:00.000Z',
    })
  })

  it('mbahen vetëm dy APK-të më të reja', () => {
    expect(staleApks(['TrainingHub-0.9.0.apk', 'latest.json', 'TrainingHub-0.15.0.apk', 'TrainingHub-0.10.0.apk', 'TrainingHub-0.14.0.apk'])).toEqual([
      'TrainingHub-0.10.0.apk',
      'TrainingHub-0.9.0.apk',
    ])
  })
})
