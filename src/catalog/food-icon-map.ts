import type { FoodIconKey } from './food-icons'

// Cila ikonë i takon një ushqimi të Listës së Vrullit. Tri shkallë: forma e ushqimit (nga emri),
// ikona e grupit (nga grupi i burimit), pjata e përgjithshme. Rregullat lexohen sipas radhës: i pari që përputhet fiton.

// Grupet që vendosin vetë (pjata të përbëra dhe pije), para emrit.
type Rule = readonly [RegExp, FoodIconKey | null, RegExp?]

const GROUP_FIRST: readonly Rule[] = [
  [/^pizza$/, 'pica'],
  [/burgers|sandwich/, 'burger'],
  [/soup|ramen/, 'supe'],
  [/^coffee$|^tea$|coffee, tea/, 'kafe'],
  [/liquor|wine|beer|cider|liqueur/, 'alkool'],
  [/protein and nutritional powders|dietary supplement|special nutritional/, 'proteine'],
  [/nutrition bars|cereal bars/, 'shufer'],
  [/ice cream|frozen dairy|gelatins, ices/, 'akullore'],
  [/fruit drinks|^apple juice|citrus juice|other fruit juice|vegetable juice|baby juice|juice or nectar|soft drink|sport and energy|diet .*drinks|water|smoothies|nutritional beverages|milk shakes|non alcoholic beverage/, 'pije'],
]

