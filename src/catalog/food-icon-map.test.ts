import { describe, expect, it } from 'vitest'
import common from './data/foods-common.json'
import rest from './data/foods-rest.json'
import { foodIcon, foodIconFromNames } from './food-icon-map'
import { FOOD_ICONS } from './food-icons'

type Part = { groups: string[]; rows: unknown[][] }

describe('ikona e një ushqimi të Listës', () => {
  it.each([
    ['Egg, whole, raw, fresh', 'Dairy and Egg Products', 'veze'],
    ['Eggplant, flesh and skin, roasted/baked', 'Vegetables and Vegetable Products', 'kastravec'],
    ['Apples, red delicious, with skin, raw', 'Fruits and Fruit Juices', 'molle'],
    ['Apple juice, canned or bottled', 'Fruits and Fruit Juices', 'pije'],
    ['Bananas, raw', 'Fruits and Fruit Juices', 'banane'],
    ['Chicken, thigh, boneless, skinless, raw', 'Poultry Products', 'pule'],
    ['KFC, Fried Chicken, EXTRA CRISPY, Drumstick, meat and skin with breading', 'Fast Foods', 'pule'],
    ['Soup, chicken noodle, canned', 'Soups, Sauces, and Gravies', 'supe'],
    ['Swedish meatballs with cream or white sauce', 'Meat mixed dishes', 'mish'],
    ['Peaches, spiced, canned, heavy syrup pack, solids and liquids', 'Fruits and Fruit Juices', 'pjeshke'],
    ['Milk shakes, thick vanilla', 'Dairy and Egg Products', 'qumesht'],
    ['Ice cream bar, stick or nugget, with crunch coating', 'Ice cream and frozen dairy desserts', 'akullore'],
    ['Nutrition bar (PowerBar)', 'Nutrition bars', 'shufer'],
    ['Sweet pepper, yellow, raw', 'Vegetable', 'spec'],
    ['Spices, pepper, black', 'Spices and Herbs', 'ereza'],
    ['Fish, salmon, Atlantic, farmed, cooked, dry heat', 'Finfish and Shellfish Products', 'peshk'],
    ['Cheese, cheddar', 'Dairy and Egg Products', 'djathe'],
    ['Peanut butter, smooth style, with salt', 'Legumes and Legume Products', 'salce'],
    ['Spinach byrek', 'Albanian dishes', 'byrek'],
    ['Imam bayildi', 'Albanian dishes', 'gjelle'],
  ])('%s → %s', (name, group, icon) => {
    expect(foodIcon(name, group).icon).toBe(icon)
  })

  it('emri pa formë merr ikonën e grupit, dhe pa grup pjatën e përgjithshme', () => {
    expect(foodIcon('Knockwurst', 'Sausages and Luncheon Meats')).toEqual({ icon: 'sallam', tier: 'grupi' })
    expect(foodIcon('Mirepoix', 'Not included in a food category')).toEqual({ icon: 'pjata', tier: 'pjata' })
  })

  it('çdo ushqim i Listës merr një ikonë të vizatuar; të zakonshmet nuk mbeten me pjatën e përgjithshme', () => {
    const count = (part: Part) => {
      let plain = 0
      for (const row of part.rows) {
        const { icon, tier } = foodIcon(row[1] as string, part.groups[row[3] as number] ?? '')
        if (!(icon in FOOD_ICONS)) throw new Error(`ikonë pa vizatim: ${icon}`)
        if (tier === 'pjata') plain += 1
      }
      return plain
    }
    expect(count(common as unknown as Part)).toBe(0)
    expect(count(rest as unknown as Part)).toBeLessThan(50)
  })
})

describe('ikona nga emrat e rreshtit', () => {
  it.each([
    ['Vezë', 'veze'],
    ['E bardhë veze', 'veze'],
    ['Pluhur proteine', 'proteine'],
    ['Clif Bar', 'shufer'],
    ['Ton albacore në ujë', 'ton'],
    ['Djathë amerikan me pak yndyrë', 'djathe'],
    ['Gjizë me pak yndyrë', 'djathe'],
    ['Bukë integrale', 'buke'],
    ['Tërshërë e gatuar', 'tershere'],
    ['Vaj ulliri', 'vaj'],
    ['Gjalpë kikiriku', 'salce'],
    ['Gjellë me patate', 'gjelle'],
    ['Byrek me djathë', 'byrek'],
    ['Pule', 'pule'],
    ['Mollë', 'molle'],
    ['Banane', 'banane'],
    ['Salmon', 'salmon'],
    ['Tangerines, (mandarin oranges), raw', 'agrum'],
  ])('%s → %s', (name, icon) => {
    expect(foodIconFromNames([name])).toBe(icon)
  })

  it('provon emrat sipas radhës dhe kthen null kur asnjëri nuk tregon formë', () => {
    expect(foodIconFromNames([null, 'Diçka pa emër', 'Bananas, raw'])).toBe('banane')
    expect(foodIconFromNames(['Diçka pa emër', undefined])).toBeNull()
  })
})
