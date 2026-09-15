import type { LangCode } from '../data/vocabulary';

/* ══════════════════════════════════════════════════════════════════════
   YAKLAŞIK OKUNUŞ — yabancı cümleyi Türk harfleriyle okunduğu gibi yazar.
   Amaç: kullanıcı karta bakıp doğru sesletebilsin. İddia: %100 fonetik
   değil, pratik yaklaşık okunuş (özellikle EN/FR için). Sıralı, birebir
   dizgi değişimleri — regex yok, sürpriz yok. Özel sözcükler kurallardan
   ÖNCE gelir.
   ══════════════════════════════════════════════════════════════════════ */

type Rule = [string, string];
function apply(s: string, rules: Rule[]): string {
  let out = s;
  for (const [from, to] of rules) {
    if (from && out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}
const clean = (s: string) =>
  s.replace(/[?!.,;:"“”«»'’()]/g, '').replace(/\s+/g, ' ').trim();

const RU: Rule[] = [
  ['ё', 'yo'], ['ж', 'j'], ['й', 'y'], ['х', 'h'], ['ц', 'ts'], ['ч', 'ç'],
  ['ш', 'ş'], ['щ', 'ş'], ['ъ', ''], ['ы', 'ı'], ['ь', "'"], ['э', 'e'],
  ['ю', 'yu'], ['я', 'ya'],
  ['а', 'a'], ['б', 'b'], ['в', 'v'], ['г', 'g'], ['д', 'd'], ['е', 'e'],
  ['з', 'z'], ['и', 'i'], ['к', 'k'], ['л', 'l'], ['м', 'm'], ['н', 'n'],
  ['о', 'o'], ['п', 'p'], ['р', 'r'], ['с', 's'], ['т', 't'], ['у', 'u'],
  ['ф', 'f'],
];

const DE: Rule[] = [
  ['sch', 'ş'], ['ch', 'h'], ['ei', 'ay'], ['ai', 'ay'], ['eu', 'oy'], ['äu', 'oy'],
  ['sp', 'şp'], ['st', 'şt'], ['qu', 'kv'], ['th', 't'], ['ph', 'f'],
  ['ä', 'e'], ['ö', 'ö'], ['ü', 'ü'], ['ie', 'i'], ['ß', 's'],
  ['w', 'v'], ['v', 'f'], ['z', 'ts'], ['c', 'k'], ['y', 'i'],
];

const FR: Rule[] = [
  ['eau', 'o'], ['au', 'o'], ['ou', 'u'], ['oi', 'ua'], ['oin', 'uan'],
  ['ain', 'en'], ['ein', 'en'], ['in', 'en'], ['un', 'ön'], ['an', 'an'],
  ['en', 'an'], ['on', 'on'], ['ch', 'ş'], ['gn', 'ny'], ['ph', 'f'],
  ['th', 't'], ['qu', 'k'], ['ç', 's'], ['ce', 'se'], ['ci', 'si'],
  ['ge', 'je'], ['gi', 'ji'], ['gy', 'ji'],
  ['h', ''], ['y', 'i'], ['w', 'v'], ['x', 'ks'], ['c', 'k'], ['j', 'j'], ['g', 'g'],
];

const FR_WORD: Record<string, string> = {
  est: 'e', les: 'le', des: 'de', tes: 'te', ses: 'se', mes: 'me', ces: 'se',
};

function frTail(s: string): string {
  // sessiz final ünsüzler + -e düşer: petit→peti, grande→gran, parlez→parle
  return s.split(' ').map(w => {
    if (FR_WORD[w]) return FR_WORD[w];
    let t = w;
    if (/[dtszxpg]$/i.test(t) && t.length > 3) t = t.slice(0, -1);
    if (/[^aeiou]e$/i.test(t) && t.length > 3) t = t.slice(0, -1);
    return t;
  }).join(' ');
}

const ES: Rule[] = [
  ['ch', 'ç'], ['ll', 'y'], ['ñ', 'ny'], ['gue', 'ge'], ['gui', 'gi'],
  ['qu', 'k'], ['ce', 'se'], ['ci', 'si'], ['ge', 'he'], ['gi', 'hi'],
  ['j', 'h'], ['h', ''], ['z', 's'], ['v', 'b'], ['c', 'k'],
];

const IT: Rule[] = [
  ['sci', 'şi'], ['sce', 'şe'], ['chi', 'ki'], ['che', 'ke'], ['ghi', 'gi'], ['ghe', 'ge'],
  ['ch', 'k'], ['gli', 'ly'], ['gn', 'ny'],
  ['ci', 'çi'], ['ce', 'çe'], ['gi', 'ci'], ['ge', 'ce'], ['sc', 'sk'],
  ['h', ''], ['à', 'a'], ['è', 'e'], ['é', 'e'], ['ì', 'i'], ['ò', 'o'], ['ù', 'u'],
];

const PT: Rule[] = [
  ['ão', 'au'], ['õe', 'oy'], ['ã', 'an'], ['õ', 'on'], ['nh', 'ny'], ['lh', 'ly'],
  ['ch', 'ş'], ['qu', 'k'], ['gue', 'ge'], ['gui', 'gi'], ['ce', 'se'], ['ci', 'si'],
  ['ge', 'je'], ['gi', 'ji'], ['ç', 's'], ['j', 'j'], ['h', ''], ['rr', 'r'], ['ss', 's'],
  ['x', 'ş'], ['c', 'k'],
];

const EN: Rule[] = [
  // — özel sık sözcükler (önce) —
  ['you ', 'yu '], ['your', 'yor'], ['young', 'yang'], ['four', 'for'], ['who', 'hu'],
  ['now', 'nau'], ['how', 'hav'], ['down', 'daun'], ['brown', 'braun'], ['town', 'taun'],
  ['cow', 'kav'], ['country', 'kantri'], ['cousin', 'kazın'], ['touch', 'taç'], ['double', 'dabıl'],
  ['trouble', 'trabıl'], ['journey', 'cörni'], ['course', 'kors'], ['source', 'sors'], ['great', 'greyt'],
  ['break', 'breyk'], ['steak', 'steyk'], ['said', 'sed'], ['against', 'egenst'], ['very', 'veri'],
  ['error', 'eror'], ['perf', 'pörf'], ['pers', 'pörs'], ['verb', 'vörb'], ['cert', 'sört'],
  ['merg', 'mörj'], ['pull', 'pul'], ['push', 'puş'], ['full', 'ful'], ['bush', 'buş'],
  ['sugar', 'şugır'], ['broad', 'brod'], ['bull', 'bul'], ['busy', 'bizi'], ['business', 'biznes'],
  ['heart', 'hart'], ['earn', 'örn'], ['earth', 'örth'], ['learn', 'lörn'], ['mountain', 'mauntın'],
  ['certain', 'sörtın'], ['curtain', 'körtın'], ['fountain', 'fauntın'], ['captain', 'keptın'], ['villain', 'vılın'],
  ['flower', 'flavır'], ['power', 'pavır'], ['shower', 'şavır'], ['tower', 'tavır'], ['soup', 'sup'],
  ['group', 'grup'], ['tour', 'tur'], ['pour', 'por'], ['youth', 'yut'], ['couple', 'kapıl'],
  ['favourite', 'feyvrıt'], ['favorite', 'feyvrıt'], ['soul', 'soul'], ['flour', 'flaur'], ['sour', 'savr'],
  ['enough', 'inaf'], ['tough', 'taf'], ['rough', 'raf'], ['cough', 'kof'], ['through', 'zru'],
  ['laugh', 'laf'], ['laughter', 'laftır'], ['question', 'kuesçın'], ['suggestion', 'sacesçın'],
  ['ocean', 'oşın'], ['cage', 'keyc'], ['page', 'peyc'], ['stage', 'steyc'], ['huge', 'hyuc'],
  ['change', 'çeync'], ['danger', 'deyncır'], ['anger', 'eyngır'], ['live', 'layv'], ['give', 'giv'],
  ['edge', 'ec'], ['bridge', 'bric'], ['fridge', 'fric'], ['knowledge', 'nolıc'],
  ['hour', 'avır'], ['devour', 'divaur'],
  ['area', 'eria'], ['are', 'ar'], ['where', 'ver'], ['here', 'hiır'], ['two', 'tu'],
  ['says', 'sez'], ['women', 'vimın'], ['woman', 'vumın'], ['breakfast', 'brekfıst'],
  ['build', 'bild'], ['building', 'bilding'],
  ['would', 'vud'], ['could', 'kud'], ['should', 'şud'],
  ['does', 'daz'], ['goes', 'gouz'], ['shoes', 'şuz'], ['done', 'dan'], ['gone', 'gon'],
  ['one', 'van'], ['once', 'vans'], ['come', 'kam'], ['some', 'sam'], ['none', 'nan'],
  ['love', 'lav'], ['above', 'ebav'], ['glove', 'glav'], ['move', 'muv'], ['prove', 'pruv'],
  ['improve', 'impruv'], ['lose', 'luz'], ['whose', 'huz'], ['those', 'douz'], ['these', 'diz'],
  ['their', 'deır'], ['there', 'deır'], ['they', 'dey'], ['without', 'vizaut'], ['month', 'manth'],
  ['months', 'manths'], ['answer', 'ansvır'], ['ocean', 'oşın'], ['cage', 'keyc'], ['page', 'peyc'],
  ['stage', 'steyc'], ['huge', 'hyuc'], ['change', 'çeync'], ['danger', 'deyncır'], ['anger', 'eyngır'],
  ['machine', 'meşin'],
  // — kalıplar —
  ['ough', 'o'], ['igh', 'ay'], ['ight', 'ayt'], ['tch', 'ç'], ['th', 'z'],
  ['sh', 'ş'], ['ch', 'ç'], ['ph', 'f'], ['wh', 'v'], ['ck', 'k'],
  ['kn', 'n'], ['wr', 'r'], ['tion', 'şın'], ['sion', 'jın'], ['ture', 'çır'],
  ['ee', 'i'], ['oo', 'u'], ['ui', 'u'], ['ea', 'e'], ['ai', 'ey'], ['ay', 'ey'], ['oa', 'ou'],
  ['our', 'ır'], ['ou', 'av'], ['ow', 'ou'], ['dge', 'c'],
];

/** EN tam-sözcük özel okunuşlar — kalıplardan ÖNCE bakılır. */
const EN_WORD: Record<string, string> = {
  you: 'yu', your: 'yor', young: 'yang', four: 'for', who: 'hu', hour: 'avır',
  now: 'nau', how: 'hav', down: 'daun', brown: 'braun', town: 'taun',
  cow: 'kav', country: 'kantri', cousin: 'kazın', touch: 'taç', double: 'dabıl',
  trouble: 'trabıl', journey: 'cörni', course: 'kors', source: 'sors', great: 'greyt',
  break: 'breyk', steak: 'steyk', said: 'sed', against: 'egenst', very: 'veri',
  every: 'evri', everyone: 'evrivan', everything: 'evriting',
  error: 'eror', errors: 'erırs', perf: 'pörf', pers: 'pörs', verb: 'vörb', cert: 'sört',
  merg: 'mörj', concert: 'konsırt', certificate: 'sırtifikıt', emergency: 'emörcınsi',
  pull: 'pul', push: 'puş', full: 'ful', bush: 'buş', put: 'put',
  sugar: 'şugır', broad: 'brod', bull: 'bul', busy: 'bizi', business: 'biznes',
  heart: 'hart', earn: 'örn', earth: 'örth', learn: 'lörn', mountain: 'mauntın',
  certain: 'sörtın', curtain: 'körtın', fountain: 'fauntın', captain: 'keptın', villain: 'vılın',
  flower: 'flavır', power: 'pavır', shower: 'şavır', tower: 'tavır', soup: 'sup',
  group: 'grup', tour: 'tur', tourism: 'turizm', tourist: 'turist', pour: 'por',
  youth: 'yut', couple: 'kapıl', favourite: 'feyvrıt', flavor: 'fleyvır', favour: 'feyvır',
  behaviour: 'biheyvır', behavior: 'biheyvır', harbour: 'harbır', harbor: 'harbır',
  labour: 'leybır', labor: 'leybır', rumour: 'rumır', rumor: 'rumır',
  humour: 'hyumır', humor: 'hyumır', odour: 'oudır', odor: 'oudır',
  vapour: 'veypır', vapor: 'veypır', neighbour: 'neybır', neighbor: 'neybır',
  neighbourhood: 'neybırhud', desire: 'dezayır',
  favorite: 'feyvrıt', soul: 'soul', flour: 'flaur', sour: 'savr',
  enough: 'inaf', tough: 'taf', rough: 'raf', cough: 'kof', through: 'zru',
  laugh: 'laf', laughter: 'laftır', question: 'kuesçın', suggestion: 'sacesçın',
  ocean: 'oşın', cage: 'keyc', page: 'peyc', stage: 'steyc',
  huge: 'hyuc', change: 'çeync', danger: 'deyncır', anger: 'eyngır', live: 'layv',
  give: 'giv', drive: 'drayv', thrive: 'zrayv', edge: 'ec', bridge: 'bric',
  fridge: 'fric', knowledge: 'nolıc', devour: 'divaur',
  would: 'vud', could: 'kud', should: 'şud',
  does: 'daz', goes: 'gouz', shoes: 'şuz', done: 'dan', gone: 'gon',
  one: 'van', once: 'vans', come: 'kam', some: 'sam', none: 'nan',
  love: 'lav', above: 'ebav', glove: 'glav', move: 'muv', prove: 'pruv',
  improve: 'impruv', lose: 'luz', whose: 'huz', those: 'douz', these: 'diz',
  their: 'deır', there: 'deır', they: 'dey', without: 'vizaut', month: 'manth',
  months: 'manths', answer: 'ansvır',
  area: 'eria', are: 'ar', where: 'ver', here: 'hiır', two: 'tu',
  says: 'sez', women: 'vimın', woman: 'vumın', breakfast: 'brekfıst',
  fruit: 'frut', juice: 'cus', cruise: 'kruz', build: 'bild', building: 'bilding',
  input: 'input', output: 'output', dispute: 'dispyut',
  our: 'avır', ver: 'ver', her: 'hör', per: 'per', der: 'der', sir: 'sör',
  obtain: 'obteyn', retain: 'riteyn', sustain: 'sesteyn', contain: 'konteyn',
  machine: 'meşin', hero: 'hirou', zero: 'zirou',
  famous: 'feymıs', nervous: 'nörvıs', serious: 'siriıs', various: 'veryıs', previous: 'priviyıs',
  curious: 'kyuriyıs', guitar: 'gitar', biscuit: 'biskıt', suitcase: 'sutkeys',
  later: 'leytır', greater: 'greytr', writer: 'raytır', rider: 'raydır', tiger: 'taygır',
  teenager: 'tineycır', foreigner: 'forınır', passenger: 'pesıncır', messenger: 'mesıncır',
  during: 'dyuring', nurse: 'nörs', purple: 'pörpıl', purpose: 'pörpıs', surface: 'sörfıs',
  hurry: 'hari', curry: 'köri', circle: 'sörkıl', circus: 'sörkıs', miracle: 'mirıkıl',
  lyric: 'lirik', burglar: 'börglır', detour: 'ditur', contour: 'kontur',
};

/** EN -er/-ir/-ur/-u kuyrukları (tam-sözcükten SONRA, kalıp olarak). */
const EN_RRR: Rule[] = [['er', 'ır'], ['ir', 'ır'], ['ur', 'ır'], ['u', 'a']];

function enWord(s: string): string {
  return s.split(' ').map(w => {
    if (EN_WORD[w]) return EN_WORD[w];
    let t = apply(w, EN);
    t = enTail(t);
    t = apply(t, EN_RRR);
    return t;
  }).join(' ');
}

const EN_VCE: Rule[] = [
  ['ike', 'ayk'], ['ife', 'ayf'], ['ime', 'aym'], ['ine', 'ayn'], ['ite', 'ayt'], ['ide', 'ayd'], ['ile', 'ayl'],
];

/** Sessiz-e kalıbı yalnızca kelime sonunda: like→layk, ticket→tiket. */
function enTail(s: string): string {
  return s.split(' ').map(w => {
    for (const [from, to] of EN_VCE) {
      if (w.endsWith(from) && w.length > from.length) return w.slice(0, -from.length) + to;
    }
    return w;
  }).join(' ');
}

/** Yabancı metnin yaklaşık Türkçe okunuşu (küçük harf). */
export function transliterate(lang: LangCode, text: string): string {
  const low = clean(text.toLowerCase());
  switch (lang) {
    case 'ru': return apply(low, RU);
    case 'de': return apply(low, DE);
    case 'fr': return frTail(apply(low, FR));
    case 'es': return apply(low, ES);
    case 'it': return apply(low, IT);
    case 'pt': return apply(low, PT);
    case 'en': return enWord(low);
    default: return low;
  }
}