// Emri: [shprehja, ikona]. Provohet fillimisht pjesa para presjes së parë, pastaj emri i plotë.
const NAME: readonly Rule[] = [
  [/protein powder|whey protein|protein supplement/, 'proteine'],
  [/byrek|burek|phyllo|filo|flija|pastiçe/, 'byrek'],
  [/pizza/, 'pica'],
  [/burger|sandwich|hot dog|\btaco|burrito|\bwrap\b|quesadilla|kebab/, 'burger'],
  [/\bsoup|broth|bouillon|chowder|consomm/, 'supe'],
  [/\bstew|casserole|goulash|curry|\bchili\b|ragout|moussaka|tav[ëe]/, 'gjelle'],
  [/peanut butter|\bsauce|gravy|ketchup|catsup|mustard|mayonnaise|dressing|salsa|\bdip\b|hummus|\bjams?\b|jelly|marmalade|preserves|honey|syrup|spread|pickle|chutney|relish|pesto|tahini/, 'salce', /\b(with|in|and|w\/)\b.*(sauce|gravy|dressing|syrup|honey|mustard|mayonnaise|jelly|jam)|(syrup|juice) pack/],
  [/ice cream|sorbet|gelato|frozen yogurt|popsicle|sherbet/, 'akullore'],
  [/(protein|granola|cereal|energy|nutrition|snack|breakfast|fruit|nut|oat)\w* bars?\b|^bars?\b|clif/, 'shufer'],
  [/chocolate|cocoa|cacao/, 'cokollate'],
  [/coffee|\bteas?\b|espresso|cappuccino|latte|infusion/, 'kafe'],
  [/\bwine|\bbeer|vodka|whisk|\brum\b|liqueur|\bgin\b|cocktail|brandy|champagne|alcoholic/, 'alkool'],
  [/juice|\bdrinks?\b|beverage|soda|cola|lemonade|smoothie|\bwater\b|nectar|milkshake|\bshake\b/, 'pije'],
  [/cand(y|ies)|chewing gum|marshmallow|toffee|caramel|lollipop|^sugars?\b|\bsugar,|(cane|brown|powdered|icing) sugar|^sweetener|fudge|nougat|halva|turkish delight/, 'karamele'],
  [/cake|\bpies?\b|pastr(y|ies)|doughnut|donut|muffin|brownie|pudding|dessert|croissant|waffle|pancake|\btarts?\b|strudel|baklava|custard|mousse|tiramisu|cheesecake|danish|eclair|crepe/, 'kek'],
  [/cookie|biscuit|cracker|wafer|pretzel|\bchips\b|crisps|popcorn|\bsnacks?\b|rusk|crispbread/, 'biskote'],
  [/pasta|spaghetti|macaroni|noodle|lasagn|ravioli|tortellini|gnocchi|vermicelli/, 'makarona'],
  [/\brice\b|risotto|pilaf|couscous|bulgur|quinoa/, 'oriz'],
  [/\boats?\b|oatmeal|cereals?\b|muesli|granola|porridge|grits|corn flakes/, 'tershere'],
  [/\bbreads?\b|breadstick|toast|bagel|\bbuns?\b|\brolls?\b|tortilla|\bpita|baguette|\bloaf|focaccia|ciabatta|\bnaan/, 'buke'],
  [/flour|\bwheat|barley|\brye\b|millet|buckwheat|cornmeal|cornstarch|\bbran\b|semolina|starch|\bgrains?\b|polenta|kaçamak/, 'kalli'],
  [/eggplant|aubergine/, 'kastravec'],
  [/\beggs?\b|omelet|yolk/, 'veze'],
  [/sausage|salami|\bham\b|bacon|frankfurter|mortadella|bologna|pepperoni|prosciutto|luncheon|chorizo|\bpate\b|pâté|pastrami|wiener|bratwurst|sujuk|suxhuk/, 'sallam'],
  [/chicken|turkey|\bduck|goose|poultry|\bhen\b|quail|pheasant/, 'pule'],
  [/\btuna/, 'ton'],
  [/salmon|trout/, 'salmon'],
  [/shrimp|prawn|\bcrab|lobster|crustacean|mollusk|\bclams?\b|mussel|oyster|squid|octopus|scallop|shellfish|crayfish|cuttlefish|calamari/, 'karkalec'],
  [/\bfish|\bcod\b|mackerel|sardine|anchov|herring|\bbass\b|bream|\bcarp\b|tilapia|haddock|halibut|\bsole\b|\beel\b|pollock|perch|\bpike\b|catfish|snapper|swordfish|whiting|\bhake|plaice|flounder|seafood|\broe\b|caviar/, 'peshk'],
  [/beef|veal|lamb|mutton|pork|\bgoat\b|\bgame\b|venison|rabbit|steak|\bmeat|liver|kidney|bison|moose|\bdeer|\belk\b|\bribs?\b|brisket|tripe|tongue|heart|qofte|meatball/, 'mish'],
  [/yogurt|yoghurt|kefir|tarator|tzatziki|\bkos\b/, 'kos'],
  [/cheese|ricotta|\bfeta|mozzarella|\bcurd|cottage|parmesan|cheddar|gouda|brie\b|camembert|gjiz[ëe]|kashkaval/, 'djathe'],
  [/\bbutter\b|margarine|\bghee|\blard\b|shortening|tallow/, 'gjalpe'],
  [/\bmilk|\bcream\b|\bwhey\b|buttermilk/, 'qumesht'],
  [/\boils?\b/, 'vaj'],
  [/\bnuts?\b|almond|walnut|hazelnut|pistachio|cashew|pecan|peanut|\bseeds?\b|sesame|chestnut|coconut|macadamia|pine nut/, 'arra'],
  [/pineapple/, 'ananas'],
  [/grapefruit|orange|tangerine|mandarin|clementine|pomelo/, 'agrum'],
  [/lemon|\blimes?\b|citron/, 'limon'],
  [/\bapples?\b|applesauce/, 'molle'],
  [/banana|plantain/, 'banane'],
  [/\bgrapes?\b|raisin|currant/, 'rrush'],
  [/strawberr|raspberr|blueberr|blackberr|cranberr|\bberr(y|ies)\b|cherr|mulberr|gooseberr/, 'luleshtrydhe'],
  [/peach|apricot|\bplums?\b|nectarine|mango|papaya|persimmon|prune/, 'pjeshke'],
  [/\bpears?\b|quince|avocado|\bfigs?\b|kiwi|guava/, 'dardhe'],
  [/melon/, 'shalqi'],
  [/\bfruits?\b|pomegranate|\bdates?\b|rhubarb/, 'molle'],
  [/tomato/, 'domate'],
  [/sweet potato|carrot|pumpkin|squash|\bbeets?\b|beetroot|turnip|radish|parsnip|\byam\b|rutabaga/, 'karote'],
  [/potato|\bfries\b|hash brown/, 'patate'],
  [/salad|lettuce|spinach|cabbage|\bkale\b|chard|\bgreens\b|arugula|rocket|endive|collard|brussels|sauerkraut|vine.?leaf|watercress|chicory|seaweed|spirulina|kelp|\blaver\b|dulse|kombu|sea belt|sea thong|tangle|algae/, 'sallate'],
  [/mushroom|fungi|truffle/, 'kerpudhe'],
  [/broccoli|cauliflower/, 'brokoli'],
  [/cucumber|zucchini|courgette|okra|asparagus|celery|green beans?|string beans?|snap beans?|\bolives?\b|artichoke|gherkin/, 'kastravec'],
  [/onion|garlic|\bleeks?\b|shallot|scallion|chive/, 'qepe'],
  [/\bcorn\b|maize|sweetcorn/, 'miser'],
  [/\bbeans?\b|lentil|chickpea|\bpeas?\b|soy|tofu|tempeh|legume|\bpulses?\b|falafel|broadbean|lupin/, 'fasule'],
  [/pepper, (black|white|ground|cayenne)|peppercorn/, 'ereza'],
  [/\bpeppers?\b|capsicum|jalape/, 'spec'],
  [/spice|\bherbs?\b|\bsalt\b|seasoning|cinnamon|oregano|basil|parsley|paprika|vinegar|baking|yeast|vanilla|pepper|cumin|turmeric|ginger|nutmeg|clove|thyme|rosemary|\bmint\b|\bdill\b|coriander|gelatin|leavening|chervil|marjoram|\bsage\b|saffron|tarragon|\bbay\b|savory|cardamom|herbes|bicarbonate/, 'ereza'],
  [/vegetable/, 'brokoli'],
]

