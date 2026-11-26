import { portionSq } from './portion-sq'

describe('emri shqip i porcionit', () => {
  it.each([
    ['1 cup', '1 filxhan'],
    ['1 cup (8 fl oz)', '1 filxhan'],
    ['1 cup, cooked, diced', '1 filxhan, gatuar, prerë kubikë'],
    ['1 cup slices', '1 filxhan, feta'],
    ['1 cup, NFS', '1 filxhan'],
    ['1 cup (1" pieces)', '1 filxhan'],
    ['1 tbsp', '1 lugë gjelle'],
    ['1 large', '1 copë e madhe'],
    ['1 large fillet', '1 fileto e madhe'],
    ['1 medium slice', '1 fetë mesatare'],
    ['1 egg white', '1 e bardhë veze'],
    ['1 serving 1/2 cup', '1 porcion'],
    ['1 serving ( 3 oz )', '1 porcion'],
    ['1 thigh without skin', '1 kofshë, pa lëkurë'],
    ['1 sandwich, any size', '1 sanduiç'],
  ])('%s → %s', (label, expected) => {
    expect(portionSq(label)).toBe(expected)
  })

  it.each(['1 oz', '1 fl oz', '1 lb', '1 cubic inch', '1 surface inch', '1 oz, cooked', '1 can (303 x 406) yields', '1 rack', '2 tablespoon'])('%s mbetet pa etiketë', (label) => {
    expect(portionSq(label)).toBeNull()
  })
})