// Grupi i burimit, kur emri nuk tregon formë.
const GROUP: readonly Rule[] = [
  [/poultry|chicken|turkey/, 'pule'],
  [/sausage|luncheon|cold cuts|cured|bacon|frankfurter|preserved meat/, 'sallam'],
  [/finfish|shellfish|seafood|\bfish/, 'peshk'],
  [/meat analogue|soy and meat-alternative/, 'fasule'],
  [/beef|pork|lamb|veal|game|meat|offal/, 'mish'],
  [/egg/, 'veze'],
  [/cheese/, 'djathe'],
  [/yogurt|fermented milk/, 'kos'],
  [/butter|margarine|fats|oils?\b|dressing|mayonnaise/, 'vaj'],
  [/milk|dairy|cream/, 'qumesht'],
  [/potato/, 'patate'],
  [/legume|bean|pulse/, 'fasule'],
  [/nut|seed/, 'arra'],
  [/fruit|apples|bananas|berries|melons|citrus|pears|peaches|pineapple|mango/, 'molle'],
  [/vegetable|carrots|broccoli|spinach|cabbage|lettuce|onions|tomatoes|corn|olives|string beans/, 'brokoli'],
  [/bread|rolls|bagel|tortilla|baked products|bakery/, 'buke'],
  [/pasta|noodles/, 'makarona'],
  [/rice/, 'oriz'],
  [/breakfast cereal|ready-to-eat cereal|oatmeal|grits/, 'tershere'],
  [/cereal|grain/, 'kalli'],
  [/cookies|crackers|snack|chips|popcorn|pretzel|biscuits/, 'biskote'],
  [/cakes|doughnuts|pancakes|dessert|pudding|turnovers/, 'kek'],
  [/chocolate/, 'cokollate'],
  [/sweets|candy|sugar|confection|jam|syrup|honey/, 'karamele'],
  [/beverage|drink|coffee|tea/, 'pije'],
  [/sauce|gravy|condiment|dip|chutney/, 'salce'],
  [/spice|herb|seasoning|baking ingredient/, 'ereza'],
  [/fast foods|restaurant|meals|entrees|mixed dishes|dish|starters|stir-fry|burritos|nachos|egg rolls|mexican|prepared|baby|infant|american indian|formula/, 'gjelle'],
]

// Emrat shqip (ushqimet e përdoruesit, Plani im, shablloni): provohen vetëm kur rregullat anglisht nuk gjejnë gjë.
// Kufijtë e fjalës shkruhen me lookaround, sepse kufiri i fjalës i regex-it nuk i njeh ë dhe ç si shkronja.
const NAME_SQ: readonly Rule[] = [
  [/pluhur proteine|proteinë/, 'proteine'],
  [/shufër/, 'shufer'],
  [/byrek|flija|pastiçe|lakror|pet[ëe] byreku/, 'byrek'],
  [/(?<![a-zçë])pic[ëa](?![a-zçë])/, 'pica'],
  [/sanduiç|hamburger/, 'burger'],
  [/(?<![a-zçë])sup[ëe](?![a-zçë])/, 'supe'],
  [/gjell[ëe]|tav[ëe]|turli|çomlek|fërgesë|tasqebap|japrak|speca të mbushur/, 'gjelle'],
  [/gjalpë kikiriku|salc[ëe]|majonezë|mustardë|keçap|mjaltë|reçel|marmelatë|ajvar|turshi/, 'salce'],
  [/akullore/, 'akullore'],
  [/çokollat/, 'cokollate'],
  [/(?<![a-zçë])kafe(?![a-zçë])|(?<![a-zçë])çaj(?![a-zçë])/, 'kafe'],
  [/(?<![a-zçë])ver[ëe](?![a-zçë])|birr[ëe]|(?<![a-zçë])raki(?![a-zçë])/, 'alkool'],
  [/(?<![a-zçë])lëng|(?<![a-zçë])pije(?![a-zçë])|limonadë|^ujë/, 'pije'],
  [/karamele|sheqer|llokum|hallvë/, 'karamele'],
  [/(?<![a-zçë])kek|tort[ëe]|ëmbëlsir|bakllava|petulla|(?<![a-zçë])krep|trileçe|kadaif|revani/, 'kek'],
  [/biskot|kraker|patatina|kokoshka/, 'biskote'],
  [/makarona|spageti|lazanj/, 'makarona'],
  [/(?<![a-zçë])oriz|pilaf|rizoto/, 'oriz'],
  [/tërshër|drithëra|musli/, 'tershere'],
  [/(?<![a-zçë])buk[ëe](?![a-zçë])|(?<![a-zçë])tost(?![a-zçë])|simite/, 'buke'],
  [/miell|grurë|(?<![a-zçë])elb(?![a-zçë])|thekër|bollgur|kaçamak/, 'kalli'],
  [/patëllxhan/, 'kastravec'],
  [/(?<![a-zçë])vez[ëe](?![a-zçë])|omëletë/, 'veze'],
  [/sallam|proshutë|suxhuk|salsiçe|pastërma/, 'sallam'],
  [/(?<![a-zçë])pul[ëe](?![a-zçë])|gjel deti|(?<![a-zçë])ros[ëe](?![a-zçë])/, 'pule'],
  [/(?<![a-zçë])ton(?![a-zçë])/, 'ton'],
  [/troft[ëe]/, 'salmon'],
  [/karkalec|midhje|kallamar|oktapod|gaforre/, 'karkalec'],
  [/peshk|levrek|(?<![a-zçë])koce(?![a-zçë])|sardele|merluc|skumbri/, 'peshk'],
  [/(?<![a-zçë])mish|(?<![a-zçë])viç|qengj|(?<![a-zçë])derr|biftek|qofte|mëlçi/, 'mish'],
  [/(?<![a-zçë])kos(?![a-zçë])|dhallë/, 'kos'],
  [/djath|gjiz[ëe]|kaçkavall|mocarela|rikota/, 'djathe'],
  [/gjalp[ëe]|margarinë/, 'gjalpe'],
  [/qumësht|(?<![a-zçë])ajk[ëe](?![a-zçë])|kajmak/, 'qumesht'],
  [/(?<![a-zçë])vaj(?![a-zçë])/, 'vaj'],
  [/(?<![a-zçë])arra(?![a-zçë])|bajame|lajthi|kikirik|(?<![a-zçë])fara(?![a-zçë])|susam|gështenj|fëstëk/, 'arra'],
  [/portokall|mandarin|grejpfrut/, 'agrum'],
  [/(?<![a-zçë])moll[ëe](?![a-zçë])/, 'molle'],
  [/banane/, 'banane'],
  [/rrush/, 'rrush'],
  [/luleshtrydhe|mjedër|boronic|manaferr|qershi|vishnj/, 'luleshtrydhe'],
  [/pjeshk|kajsi|kumbull/, 'pjeshke'],
  [/dardh|(?<![a-zçë])ftua|(?<![a-zçë])fiq(?![a-zçë])|(?<![a-zçë])fik(?![a-zçë])/, 'dardhe'],
  [/shalqi|pjepër/, 'shalqi'],
  [/(?<![a-zçë])frut|shegë|hurm/, 'molle'],
  [/karot|kungull(?![a-zçë])|panxhar|rrep[ëe]/, 'karote'],
  [/sallat|spinaq|lakër|marule/, 'sallate'],
  [/kërpudh/, 'kerpudhe'],
  [/brokol|lulelakër/, 'brokoli'],
  [/kastravec|kungulleshk|bamje|shparg|selino|ullinj|(?<![a-zçë])ulli(?![a-zçë])/, 'kastravec'],
  [/qep[ëe]|hudhër|(?<![a-zçë])presh(?![a-zçë])/, 'qepe'],
  [/misër/, 'miser'],
  [/fasule|thjerrëz|qiqra|bizele|(?<![a-zçë])soj[ëe](?![a-zçë])|bathë/, 'fasule'],
  [/(?<![a-zçë])spec(a|i|at)?(?![a-zçë])/, 'spec'],
  [/erëz|(?<![a-zçë])krip[ëe](?![a-zçë])|piper|rigon|borzilok|majdanoz|kanellë|uthull/, 'ereza'],
  [/perime/, 'brokoli'],
]

export type FoodIconTier = 'forma' | 'grupi' | 'pjata'

function byName(name: string): FoodIconKey | null {
  // Pjesët mes presjeve sipas radhës: "KFC, Fried Chicken, …" gjen pulën te pjesa e dytë.
  for (const part of name.split(/[,;(]/)) {
    const text = part.trim()
    if (!text) continue
    for (const [re, key, not] of NAME) if (key && re.test(text) && !(not && not.test(name))) return key
  }
  for (const [re, key] of NAME_SQ) if (key && re.test(name)) return key
  return null
}

/** Ikona e një ushqimi të Listës dhe shkalla: 'forma' (nga emri), 'grupi' (nga grupi i burimit) ose 'pjata'. */
export function foodIcon(nameEn: string, group = ''): { icon: FoodIconKey; tier: FoodIconTier } {
  const name = nameEn.toLowerCase()
  const g = group.toLowerCase()
  if (/albanian dishes/.test(g)) return { icon: byName(name) ?? 'gjelle', tier: 'forma' }
  if (/pie, unsweetened/.test(g)) return { icon: /pizza/.test(name) ? 'pica' : 'byrek', tier: 'forma' }
  for (const [re, key] of GROUP_FIRST) if (key && re.test(g)) return { icon: key, tier: 'forma' }
  const named = byName(name)
  if (named) return { icon: named, tier: 'forma' }
  for (const [re, key] of GROUP) if (key && re.test(g)) return { icon: key, tier: 'grupi' }
  return { icon: 'pjata', tier: 'pjata' }
}

/** Ikona nga emrat që ka rreshti në ekran (shqip, anglisht ose të dy); null kur asnjë emër nuk tregon formë. */
export function foodIconFromNames(names: readonly (string | null | undefined)[]): FoodIconKey | null {
  for (const name of names) {
    if (!name) continue
    const key = byName(name.toLowerCase())
    if (key) return key
  }
  return null
}
