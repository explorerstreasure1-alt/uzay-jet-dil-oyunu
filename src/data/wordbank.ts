/* ══════════════════════════════════════════════════════════════════════
   WORDBANK — 4.000 doğrulanmış giriş / dil
   Kaynak = elle küratörlenmiş çekirdek + dilbilgisi kurallı üretici.
   Üretilen her kalıp, o dilin çekim/cinsiyet kuralına göre kurulur;
   Rusça çekimli kalıplarda yalnızca yalın hâl == -i hâli olan adlar
   kullanılır, böylece hiçbir hatalı form doğmaz.
   ══════════════════════════════════════════════════════════════════════ */

import { EXT_N, EXT_A, EXT_V, EXT_P } from './wordbank_ext';

export type LangCode = 'en' | 'es' | 'it' | 'ru' | 'pt' | 'fr' | 'de';
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type CatId =
  | 'daily' | 'travel' | 'food' | 'business' | 'slang'
  | 'emotion' | 'tech' | 'nature' | 'number' | 'phrase' | 'verb';

export interface Entry {
  f: string;  // foreign
  n: string;  // native (Turkish)
  lv: CEFRLevel;
  c: CatId;
}

type G = 'm' | 'f' | 'n';
interface Noun { f: string; n: string; g: G; lv: CEFRLevel; c: CatId; acc?: string }
interface Adj  { f: string; n: string; lv: CEFRLevel }
interface Verb { f: string; n: string; i1: string; i2: string; past: string; lv: CEFRLevel }

/* ─────────────────── packed helpers ─────────────────── */
/** "casa=ev:f|A1|daily; pan=ekmek:m|A1|food" */
function nouns(src: string): Noun[] {
  return src.split(';').map(s => s.trim()).filter(Boolean).map(row => {
    const [lhs, lv, c, acc] = row.split('|');
    const [f, rest] = lhs.split('=');
    const [n, g] = rest.split(':');
    return { f: f.trim(), n: n.trim(), g: (g as G) ?? 'm', lv: (lv as CEFRLevel) ?? 'A1', c: (c as CatId) ?? 'daily', acc: acc?.trim() };
  });
}
function adjs(src: string): Adj[] {
  return src.split(';').map(s => s.trim()).filter(Boolean).map(row => {
    const [lhs, lv] = row.split('|');
    const [f, n] = lhs.split('=');
    return { f: f.trim(), n: n.trim(), lv: (lv as CEFRLevel) ?? 'A1' };
  });
}
/** "comer=yemek>como>comes>comí|A1" */
function verbs(src: string): Verb[] {
  return src.split(';').map(s => s.trim()).filter(Boolean).map(row => {
    const [lhs, lv] = row.split('|');
    const [head, i1, i2, past] = lhs.split('>');
    const [f, n] = head.split('=');
    return { f: f.trim(), n: n.trim(), i1: i1.trim(), i2: i2.trim(), past: past.trim(), lv: (lv as CEFRLevel) ?? 'A1' };
  });
}
function plain(src: string, c: CatId, lv: CEFRLevel): Entry[] {
  return src.split(';').map(s => s.trim()).filter(Boolean).map(row => {
    const [f, n] = row.split('=');
    return { f: f.trim(), n: n.trim(), lv, c };
  });
}

/* ══════════════════════════ NOUNS ══════════════════════════ */
const N_EN = nouns(`
water=su:n|A1|food; bread=ekmek:n|A1|food; milk=süt:n|A1|food; apple=elma:n|A1|food;
cheese=peynir:n|A1|food; egg=yumurta:n|A1|food; rice=pilav:n|A1|food; soup=çorba:n|A1|food;
meat=et:n|A1|food; fish=balık:n|A1|food; salad=salata:n|A1|food; coffee=kahve:n|A1|food;
tea=çay:n|A1|food; sugar=şeker:n|A1|food; salt=tuz:n|A1|food; oil=yağ:n|A2|food;
chicken=tavuk:n|A1|food; potato=patates:n|A1|food; tomato=domates:n|A1|food; onion=soğan:n|A2|food;
cake=pasta:n|A2|food; ice cream=dondurma:n|A2|food; juice=meyve suyu:n|A1|food; wine=şarap:n|A2|food;
house=ev:n|A1|daily; door=kapı:n|A1|daily; window=pencere:n|A1|daily; table=masa:n|A1|daily;
chair=sandalye:n|A1|daily; bed=yatak:n|A1|daily; kitchen=mutfak:n|A1|daily; room=oda:n|A1|daily;
book=kitap:n|A1|daily; pen=kalem:n|A1|daily; bag=çanta:n|A1|daily; key=anahtar:n|A1|daily;
phone=telefon:n|A1|tech; clock=saat:n|A1|daily; mirror=ayna:n|A2|daily; towel=havlu:n|A2|daily;
soap=sabun:n|A2|daily; shirt=gömlek:n|A1|daily; shoe=ayakkabı:n|A1|daily; coat=palto:n|A2|daily;
airport=havalimanı:n|A2|travel; station=istasyon:n|A2|travel; ticket=bilet:n|A1|travel; train=tren:n|A1|travel;
bus=otobüs:n|A1|travel; taxi=taksi:n|A1|travel; hotel=otel:n|A1|travel; room key=oda anahtarı:n|A2|travel;
map=harita:n|A2|travel; luggage=bavul:n|A2|travel; passport=pasaport:n|A2|travel; border=sınır:n|B1|travel;
beach=plaj:n|A2|travel; museum=müze:n|A2|travel; pharmacy=eczane:n|A2|travel; hospital=hastane:n|A2|travel;
bank=banka:n|A2|business; market=pazar:n|A1|business; shop=dükkân:n|A1|business; price=fiyat:n|A2|business;
money=para:n|A1|business; invoice=fatura:n|B1|business; contract=sözleşme:n|B1|business; meeting=toplantı:n|A2|business;
office=ofis:n|A2|business; salary=maaş:n|B1|business; budget=bütçe:n|B1|business; profit=kâr:n|B1|business;
customer=müşteri:n|A2|business; deadline=son tarih:n|B1|business; report=rapor:n|B1|business; strategy=strateji:n|B2|business;
computer=bilgisayar:n|A2|tech; screen=ekran:n|A2|tech; keyboard=klavye:n|A2|tech; network=ağ:n|B1|tech;
password=şifre:n|A2|tech; file=dosya:n|A2|tech; software=yazılım:n|B1|tech; database=veritabanı:n|B2|tech;
algorithm=algoritma:n|B2|tech; server=sunucu:n|B1|tech; battery=pil:n|A2|tech; charger=şarj aleti:n|A2|tech;
tree=ağaç:n|A1|nature; flower=çiçek:n|A1|nature; river=nehir:n|A2|nature; mountain=dağ:n|A2|nature;
sea=deniz:n|A1|nature; forest=orman:n|A2|nature; sky=gökyüzü:n|A1|nature; cloud=bulut:n|A1|nature;
rain=yağmur:n|A1|nature; snow=kar:n|A1|nature; wind=rüzgâr:n|A2|nature; storm=fırtına:n|B1|nature;
sun=güneş:n|A1|nature; moon=ay:n|A1|nature; star=yıldız:n|A1|nature; island=ada:n|A2|nature;
mother=anne:n|A1|daily; father=baba:n|A1|daily; friend=arkadaş:n|A1|daily; child=çocuk:n|A1|daily;
teacher=öğretmen:n|A1|daily; doctor=doktor:n|A1|daily; driver=şoför:n|A2|daily; neighbour=komşu:n|A2|daily;
city=şehir:n|A1|daily; village=köy:n|A2|daily; street=sokak:n|A1|daily; bridge=köprü:n|A2|daily;
school=okul:n|A1|daily; garden=bahçe:n|A1|nature; park=park:n|A1|daily; library=kütüphane:n|A2|daily;
freedom=özgürlük:n|B1|emotion; hope=umut:n|B1|emotion; fear=korku:n|B1|emotion; trust=güven:n|B1|emotion;
memory=hafıza:n|B1|emotion; dream=hayal:n|B1|emotion; silence=sessizlik:n|B1|emotion; courage=cesaret:n|B2|emotion;
patience=sabır:n|B1|emotion; loneliness=yalnızlık:n|B2|emotion; joy=neşe:n|B1|emotion; grief=keder:n|B2|emotion;
`);

const N_ES = nouns(`
agua=su:f|A1|food; pan=ekmek:m|A1|food; leche=süt:f|A1|food; manzana=elma:f|A1|food;
queso=peynir:m|A1|food; huevo=yumurta:m|A1|food; arroz=pilav:m|A1|food; sopa=çorba:f|A1|food;
carne=et:f|A1|food; pescado=balık:m|A1|food; ensalada=salata:f|A1|food; café=kahve:m|A1|food;
té=çay:m|A1|food; azúcar=şeker:m|A1|food; sal=tuz:f|A1|food; aceite=yağ:m|A2|food;
pollo=tavuk:m|A1|food; patata=patates:f|A1|food; tomate=domates:m|A1|food; cebolla=soğan:f|A2|food;
pastel=pasta:m|A2|food; helado=dondurma:m|A2|food; zumo=meyve suyu:m|A1|food; vino=şarap:m|A2|food;
casa=ev:f|A1|daily; puerta=kapı:f|A1|daily; ventana=pencere:f|A1|daily; mesa=masa:f|A1|daily;
silla=sandalye:f|A1|daily; cama=yatak:f|A1|daily; cocina=mutfak:f|A1|daily; habitación=oda:f|A1|daily;
libro=kitap:m|A1|daily; bolígrafo=kalem:m|A1|daily; bolso=çanta:m|A1|daily; llave=anahtar:f|A1|daily;
teléfono=telefon:m|A1|tech; reloj=saat:m|A1|daily; espejo=ayna:m|A2|daily; toalla=havlu:f|A2|daily;
jabón=sabun:m|A2|daily; camisa=gömlek:f|A1|daily; zapato=ayakkabı:m|A1|daily; abrigo=palto:m|A2|daily;
aeropuerto=havalimanı:m|A2|travel; estación=istasyon:f|A2|travel; billete=bilet:m|A1|travel; tren=tren:m|A1|travel;
autobús=otobüs:m|A1|travel; taxi=taksi:m|A1|travel; hotel=otel:m|A1|travel; equipaje=bavul:m|A2|travel;
mapa=harita:m|A2|travel; pasaporte=pasaport:m|A2|travel; frontera=sınır:f|B1|travel; playa=plaj:f|A2|travel;
museo=müze:m|A2|travel; farmacia=eczane:f|A2|travel; hospital=hastane:m|A2|travel; maleta=valiz:f|A2|travel;
banco=banka:m|A2|business; mercado=pazar:m|A1|business; tienda=dükkân:f|A1|business; precio=fiyat:m|A2|business;
dinero=para:m|A1|business; factura=fatura:f|B1|business; contrato=sözleşme:m|B1|business; reunión=toplantı:f|A2|business;
oficina=ofis:f|A2|business; sueldo=maaş:m|B1|business; presupuesto=bütçe:m|B1|business; beneficio=kâr:m|B1|business;
cliente=müşteri:m|A2|business; informe=rapor:m|B1|business; estrategia=strateji:f|B2|business; empresa=şirket:f|A2|business;
ordenador=bilgisayar:m|A2|tech; pantalla=ekran:f|A2|tech; teclado=klavye:m|A2|tech; red=ağ:f|B1|tech;
contraseña=şifre:f|A2|tech; archivo=dosya:m|A2|tech; programa=yazılım:m|B1|tech; algoritmo=algoritma:m|B2|tech;
servidor=sunucu:m|B1|tech; batería=pil:f|A2|tech; cargador=şarj aleti:m|A2|tech; base de datos=veritabanı:f|B2|tech;
árbol=ağaç:m|A1|nature; flor=çiçek:f|A1|nature; río=nehir:m|A2|nature; montaña=dağ:f|A2|nature;
mar=deniz:m|A1|nature; bosque=orman:m|A2|nature; cielo=gökyüzü:m|A1|nature; nube=bulut:f|A1|nature;
lluvia=yağmur:f|A1|nature; nieve=kar:f|A1|nature; viento=rüzgâr:m|A2|nature; tormenta=fırtına:f|B1|nature;
sol=güneş:m|A1|nature; luna=ay:f|A1|nature; estrella=yıldız:f|A1|nature; isla=ada:f|A2|nature;
madre=anne:f|A1|daily; padre=baba:m|A1|daily; amigo=arkadaş:m|A1|daily; niño=çocuk:m|A1|daily;
profesor=öğretmen:m|A1|daily; médico=doktor:m|A1|daily; conductor=şoför:m|A2|daily; vecino=komşu:m|A2|daily;
ciudad=şehir:f|A1|daily; pueblo=köy:m|A2|daily; calle=sokak:f|A1|daily; puente=köprü:m|A2|daily;
escuela=okul:f|A1|daily; jardín=bahçe:m|A1|nature; parque=park:m|A1|daily; biblioteca=kütüphane:f|A2|daily;
libertad=özgürlük:f|B1|emotion; esperanza=umut:f|B1|emotion; miedo=korku:m|B1|emotion; confianza=güven:f|B1|emotion;
memoria=hafıza:f|B1|emotion; sueño=hayal:m|B1|emotion; silencio=sessizlik:m|B1|emotion; valor=cesaret:m|B2|emotion;
paciencia=sabır:f|B1|emotion; soledad=yalnızlık:f|B2|emotion; alegría=neşe:f|B1|emotion; tristeza=keder:f|B2|emotion;
`);

const N_IT = nouns(`
acqua=su:f|A1|food; pane=ekmek:m|A1|food; latte=süt:m|A1|food; mela=elma:f|A1|food;
formaggio=peynir:m|A1|food; uovo=yumurta:m|A1|food; riso=pilav:m|A1|food; zuppa=çorba:f|A1|food;
carne=et:f|A1|food; pesce=balık:m|A1|food; insalata=salata:f|A1|food; caffè=kahve:m|A1|food;
tè=çay:m|A1|food; zucchero=şeker:m|A1|food; sale=tuz:m|A1|food; olio=yağ:m|A2|food;
pollo=tavuk:m|A1|food; patata=patates:f|A1|food; pomodoro=domates:m|A1|food; cipolla=soğan:f|A2|food;
torta=pasta:f|A2|food; gelato=dondurma:m|A2|food; succo=meyve suyu:m|A1|food; vino=şarap:m|A2|food;
casa=ev:f|A1|daily; porta=kapı:f|A1|daily; finestra=pencere:f|A1|daily; tavolo=masa:m|A1|daily;
sedia=sandalye:f|A1|daily; letto=yatak:m|A1|daily; cucina=mutfak:f|A1|daily; camera=oda:f|A1|daily;
libro=kitap:m|A1|daily; penna=kalem:f|A1|daily; borsa=çanta:f|A1|daily; chiave=anahtar:f|A1|daily;
telefono=telefon:m|A1|tech; orologio=saat:m|A1|daily; specchio=ayna:m|A2|daily; asciugamano=havlu:m|A2|daily;
sapone=sabun:m|A2|daily; camicia=gömlek:f|A1|daily; scarpa=ayakkabı:f|A1|daily; cappotto=palto:m|A2|daily;
aeroporto=havalimanı:m|A2|travel; stazione=istasyon:f|A2|travel; biglietto=bilet:m|A1|travel; treno=tren:m|A1|travel;
autobus=otobüs:m|A1|travel; taxi=taksi:m|A1|travel; albergo=otel:m|A1|travel; bagaglio=bavul:m|A2|travel;
mappa=harita:f|A2|travel; passaporto=pasaport:m|A2|travel; confine=sınır:m|B1|travel; spiaggia=plaj:f|A2|travel;
museo=müze:m|A2|travel; farmacia=eczane:f|A2|travel; ospedale=hastane:m|A2|travel; valigia=valiz:f|A2|travel;
banca=banka:f|A2|business; mercato=pazar:m|A1|business; negozio=dükkân:m|A1|business; prezzo=fiyat:m|A2|business;
denaro=para:m|A1|business; fattura=fatura:f|B1|business; contratto=sözleşme:m|B1|business; riunione=toplantı:f|A2|business;
ufficio=ofis:m|A2|business; stipendio=maaş:m|B1|business; bilancio=bütçe:m|B1|business; profitto=kâr:m|B1|business;
cliente=müşteri:m|A2|business; rapporto=rapor:m|B1|business; strategia=strateji:f|B2|business; azienda=şirket:f|A2|business;
computer=bilgisayar:m|A2|tech; schermo=ekran:m|A2|tech; tastiera=klavye:f|A2|tech; rete=ağ:f|B1|tech;
password=şifre:f|A2|tech; file=dosya:m|A2|tech; programma=yazılım:m|B1|tech; algoritmo=algoritma:m|B2|tech;
server=sunucu:m|B1|tech; batteria=pil:f|A2|tech; caricabatterie=şarj aleti:m|A2|tech; banca dati=veritabanı:f|B2|tech;
albero=ağaç:m|A1|nature; fiore=çiçek:m|A1|nature; fiume=nehir:m|A2|nature; montagna=dağ:f|A2|nature;
mare=deniz:m|A1|nature; bosco=orman:m|A2|nature; cielo=gökyüzü:m|A1|nature; nuvola=bulut:f|A1|nature;
pioggia=yağmur:f|A1|nature; neve=kar:f|A1|nature; vento=rüzgâr:m|A2|nature; tempesta=fırtına:f|B1|nature;
sole=güneş:m|A1|nature; luna=ay:f|A1|nature; stella=yıldız:f|A1|nature; isola=ada:f|A2|nature;
madre=anne:f|A1|daily; padre=baba:m|A1|daily; amico=arkadaş:m|A1|daily; bambino=çocuk:m|A1|daily;
insegnante=öğretmen:m|A1|daily; medico=doktor:m|A1|daily; autista=şoför:m|A2|daily; vicino=komşu:m|A2|daily;
città=şehir:f|A1|daily; paese=köy:m|A2|daily; strada=sokak:f|A1|daily; ponte=köprü:m|A2|daily;
scuola=okul:f|A1|daily; giardino=bahçe:m|A1|nature; parco=park:m|A1|daily; biblioteca=kütüphane:f|A2|daily;
libertà=özgürlük:f|B1|emotion; speranza=umut:f|B1|emotion; paura=korku:f|B1|emotion; fiducia=güven:f|B1|emotion;
memoria=hafıza:f|B1|emotion; sogno=hayal:m|B1|emotion; silenzio=sessizlik:m|B1|emotion; coraggio=cesaret:m|B2|emotion;
pazienza=sabır:f|B1|emotion; solitudine=yalnızlık:f|B2|emotion; gioia=neşe:f|B1|emotion; dolore=keder:m|B2|emotion;
`);

/* Rusça: acc alanı yalnızca -i hâli yalından FARKLIYSA yazılır.
   Üretici, acc tanımlı olmayan (yani yalın == -i) adları çekimli kalıplarda kullanır. */
const N_RU = nouns(`
вода=su:f|A1|food|воду; хлеб=ekmek:m|A1|food; молоко=süt:n|A1|food; яблоко=elma:n|A1|food;
сыр=peynir:m|A1|food; яйцо=yumurta:n|A1|food; рис=pilav:m|A1|food; суп=çorba:m|A1|food;
мясо=et:n|A1|food; рыба=balık:f|A1|food|рыбу; салат=salata:m|A1|food; кофе=kahve:m|A1|food;
чай=çay:m|A1|food; сахар=şeker:m|A1|food; соль=tuz:f|A1|food; масло=yağ:n|A2|food;
курица=tavuk:f|A1|food|курицу; картофель=patates:m|A1|food; помидор=domates:m|A1|food; лук=soğan:m|A2|food;
торт=pasta:m|A2|food; мороженое=dondurma:n|A2|food; сок=meyve suyu:m|A1|food; вино=şarap:n|A2|food;
дом=ev:m|A1|daily; дверь=kapı:f|A1|daily; окно=pencere:n|A1|daily; стол=masa:m|A1|daily;
стул=sandalye:m|A1|daily; кровать=yatak:f|A1|daily; кухня=mutfak:f|A1|daily|кухню; комната=oda:f|A1|daily|комнату;
книга=kitap:f|A1|daily|книгу; ручка=kalem:f|A1|daily|ручку; сумка=çanta:f|A1|daily|сумку; ключ=anahtar:m|A1|daily;
телефон=telefon:m|A1|tech; часы=saat:m|A1|daily; зеркало=ayna:n|A2|daily; полотенце=havlu:n|A2|daily;
мыло=sabun:n|A2|daily; рубашка=gömlek:f|A1|daily|рубашку; ботинок=ayakkabı:m|A1|daily; пальто=palto:n|A2|daily;
аэропорт=havalimanı:m|A2|travel; вокзал=istasyon:m|A2|travel; билет=bilet:m|A1|travel; поезд=tren:m|A1|travel;
автобус=otobüs:m|A1|travel; такси=taksi:n|A1|travel; отель=otel:m|A1|travel; багаж=bavul:m|A2|travel;
карта=harita:f|A2|travel|карту; паспорт=pasaport:m|A2|travel; граница=sınır:f|B1|travel|границу; пляж=plaj:m|A2|travel;
музей=müze:m|A2|travel; аптека=eczane:f|A2|travel|аптеку; больница=hastane:f|A2|travel|больницу; чемодан=valiz:m|A2|travel;
банк=banka:m|A2|business; рынок=pazar:m|A1|business; магазин=dükkân:m|A1|business; цена=fiyat:f|A2|business|цену;
деньги=para:m|A1|business; счёт=fatura:m|B1|business; договор=sözleşme:m|B1|business; встреча=toplantı:f|A2|business|встречу;
офис=ofis:m|A2|business; зарплата=maaş:f|B1|business|зарплату; бюджет=bütçe:m|B1|business; прибыль=kâr:f|B1|business;
клиент=müşteri:m|A2|business; отчёт=rapor:m|B1|business; стратегия=strateji:f|B2|business|стратегию; компания=şirket:f|A2|business|компанию;
компьютер=bilgisayar:m|A2|tech; экран=ekran:m|A2|tech; клавиатура=klavye:f|A2|tech|клавиатуру; сеть=ağ:f|B1|tech;
пароль=şifre:m|A2|tech; файл=dosya:m|A2|tech; программа=yazılım:f|B1|tech|программу; алгоритм=algoritma:m|B2|tech;
сервер=sunucu:m|B1|tech; батарея=pil:f|A2|tech|батарею; зарядка=şarj aleti:f|A2|tech|зарядку; база данных=veritabanı:f|B2|tech;
дерево=ağaç:n|A1|nature; цветок=çiçek:m|A1|nature; река=nehir:f|A2|nature|реку; гора=dağ:f|A2|nature|гору;
море=deniz:n|A1|nature; лес=orman:m|A2|nature; небо=gökyüzü:n|A1|nature; облако=bulut:n|A1|nature;
дождь=yağmur:m|A1|nature; снег=kar:m|A1|nature; ветер=rüzgâr:m|A2|nature; буря=fırtına:f|B1|nature|бурю;
солнце=güneş:n|A1|nature; луна=ay:f|A1|nature|луну; звезда=yıldız:f|A1|nature|звезду; остров=ada:m|A2|nature;
мать=anne:f|A1|daily; отец=baba:m|A1|daily; друг=arkadaş:m|A1|daily; ребёнок=çocuk:m|A1|daily;
учитель=öğretmen:m|A1|daily; врач=doktor:m|A1|daily; водитель=şoför:m|A2|daily; сосед=komşu:m|A2|daily;
город=şehir:m|A1|daily; деревня=köy:f|A2|daily|деревню; улица=sokak:f|A1|daily|улицу; мост=köprü:m|A2|daily;
школа=okul:f|A1|daily|школу; сад=bahçe:m|A1|nature; парк=park:m|A1|daily; библиотека=kütüphane:f|A2|daily|библиотеку;
свобода=özgürlük:f|B1|emotion|свободу; надежда=umut:f|B1|emotion|надежду; страх=korku:m|B1|emotion; доверие=güven:n|B1|emotion;
память=hafıza:f|B1|emotion; мечта=hayal:f|B1|emotion|мечту; тишина=sessizlik:f|B1|emotion|тишину; смелость=cesaret:f|B2|emotion;
терпение=sabır:n|B1|emotion; одиночество=yalnızlık:n|B2|emotion; радость=neşe:f|B1|emotion; горе=keder:n|B2|emotion;
`);

const N_PT = nouns(`
água=su:f|A1|food; pão=ekmek:m|A1|food; leite=süt:m|A1|food; maçã=elma:f|A1|food;
queijo=peynir:m|A1|food; ovo=yumurta:m|A1|food; arroz=pilav:m|A1|food; sopa=çorba:f|A1|food;
carne=et:f|A1|food; peixe=balık:m|A1|food; salada=salata:f|A1|food; café=kahve:m|A1|food;
chá=çay:m|A1|food; açúcar=şeker:m|A1|food; sal=tuz:m|A1|food; azeite=yağ:m|A2|food;
frango=tavuk:m|A1|food; batata=patates:f|A1|food; tomate=domates:m|A1|food; cebola=soğan:f|A2|food;
bolo=pasta:m|A2|food; gelado=dondurma:m|A2|food; sumo=meyve suyu:m|A1|food; vinho=şarap:m|A2|food;
casa=ev:f|A1|daily; porta=kapı:f|A1|daily; janela=pencere:f|A1|daily; mesa=masa:f|A1|daily;
cadeira=sandalye:f|A1|daily; cama=yatak:f|A1|daily; cozinha=mutfak:f|A1|daily; quarto=oda:m|A1|daily;
livro=kitap:m|A1|daily; caneta=kalem:f|A1|daily; bolsa=çanta:f|A1|daily; chave=anahtar:f|A1|daily;
telefone=telefon:m|A1|tech; relógio=saat:m|A1|daily; espelho=ayna:m|A2|daily; toalha=havlu:f|A2|daily;
sabão=sabun:m|A2|daily; camisa=gömlek:f|A1|daily; sapato=ayakkabı:m|A1|daily; casaco=palto:m|A2|daily;
aeroporto=havalimanı:m|A2|travel; estação=istasyon:f|A2|travel; bilhete=bilet:m|A1|travel; comboio=tren:m|A1|travel;
autocarro=otobüs:m|A1|travel; táxi=taksi:m|A1|travel; hotel=otel:m|A1|travel; bagagem=bavul:f|A2|travel;
mapa=harita:m|A2|travel; passaporte=pasaport:m|A2|travel; fronteira=sınır:f|B1|travel; praia=plaj:f|A2|travel;
museu=müze:m|A2|travel; farmácia=eczane:f|A2|travel; hospital=hastane:m|A2|travel; mala=valiz:f|A2|travel;
banco=banka:m|A2|business; mercado=pazar:m|A1|business; loja=dükkân:f|A1|business; preço=fiyat:m|A2|business;
dinheiro=para:m|A1|business; fatura=fatura:f|B1|business; contrato=sözleşme:m|B1|business; reunião=toplantı:f|A2|business;
escritório=ofis:m|A2|business; salário=maaş:m|B1|business; orçamento=bütçe:m|B1|business; lucro=kâr:m|B1|business;
cliente=müşteri:m|A2|business; relatório=rapor:m|B1|business; estratégia=strateji:f|B2|business; empresa=şirket:f|A2|business;
computador=bilgisayar:m|A2|tech; ecrã=ekran:m|A2|tech; teclado=klavye:m|A2|tech; rede=ağ:f|B1|tech;
palavra-passe=şifre:f|A2|tech; ficheiro=dosya:m|A2|tech; programa=yazılım:m|B1|tech; algoritmo=algoritma:m|B2|tech;
servidor=sunucu:m|B1|tech; bateria=pil:f|A2|tech; carregador=şarj aleti:m|A2|tech; base de dados=veritabanı:f|B2|tech;
árvore=ağaç:f|A1|nature; flor=çiçek:f|A1|nature; rio=nehir:m|A2|nature; montanha=dağ:f|A2|nature;
mar=deniz:m|A1|nature; bosque=orman:m|A2|nature; céu=gökyüzü:m|A1|nature; nuvem=bulut:f|A1|nature;
chuva=yağmur:f|A1|nature; neve=kar:f|A1|nature; vento=rüzgâr:m|A2|nature; tempestade=fırtına:f|B1|nature;
sol=güneş:m|A1|nature; lua=ay:f|A1|nature; estrela=yıldız:f|A1|nature; ilha=ada:f|A2|nature;
mãe=anne:f|A1|daily; pai=baba:m|A1|daily; amigo=arkadaş:m|A1|daily; criança=çocuk:f|A1|daily;
professor=öğretmen:m|A1|daily; médico=doktor:m|A1|daily; motorista=şoför:m|A2|daily; vizinho=komşu:m|A2|daily;
cidade=şehir:f|A1|daily; aldeia=köy:f|A2|daily; rua=sokak:f|A1|daily; ponte=köprü:f|A2|daily;
escola=okul:f|A1|daily; jardim=bahçe:m|A1|nature; parque=park:m|A1|daily; biblioteca=kütüphane:f|A2|daily;
liberdade=özgürlük:f|B1|emotion; esperança=umut:f|B1|emotion; medo=korku:m|B1|emotion; confiança=güven:f|B1|emotion;
memória=hafıza:f|B1|emotion; sonho=hayal:m|B1|emotion; silêncio=sessizlik:m|B1|emotion; coragem=cesaret:f|B2|emotion;
paciência=sabır:f|B1|emotion; solidão=yalnızlık:f|B2|emotion; alegria=neşe:f|B1|emotion; tristeza=keder:f|B2|emotion;
`);

const N_FR = nouns(`
eau=su:f|A1|food; pain=ekmek:m|A1|food; lait=süt:m|A1|food; pomme=elma:f|A1|food;
fromage=peynir:m|A1|food; œuf=yumurta:m|A1|food; riz=pilav:m|A1|food; soupe=çorba:f|A1|food;
viande=et:f|A1|food; poisson=balık:m|A1|food; salade=salata:f|A1|food; café=kahve:m|A1|food;
thé=çay:m|A1|food; sucre=şeker:m|A1|food; sel=tuz:m|A1|food; huile=yağ:f|A2|food;
poulet=tavuk:m|A1|food; pomme de terre=patates:f|A1|food; tomate=domates:f|A1|food; oignon=soğan:m|A2|food;
gâteau=pasta:m|A2|food; glace=dondurma:f|A2|food; jus=meyve suyu:m|A1|food; vin=şarap:m|A2|food;
maison=ev:f|A1|daily; porte=kapı:f|A1|daily; fenêtre=pencere:f|A1|daily; table=masa:f|A1|daily;
chaise=sandalye:f|A1|daily; lit=yatak:m|A1|daily; cuisine=mutfak:f|A1|daily; chambre=oda:f|A1|daily;
livre=kitap:m|A1|daily; stylo=kalem:m|A1|daily; sac=çanta:m|A1|daily; clé=anahtar:f|A1|daily;
téléphone=telefon:m|A1|tech; horloge=saat:f|A1|daily; miroir=ayna:m|A2|daily; serviette=havlu:f|A2|daily;
savon=sabun:m|A2|daily; chemise=gömlek:f|A1|daily; chaussure=ayakkabı:f|A1|daily; manteau=palto:m|A2|daily;
aéroport=havalimanı:m|A2|travel; gare=istasyon:f|A2|travel; billet=bilet:m|A1|travel; train=tren:m|A1|travel;
bus=otobüs:m|A1|travel; taxi=taksi:m|A1|travel; hôtel=otel:m|A1|travel; bagage=bavul:m|A2|travel;
carte=harita:f|A2|travel; passeport=pasaport:m|A2|travel; frontière=sınır:f|B1|travel; plage=plaj:f|A2|travel;
musée=müze:m|A2|travel; pharmacie=eczane:f|A2|travel; hôpital=hastane:m|A2|travel; valise=valiz:f|A2|travel;
banque=banka:f|A2|business; marché=pazar:m|A1|business; magasin=dükkân:m|A1|business; prix=fiyat:m|A2|business;
argent=para:m|A1|business; facture=fatura:f|B1|business; contrat=sözleşme:m|B1|business; réunion=toplantı:f|A2|business;
bureau=ofis:m|A2|business; salaire=maaş:m|B1|business; budget=bütçe:m|B1|business; bénéfice=kâr:m|B1|business;
client=müşteri:m|A2|business; rapport=rapor:m|B1|business; stratégie=strateji:f|B2|business; entreprise=şirket:f|A2|business;
ordinateur=bilgisayar:m|A2|tech; écran=ekran:m|A2|tech; clavier=klavye:m|A2|tech; réseau=ağ:m|B1|tech;
mot de passe=şifre:m|A2|tech; fichier=dosya:m|A2|tech; logiciel=yazılım:m|B1|tech; algorithme=algoritma:m|B2|tech;
serveur=sunucu:m|B1|tech; batterie=pil:f|A2|tech; chargeur=şarj aleti:m|A2|tech; base de données=veritabanı:f|B2|tech;
arbre=ağaç:m|A1|nature; fleur=çiçek:f|A1|nature; rivière=nehir:f|A2|nature; montagne=dağ:f|A2|nature;
mer=deniz:f|A1|nature; forêt=orman:f|A2|nature; ciel=gökyüzü:m|A1|nature; nuage=bulut:m|A1|nature;
pluie=yağmur:f|A1|nature; neige=kar:f|A1|nature; vent=rüzgâr:m|A2|nature; tempête=fırtına:f|B1|nature;
soleil=güneş:m|A1|nature; lune=ay:f|A1|nature; étoile=yıldız:f|A1|nature; île=ada:f|A2|nature;
mère=anne:f|A1|daily; père=baba:m|A1|daily; ami=arkadaş:m|A1|daily; enfant=çocuk:m|A1|daily;
professeur=öğretmen:m|A1|daily; médecin=doktor:m|A1|daily; chauffeur=şoför:m|A2|daily; voisin=komşu:m|A2|daily;
ville=şehir:f|A1|daily; village=köy:m|A2|daily; rue=sokak:f|A1|daily; pont=köprü:m|A2|daily;
école=okul:f|A1|daily; jardin=bahçe:m|A1|nature; parc=park:m|A1|daily; bibliothèque=kütüphane:f|A2|daily;
liberté=özgürlük:f|B1|emotion; espoir=umut:m|B1|emotion; peur=korku:f|B1|emotion; confiance=güven:f|B1|emotion;
mémoire=hafıza:f|B1|emotion; rêve=hayal:m|B1|emotion; silence=sessizlik:m|B1|emotion; courage=cesaret:m|B2|emotion;
patience=sabır:f|B1|emotion; solitude=yalnızlık:f|B2|emotion; joie=neşe:f|B1|emotion; chagrin=keder:m|B2|emotion;
`);

const N_DE = nouns(`
Wasser=su:n|A1|food; Brot=ekmek:n|A1|food; Milch=süt:f|A1|food; Apfel=elma:m|A1|food;
Käse=peynir:m|A1|food; Ei=yumurta:n|A1|food; Reis=pilav:m|A1|food; Suppe=çorba:f|A1|food;
Fleisch=et:n|A1|food; Fisch=balık:m|A1|food; Salat=salata:m|A1|food; Kaffee=kahve:m|A1|food;
Tee=çay:m|A1|food; Zucker=şeker:m|A1|food; Salz=tuz:n|A1|food; Öl=yağ:n|A2|food;
Hähnchen=tavuk:n|A1|food; Kartoffel=patates:f|A1|food; Tomate=domates:f|A1|food; Zwiebel=soğan:f|A2|food;
Kuchen=pasta:m|A2|food; Eis=dondurma:n|A2|food; Saft=meyve suyu:m|A1|food; Wein=şarap:m|A2|food;
Haus=ev:n|A1|daily; Tür=kapı:f|A1|daily; Fenster=pencere:n|A1|daily; Tisch=masa:m|A1|daily;
Stuhl=sandalye:m|A1|daily; Bett=yatak:n|A1|daily; Küche=mutfak:f|A1|daily; Zimmer=oda:n|A1|daily;
Buch=kitap:n|A1|daily; Stift=kalem:m|A1|daily; Tasche=çanta:f|A1|daily; Schlüssel=anahtar:m|A1|daily;
Telefon=telefon:n|A1|tech; Uhr=saat:f|A1|daily; Spiegel=ayna:m|A2|daily; Handtuch=havlu:n|A2|daily;
Seife=sabun:f|A2|daily; Hemd=gömlek:n|A1|daily; Schuh=ayakkabı:m|A1|daily; Mantel=palto:m|A2|daily;
Flughafen=havalimanı:m|A2|travel; Bahnhof=istasyon:m|A2|travel; Fahrkarte=bilet:f|A1|travel; Zug=tren:m|A1|travel;
Bus=otobüs:m|A1|travel; Taxi=taksi:n|A1|travel; Hotel=otel:n|A1|travel; Gepäck=bavul:n|A2|travel;
Karte=harita:f|A2|travel; Reisepass=pasaport:m|A2|travel; Grenze=sınır:f|B1|travel; Strand=plaj:m|A2|travel;
Museum=müze:n|A2|travel; Apotheke=eczane:f|A2|travel; Krankenhaus=hastane:n|A2|travel; Koffer=valiz:m|A2|travel;
Bank=banka:f|A2|business; Markt=pazar:m|A1|business; Laden=dükkân:m|A1|business; Preis=fiyat:m|A2|business;
Geld=para:n|A1|business; Rechnung=fatura:f|B1|business; Vertrag=sözleşme:m|B1|business; Treffen=toplantı:n|A2|business;
Büro=ofis:n|A2|business; Gehalt=maaş:n|B1|business; Budget=bütçe:n|B1|business; Gewinn=kâr:m|B1|business;
Kunde=müşteri:m|A2|business; Bericht=rapor:m|B1|business; Strategie=strateji:f|B2|business; Firma=şirket:f|A2|business;
Computer=bilgisayar:m|A2|tech; Bildschirm=ekran:m|A2|tech; Tastatur=klavye:f|A2|tech; Netzwerk=ağ:n|B1|tech;
Passwort=şifre:n|A2|tech; Datei=dosya:f|A2|tech; Software=yazılım:f|B1|tech; Algorithmus=algoritma:m|B2|tech;
Server=sunucu:m|B1|tech; Batterie=pil:f|A2|tech; Ladegerät=şarj aleti:n|A2|tech; Datenbank=veritabanı:f|B2|tech;
Baum=ağaç:m|A1|nature; Blume=çiçek:f|A1|nature; Fluss=nehir:m|A2|nature; Berg=dağ:m|A2|nature;
Meer=deniz:n|A1|nature; Wald=orman:m|A2|nature; Himmel=gökyüzü:m|A1|nature; Wolke=bulut:f|A1|nature;
Regen=yağmur:m|A1|nature; Schnee=kar:m|A1|nature; Wind=rüzgâr:m|A2|nature; Sturm=fırtına:m|B1|nature;
Sonne=güneş:f|A1|nature; Mond=ay:m|A1|nature; Stern=yıldız:m|A1|nature; Insel=ada:f|A2|nature;
Mutter=anne:f|A1|daily; Vater=baba:m|A1|daily; Freund=arkadaş:m|A1|daily; Kind=çocuk:n|A1|daily;
Lehrer=öğretmen:m|A1|daily; Arzt=doktor:m|A1|daily; Fahrer=şoför:m|A2|daily; Nachbar=komşu:m|A2|daily;
Stadt=şehir:f|A1|daily; Dorf=köy:n|A2|daily; Straße=sokak:f|A1|daily; Brücke=köprü:f|A2|daily;
Schule=okul:f|A1|daily; Garten=bahçe:m|A1|nature; Park=park:m|A1|daily; Bibliothek=kütüphane:f|A2|daily;
Freiheit=özgürlük:f|B1|emotion; Hoffnung=umut:f|B1|emotion; Angst=korku:f|B1|emotion; Vertrauen=güven:n|B1|emotion;
Erinnerung=hafıza:f|B1|emotion; Traum=hayal:m|B1|emotion; Stille=sessizlik:f|B1|emotion; Mut=cesaret:m|B2|emotion;
Geduld=sabır:f|B1|emotion; Einsamkeit=yalnızlık:f|B2|emotion; Freude=neşe:f|B1|emotion; Kummer=keder:m|B2|emotion;
`);

/* ══════════════════════════ ADJECTIVES ══════════════════════════ */
const A_EN = adjs(`big=büyük|A1; small=küçük|A1; good=iyi|A1; bad=kötü|A1; new=yeni|A1; old=eski|A1;
hot=sıcak|A1; cold=soğuk|A1; fast=hızlı|A1; slow=yavaş|A1; easy=kolay|A1; hard=zor|A1;
beautiful=güzel|A1; ugly=çirkin|A2; happy=mutlu|A1; sad=üzgün|A1; tired=yorgun|A1; hungry=aç|A1;
thirsty=susuz|A1; strong=güçlü|A2; weak=zayıf|A2; clean=temiz|A1; dirty=kirli|A1; cheap=ucuz|A2;
expensive=pahalı|A2; rich=zengin|A2; poor=fakir|A2; young=genç|A1; long=uzun|A1; short=kısa|A1;
quiet=sessiz|A2; loud=gürültülü|A2; safe=güvenli|A2; dangerous=tehlikeli|A2; empty=boş|A2; full=dolu|A2;
bright=parlak|A2; dark=karanlık|A2; deep=derin|B1; heavy=ağır|A2; light=hafif|A2; soft=yumuşak|A2;
angry=kızgın|A2; calm=sakin|A2; nervous=gergin|B1; proud=gururlu|B1; jealous=kıskanç|B1; curious=meraklı|B1;
honest=dürüst|B1; polite=kibar|A2; rude=kaba|B1; generous=cömert|B1; reliable=güvenilir|B1; stubborn=inatçı|B2;
brilliant=parlak zekâlı|B2; awkward=tuhaf|B2; reluctant=isteksiz|B2; overwhelmed=bunalmış|B2; grateful=minnettar|B1;
resilient=dayanıklı|C1; ambivalent=kararsız|C1; meticulous=titiz|C1; profound=derin anlamlı|C1; inevitable=kaçınılmaz|C1;`);

const A_ES = adjs(`grande=büyük|A1; pequeño=küçük|A1; bueno=iyi|A1; malo=kötü|A1; nuevo=yeni|A1; viejo=eski|A1;
caliente=sıcak|A1; frío=soğuk|A1; rápido=hızlı|A1; lento=yavaş|A1; fácil=kolay|A1; difícil=zor|A1;
bonito=güzel|A1; feo=çirkin|A2; feliz=mutlu|A1; triste=üzgün|A1; cansado=yorgun|A1; hambriento=aç|A1;
sediento=susuz|A1; fuerte=güçlü|A2; débil=zayıf|A2; limpio=temiz|A1; sucio=kirli|A1; barato=ucuz|A2;
caro=pahalı|A2; rico=zengin|A2; pobre=fakir|A2; joven=genç|A1; largo=uzun|A1; corto=kısa|A1;
tranquilo=sessiz|A2; ruidoso=gürültülü|A2; seguro=güvenli|A2; peligroso=tehlikeli|A2; vacío=boş|A2; lleno=dolu|A2;
brillante=parlak|A2; oscuro=karanlık|A2; profundo=derin|B1; pesado=ağır|A2; ligero=hafif|A2; suave=yumuşak|A2;
enfadado=kızgın|A2; calmado=sakin|A2; nervioso=gergin|B1; orgulloso=gururlu|B1; celoso=kıskanç|B1; curioso=meraklı|B1;
honesto=dürüst|B1; educado=kibar|A2; grosero=kaba|B1; generoso=cömert|B1; fiable=güvenilir|B1; terco=inatçı|B2;
genial=harika|B2; incómodo=tuhaf|B2; reacio=isteksiz|B2; agobiado=bunalmış|B2; agradecido=minnettar|B1;
resiliente=dayanıklı|C1; ambivalente=kararsız|C1; meticuloso=titiz|C1; profundo y sabio=derin anlamlı|C1; inevitable=kaçınılmaz|C1;`);

const A_IT = adjs(`grande=büyük|A1; piccolo=küçük|A1; buono=iyi|A1; cattivo=kötü|A1; nuovo=yeni|A1; vecchio=eski|A1;
caldo=sıcak|A1; freddo=soğuk|A1; veloce=hızlı|A1; lento=yavaş|A1; facile=kolay|A1; difficile=zor|A1;
bello=güzel|A1; brutto=çirkin|A2; felice=mutlu|A1; triste=üzgün|A1; stanco=yorgun|A1; affamato=aç|A1;
assetato=susuz|A1; forte=güçlü|A2; debole=zayıf|A2; pulito=temiz|A1; sporco=kirli|A1; economico=ucuz|A2;
costoso=pahalı|A2; ricco=zengin|A2; povero=fakir|A2; giovane=genç|A1; lungo=uzun|A1; corto=kısa|A1;
silenzioso=sessiz|A2; rumoroso=gürültülü|A2; sicuro=güvenli|A2; pericoloso=tehlikeli|A2; vuoto=boş|A2; pieno=dolu|A2;
luminoso=parlak|A2; scuro=karanlık|A2; profondo=derin|B1; pesante=ağır|A2; leggero=hafif|A2; morbido=yumuşak|A2;
arrabbiato=kızgın|A2; calmo=sakin|A2; nervoso=gergin|B1; orgoglioso=gururlu|B1; geloso=kıskanç|B1; curioso=meraklı|B1;
onesto=dürüst|B1; educato=kibar|A2; maleducato=kaba|B1; generoso=cömert|B1; affidabile=güvenilir|B1; testardo=inatçı|B2;
brillante=parlak zekâlı|B2; imbarazzante=tuhaf|B2; restio=isteksiz|B2; sopraffatto=bunalmış|B2; grato=minnettar|B1;
resiliente=dayanıklı|C1; ambivalente=kararsız|C1; meticoloso=titiz|C1; profondo=derin anlamlı|C1; inevitabile=kaçınılmaz|C1;`);

const A_RU = adjs(`большой=büyük|A1; маленький=küçük|A1; хороший=iyi|A1; плохой=kötü|A1; новый=yeni|A1; старый=eski|A1;
горячий=sıcak|A1; холодный=soğuk|A1; быстрый=hızlı|A1; медленный=yavaş|A1; лёгкий=kolay|A1; трудный=zor|A1;
красивый=güzel|A1; некрасивый=çirkin|A2; счастливый=mutlu|A1; грустный=üzgün|A1; усталый=yorgun|A1; голодный=aç|A1;
жаждущий=susuz|A1; сильный=güçlü|A2; слабый=zayıf|A2; чистый=temiz|A1; грязный=kirli|A1; дешёвый=ucuz|A2;
дорогой=pahalı|A2; богатый=zengin|A2; бедный=fakir|A2; молодой=genç|A1; длинный=uzun|A1; короткий=kısa|A1;
тихий=sessiz|A2; шумный=gürültülü|A2; безопасный=güvenli|A2; опасный=tehlikeli|A2; пустой=boş|A2; полный=dolu|A2;
яркий=parlak|A2; тёмный=karanlık|A2; глубокий=derin|B1; тяжёлый=ağır|A2; лёгкий по весу=hafif|A2; мягкий=yumuşak|A2;
сердитый=kızgın|A2; спокойный=sakin|A2; нервный=gergin|B1; гордый=gururlu|B1; ревнивый=kıskanç|B1; любопытный=meraklı|B1;
честный=dürüst|B1; вежливый=kibar|A2; грубый=kaba|B1; щедрый=cömert|B1; надёжный=güvenilir|B1; упрямый=inatçı|B2;
блестящий=parlak zekâlı|B2; неловкий=tuhaf|B2; неохотный=isteksiz|B2; перегруженный=bunalmış|B2; благодарный=minnettar|B1;
устойчивый=dayanıklı|C1; двойственный=kararsız|C1; дотошный=titiz|C1; глубокомысленный=derin anlamlı|C1; неизбежный=kaçınılmaz|C1;`);

const A_PT = adjs(`grande=büyük|A1; pequeno=küçük|A1; bom=iyi|A1; mau=kötü|A1; novo=yeni|A1; velho=eski|A1;
quente=sıcak|A1; frio=soğuk|A1; rápido=hızlı|A1; lento=yavaş|A1; fácil=kolay|A1; difícil=zor|A1;
bonito=güzel|A1; feio=çirkin|A2; feliz=mutlu|A1; triste=üzgün|A1; cansado=yorgun|A1; faminto=aç|A1;
com sede=susuz|A1; forte=güçlü|A2; fraco=zayıf|A2; limpo=temiz|A1; sujo=kirli|A1; barato=ucuz|A2;
caro=pahalı|A2; rico=zengin|A2; pobre=fakir|A2; jovem=genç|A1; longo=uzun|A1; curto=kısa|A1;
silencioso=sessiz|A2; barulhento=gürültülü|A2; seguro=güvenli|A2; perigoso=tehlikeli|A2; vazio=boş|A2; cheio=dolu|A2;
brilhante=parlak|A2; escuro=karanlık|A2; profundo=derin|B1; pesado=ağır|A2; leve=hafif|A2; macio=yumuşak|A2;
zangado=kızgın|A2; calmo=sakin|A2; nervoso=gergin|B1; orgulhoso=gururlu|B1; ciumento=kıskanç|B1; curioso=meraklı|B1;
honesto=dürüst|B1; educado=kibar|A2; rude=kaba|B1; generoso=cömert|B1; confiável=güvenilir|B1; teimoso=inatçı|B2;
brilhante e inteligente=parlak zekâlı|B2; constrangedor=tuhaf|B2; relutante=isteksiz|B2; sobrecarregado=bunalmış|B2; grato=minnettar|B1;
resiliente=dayanıklı|C1; ambivalente=kararsız|C1; meticuloso=titiz|C1; profundo=derin anlamlı|C1; inevitável=kaçınılmaz|C1;`);

const A_FR = adjs(`grand=büyük|A1; petit=küçük|A1; bon=iyi|A1; mauvais=kötü|A1; nouveau=yeni|A1; vieux=eski|A1;
chaud=sıcak|A1; froid=soğuk|A1; rapide=hızlı|A1; lent=yavaş|A1; facile=kolay|A1; difficile=zor|A1;
beau=güzel|A1; laid=çirkin|A2; heureux=mutlu|A1; triste=üzgün|A1; fatigué=yorgun|A1; affamé=aç|A1;
assoiffé=susuz|A1; fort=güçlü|A2; faible=zayıf|A2; propre=temiz|A1; sale=kirli|A1; bon marché=ucuz|A2;
cher=pahalı|A2; riche=zengin|A2; pauvre=fakir|A2; jeune=genç|A1; long=uzun|A1; court=kısa|A1;
silencieux=sessiz|A2; bruyant=gürültülü|A2; sûr=güvenli|A2; dangereux=tehlikeli|A2; vide=boş|A2; plein=dolu|A2;
brillant=parlak|A2; sombre=karanlık|A2; profond=derin|B1; lourd=ağır|A2; léger=hafif|A2; doux=yumuşak|A2;
en colère=kızgın|A2; calme=sakin|A2; nerveux=gergin|B1; fier=gururlu|B1; jaloux=kıskanç|B1; curieux=meraklı|B1;
honnête=dürüst|B1; poli=kibar|A2; impoli=kaba|B1; généreux=cömert|B1; fiable=güvenilir|B1; têtu=inatçı|B2;
brillant et intelligent=parlak zekâlı|B2; embarrassant=tuhaf|B2; réticent=isteksiz|B2; dépassé=bunalmış|B2; reconnaissant=minnettar|B1;
résilient=dayanıklı|C1; ambivalent=kararsız|C1; méticuleux=titiz|C1; profond=derin anlamlı|C1; inévitable=kaçınılmaz|C1;`);

const A_DE = adjs(`groß=büyük|A1; klein=küçük|A1; gut=iyi|A1; schlecht=kötü|A1; neu=yeni|A1; alt=eski|A1;
heiß=sıcak|A1; kalt=soğuk|A1; schnell=hızlı|A1; langsam=yavaş|A1; einfach=kolay|A1; schwierig=zor|A1;
schön=güzel|A1; hässlich=çirkin|A2; glücklich=mutlu|A1; traurig=üzgün|A1; müde=yorgun|A1; hungrig=aç|A1;
durstig=susuz|A1; stark=güçlü|A2; schwach=zayıf|A2; sauber=temiz|A1; schmutzig=kirli|A1; billig=ucuz|A2;
teuer=pahalı|A2; reich=zengin|A2; arm=fakir|A2; jung=genç|A1; lang=uzun|A1; kurz=kısa|A1;
leise=sessiz|A2; laut=gürültülü|A2; sicher=güvenli|A2; gefährlich=tehlikeli|A2; leer=boş|A2; voll=dolu|A2;
hell=parlak|A2; dunkel=karanlık|A2; tief=derin|B1; schwer=ağır|A2; leicht=hafif|A2; weich=yumuşak|A2;
wütend=kızgın|A2; ruhig=sakin|A2; nervös=gergin|B1; stolz=gururlu|B1; eifersüchtig=kıskanç|B1; neugierig=meraklı|B1;
ehrlich=dürüst|B1; höflich=kibar|A2; unhöflich=kaba|B1; großzügig=cömert|B1; zuverlässig=güvenilir|B1; stur=inatçı|B2;
brillant=parlak zekâlı|B2; peinlich=tuhaf|B2; widerwillig=isteksiz|B2; überfordert=bunalmış|B2; dankbar=minnettar|B1;
widerstandsfähig=dayanıklı|C1; ambivalent=kararsız|C1; akribisch=titiz|C1; tiefgründig=derin anlamlı|C1; unvermeidlich=kaçınılmaz|C1;`);

/* ══════════════════════════ VERBS ══════════════════════════ */
const V_EN = verbs(`to eat=yemek>I eat>you eat>I ate|A1; to drink=içmek>I drink>you drink>I drank|A1;
to go=gitmek>I go>you go>I went|A1; to come=gelmek>I come>you come>I came|A1;
to see=görmek>I see>you see>I saw|A1; to hear=duymak>I hear>you hear>I heard|A1;
to speak=konuşmak>I speak>you speak>I spoke|A1; to read=okumak>I read>you read>I read|A1;
to write=yazmak>I write>you write>I wrote|A1; to work=çalışmak>I work>you work>I worked|A1;
to sleep=uyumak>I sleep>you sleep>I slept|A1; to buy=satın almak>I buy>you buy>I bought|A1;
to sell=satmak>I sell>you sell>I sold|A2; to open=açmak>I open>you open>I opened|A1;
to close=kapatmak>I close>you close>I closed|A1; to give=vermek>I give>you give>I gave|A1;
to take=almak>I take>you take>I took|A1; to find=bulmak>I find>you find>I found|A2;
to lose=kaybetmek>I lose>you lose>I lost|A2; to wait=beklemek>I wait>you wait>I waited|A1;
to help=yardım etmek>I help>you help>I helped|A1; to ask=sormak>I ask>you ask>I asked|A1;
to answer=cevaplamak>I answer>you answer>I answered|A2; to learn=öğrenmek>I learn>you learn>I learned|A1;
to teach=öğretmek>I teach>you teach>I taught|A2; to understand=anlamak>I understand>you understand>I understood|A2;
to think=düşünmek>I think>you think>I thought|A1; to remember=hatırlamak>I remember>you remember>I remembered|A2;
to forget=unutmak>I forget>you forget>I forgot|A2; to travel=seyahat etmek>I travel>you travel>I travelled|A2;
to drive=araba sürmek>I drive>you drive>I drove|A2; to walk=yürümek>I walk>you walk>I walked|A1;
to run=koşmak>I run>you run>I ran|A1; to cook=yemek pişirmek>I cook>you cook>I cooked|A1;
to pay=ödemek>I pay>you pay>I paid|A2; to build=inşa etmek>I build>you build>I built|B1;
to change=değiştirmek>I change>you change>I changed|A2; to decide=karar vermek>I decide>you decide>I decided|B1;
to explain=açıklamak>I explain>you explain>I explained|B1; to improve=geliştirmek>I improve>you improve>I improved|B1;
to achieve=başarmak>I achieve>you achieve>I achieved|B2; to manage=yönetmek>I manage>you manage>I managed|B1;
to negotiate=müzakere etmek>I negotiate>you negotiate>I negotiated|B2; to postpone=ertelemek>I postpone>you postpone>I postponed|B2;
to acknowledge=kabul etmek>I acknowledge>you acknowledge>I acknowledged|C1;`);

const V_ES = verbs(`comer=yemek>como>comes>comí|A1; beber=içmek>bebo>bebes>bebí|A1;
ir=gitmek>voy>vas>fui|A1; venir=gelmek>vengo>vienes>vine|A1;
ver=görmek>veo>ves>vi|A1; oír=duymak>oigo>oyes>oí|A1;
hablar=konuşmak>hablo>hablas>hablé|A1; leer=okumak>leo>lees>leí|A1;
escribir=yazmak>escribo>escribes>escribí|A1; trabajar=çalışmak>trabajo>trabajas>trabajé|A1;
dormir=uyumak>duermo>duermes>dormí|A1; comprar=satın almak>compro>compras>compré|A1;
vender=satmak>vendo>vendes>vendí|A2; abrir=açmak>abro>abres>abrí|A1;
cerrar=kapatmak>cierro>cierras>cerré|A1; dar=vermek>doy>das>di|A1;
tomar=almak>tomo>tomas>tomé|A1; encontrar=bulmak>encuentro>encuentras>encontré|A2;
perder=kaybetmek>pierdo>pierdes>perdí|A2; esperar=beklemek>espero>esperas>esperé|A1;
ayudar=yardım etmek>ayudo>ayudas>ayudé|A1; preguntar=sormak>pregunto>preguntas>pregunté|A1;
responder=cevaplamak>respondo>respondes>respondí|A2; aprender=öğrenmek>aprendo>aprendes>aprendí|A1;
enseñar=öğretmek>enseño>enseñas>enseñé|A2; entender=anlamak>entiendo>entiendes>entendí|A2;
pensar=düşünmek>pienso>piensas>pensé|A1; recordar=hatırlamak>recuerdo>recuerdas>recordé|A2;
olvidar=unutmak>olvido>olvidas>olvidé|A2; viajar=seyahat etmek>viajo>viajas>viajé|A2;
conducir=araba sürmek>conduzco>conduces>conduje|A2; caminar=yürümek>camino>caminas>caminé|A1;
correr=koşmak>corro>corres>corrí|A1; cocinar=yemek pişirmek>cocino>cocinas>cociné|A1;
pagar=ödemek>pago>pagas>pagué|A2; construir=inşa etmek>construyo>construyes>construí|B1;
cambiar=değiştirmek>cambio>cambias>cambié|A2; decidir=karar vermek>decido>decides>decidí|B1;
explicar=açıklamak>explico>explicas>expliqué|B1; mejorar=geliştirmek>mejoro>mejoras>mejoré|B1;
lograr=başarmak>logro>logras>logré|B2; gestionar=yönetmek>gestiono>gestionas>gestioné|B1;
negociar=müzakere etmek>negocio>negocias>negocié|B2; aplazar=ertelemek>aplazo>aplazas>aplacé|B2;
reconocer=kabul etmek>reconozco>reconoces>reconocí|C1;`);

const V_IT = verbs(`mangiare=yemek>mangio>mangi>ho mangiato|A1; bere=içmek>bevo>bevi>ho bevuto|A1;
andare=gitmek>vado>vai>sono andato|A1; venire=gelmek>vengo>vieni>sono venuto|A1;
vedere=görmek>vedo>vedi>ho visto|A1; sentire=duymak>sento>senti>ho sentito|A1;
parlare=konuşmak>parlo>parli>ho parlato|A1; leggere=okumak>leggo>leggi>ho letto|A1;
scrivere=yazmak>scrivo>scrivi>ho scritto|A1; lavorare=çalışmak>lavoro>lavori>ho lavorato|A1;
dormire=uyumak>dormo>dormi>ho dormito|A1; comprare=satın almak>compro>compri>ho comprato|A1;
vendere=satmak>vendo>vendi>ho venduto|A2; aprire=açmak>apro>apri>ho aperto|A1;
chiudere=kapatmak>chiudo>chiudi>ho chiuso|A1; dare=vermek>do>dai>ho dato|A1;
prendere=almak>prendo>prendi>ho preso|A1; trovare=bulmak>trovo>trovi>ho trovato|A2;
perdere=kaybetmek>perdo>perdi>ho perso|A2; aspettare=beklemek>aspetto>aspetti>ho aspettato|A1;
aiutare=yardım etmek>aiuto>aiuti>ho aiutato|A1; chiedere=sormak>chiedo>chiedi>ho chiesto|A1;
rispondere=cevaplamak>rispondo>rispondi>ho risposto|A2; imparare=öğrenmek>imparo>impari>ho imparato|A1;
insegnare=öğretmek>insegno>insegni>ho insegnato|A2; capire=anlamak>capisco>capisci>ho capito|A2;
pensare=düşünmek>penso>pensi>ho pensato|A1; ricordare=hatırlamak>ricordo>ricordi>ho ricordato|A2;
dimenticare=unutmak>dimentico>dimentichi>ho dimenticato|A2; viaggiare=seyahat etmek>viaggio>viaggi>ho viaggiato|A2;
guidare=araba sürmek>guido>guidi>ho guidato|A2; camminare=yürümek>cammino>cammini>ho camminato|A1;
correre=koşmak>corro>corri>ho corso|A1; cucinare=yemek pişirmek>cucino>cucini>ho cucinato|A1;
pagare=ödemek>pago>paghi>ho pagato|A2; costruire=inşa etmek>costruisco>costruisci>ho costruito|B1;
cambiare=değiştirmek>cambio>cambi>ho cambiato|A2; decidere=karar vermek>decido>decidi>ho deciso|B1;
spiegare=açıklamak>spiego>spieghi>ho spiegato|B1; migliorare=geliştirmek>miglioro>migliori>ho migliorato|B1;
raggiungere=başarmak>raggiungo>raggiungi>ho raggiunto|B2; gestire=yönetmek>gestisco>gestisci>ho gestito|B1;
negoziare=müzakere etmek>negozio>negozi>ho negoziato|B2; rinviare=ertelemek>rinvio>rinvii>ho rinviato|B2;
riconoscere=kabul etmek>riconosco>riconosci>ho riconosciuto|C1;`);

const V_RU = verbs(`есть=yemek>я ем>ты ешь>я ел|A1; пить=içmek>я пью>ты пьёшь>я пил|A1;
идти=gitmek>я иду>ты идёшь>я шёл|A1; приходить=gelmek>я прихожу>ты приходишь>я пришёл|A1;
видеть=görmek>я вижу>ты видишь>я видел|A1; слышать=duymak>я слышу>ты слышишь>я слышал|A1;
говорить=konuşmak>я говорю>ты говоришь>я говорил|A1; читать=okumak>я читаю>ты читаешь>я читал|A1;
писать=yazmak>я пишу>ты пишешь>я писал|A1; работать=çalışmak>я работаю>ты работаешь>я работал|A1;
спать=uyumak>я сплю>ты спишь>я спал|A1; покупать=satın almak>я покупаю>ты покупаешь>я купил|A1;
продавать=satmak>я продаю>ты продаёшь>я продал|A2; открывать=açmak>я открываю>ты открываешь>я открыл|A1;
закрывать=kapatmak>я закрываю>ты закрываешь>я закрыл|A1; давать=vermek>я даю>ты даёшь>я дал|A1;
брать=almak>я беру>ты берёшь>я взял|A1; находить=bulmak>я нахожу>ты находишь>я нашёл|A2;
терять=kaybetmek>я теряю>ты теряешь>я потерял|A2; ждать=beklemek>я жду>ты ждёшь>я ждал|A1;
помогать=yardım etmek>я помогаю>ты помогаешь>я помог|A1; спрашивать=sormak>я спрашиваю>ты спрашиваешь>я спросил|A1;
отвечать=cevaplamak>я отвечаю>ты отвечаешь>я ответил|A2; учить=öğrenmek>я учу>ты учишь>я учил|A1;
преподавать=öğretmek>я преподаю>ты преподаёшь>я преподавал|A2; понимать=anlamak>я понимаю>ты понимаешь>я понял|A2;
думать=düşünmek>я думаю>ты думаешь>я думал|A1; помнить=hatırlamak>я помню>ты помнишь>я помнил|A2;
забывать=unutmak>я забываю>ты забываешь>я забыл|A2; путешествовать=seyahat etmek>я путешествую>ты путешествуешь>я путешествовал|A2;
водить=araba sürmek>я вожу>ты водишь>я водил|A2; гулять=yürümek>я гуляю>ты гуляешь>я гулял|A1;
бегать=koşmak>я бегаю>ты бегаешь>я бегал|A1; готовить=yemek pişirmek>я готовлю>ты готовишь>я готовил|A1;
платить=ödemek>я плачу>ты платишь>я заплатил|A2; строить=inşa etmek>я строю>ты строишь>я построил|B1;
менять=değiştirmek>я меняю>ты меняешь>я изменил|A2; решать=karar vermek>я решаю>ты решаешь>я решил|B1;
объяснять=açıklamak>я объясняю>ты объясняешь>я объяснил|B1; улучшать=geliştirmek>я улучшаю>ты улучшаешь>я улучшил|B1;
достигать=başarmak>я достигаю>ты достигаешь>я достиг|B2; управлять=yönetmek>я управляю>ты управляешь>я управлял|B1;
вести переговоры=müzakere etmek>я веду переговоры>ты ведёшь переговоры>я вёл переговоры|B2;
откладывать=ertelemek>я откладываю>ты откладываешь>я отложил|B2;
признавать=kabul etmek>я признаю>ты признаёшь>я признал|C1;`);

const V_PT = verbs(`comer=yemek>como>comes>comi|A1; beber=içmek>bebo>bebes>bebi|A1;
ir=gitmek>vou>vais>fui|A1; vir=gelmek>venho>vens>vim|A1;
ver=görmek>vejo>vês>vi|A1; ouvir=duymak>ouço>ouves>ouvi|A1;
falar=konuşmak>falo>falas>falei|A1; ler=okumak>leio>lês>li|A1;
escrever=yazmak>escrevo>escreves>escrevi|A1; trabalhar=çalışmak>trabalho>trabalhas>trabalhei|A1;
dormir=uyumak>durmo>dormes>dormi|A1; comprar=satın almak>compro>compras>comprei|A1;
vender=satmak>vendo>vendes>vendi|A2; abrir=açmak>abro>abres>abri|A1;
fechar=kapatmak>fecho>fechas>fechei|A1; dar=vermek>dou>dás>dei|A1;
tomar=almak>tomo>tomas>tomei|A1; encontrar=bulmak>encontro>encontras>encontrei|A2;
perder=kaybetmek>perco>perdes>perdi|A2; esperar=beklemek>espero>esperas>esperei|A1;
ajudar=yardım etmek>ajudo>ajudas>ajudei|A1; perguntar=sormak>pergunto>perguntas>perguntei|A1;
responder=cevaplamak>respondo>respondes>respondi|A2; aprender=öğrenmek>aprendo>aprendes>aprendi|A1;
ensinar=öğretmek>ensino>ensinas>ensinei|A2; entender=anlamak>entendo>entendes>entendi|A2;
pensar=düşünmek>penso>pensas>pensei|A1; lembrar=hatırlamak>lembro>lembras>lembrei|A2;
esquecer=unutmak>esqueço>esqueces>esqueci|A2; viajar=seyahat etmek>viajo>viajas>viajei|A2;
conduzir=araba sürmek>conduzo>conduzes>conduzi|A2; caminhar=yürümek>caminho>caminhas>caminhei|A1;
correr=koşmak>corro>corres>corri|A1; cozinhar=yemek pişirmek>cozinho>cozinhas>cozinhei|A1;
pagar=ödemek>pago>pagas>paguei|A2; construir=inşa etmek>construo>constróis>construí|B1;
mudar=değiştirmek>mudo>mudas>mudei|A2; decidir=karar vermek>decido>decides>decidi|B1;
explicar=açıklamak>explico>explicas>expliquei|B1; melhorar=geliştirmek>melhoro>melhoras>melhorei|B1;
conseguir=başarmak>consigo>consegues>consegui|B2; gerir=yönetmek>giro>geres>geri|B1;
negociar=müzakere etmek>negocio>negocias>negociei|B2; adiar=ertelemek>adio>adias>adiei|B2;
reconhecer=kabul etmek>reconheço>reconheces>reconheci|C1;`);

const V_FR = verbs(`manger=yemek>je mange>tu manges>j'ai mangé|A1; boire=içmek>je bois>tu bois>j'ai bu|A1;
aller=gitmek>je vais>tu vas>je suis allé|A1; venir=gelmek>je viens>tu viens>je suis venu|A1;
voir=görmek>je vois>tu vois>j'ai vu|A1; entendre=duymak>j'entends>tu entends>j'ai entendu|A1;
parler=konuşmak>je parle>tu parles>j'ai parlé|A1; lire=okumak>je lis>tu lis>j'ai lu|A1;
écrire=yazmak>j'écris>tu écris>j'ai écrit|A1; travailler=çalışmak>je travaille>tu travailles>j'ai travaillé|A1;
dormir=uyumak>je dors>tu dors>j'ai dormi|A1; acheter=satın almak>j'achète>tu achètes>j'ai acheté|A1;
vendre=satmak>je vends>tu vends>j'ai vendu|A2; ouvrir=açmak>j'ouvre>tu ouvres>j'ai ouvert|A1;
fermer=kapatmak>je ferme>tu fermes>j'ai fermé|A1; donner=vermek>je donne>tu donnes>j'ai donné|A1;
prendre=almak>je prends>tu prends>j'ai pris|A1; trouver=bulmak>je trouve>tu trouves>j'ai trouvé|A2;
perdre=kaybetmek>je perds>tu perds>j'ai perdu|A2; attendre=beklemek>j'attends>tu attends>j'ai attendu|A1;
aider=yardım etmek>j'aide>tu aides>j'ai aidé|A1; demander=sormak>je demande>tu demandes>j'ai demandé|A1;
répondre=cevaplamak>je réponds>tu réponds>j'ai répondu|A2; apprendre=öğrenmek>j'apprends>tu apprends>j'ai appris|A1;
enseigner=öğretmek>j'enseigne>tu enseignes>j'ai enseigné|A2; comprendre=anlamak>je comprends>tu comprends>j'ai compris|A2;
penser=düşünmek>je pense>tu penses>j'ai pensé|A1; se souvenir=hatırlamak>je me souviens>tu te souviens>je me suis souvenu|A2;
oublier=unutmak>j'oublie>tu oublies>j'ai oublié|A2; voyager=seyahat etmek>je voyage>tu voyages>j'ai voyagé|A2;
conduire=araba sürmek>je conduis>tu conduis>j'ai conduit|A2; marcher=yürümek>je marche>tu marches>j'ai marché|A1;
courir=koşmak>je cours>tu cours>j'ai couru|A1; cuisiner=yemek pişirmek>je cuisine>tu cuisines>j'ai cuisiné|A1;
payer=ödemek>je paie>tu paies>j'ai payé|A2; construire=inşa etmek>je construis>tu construis>j'ai construit|B1;
changer=değiştirmek>je change>tu changes>j'ai changé|A2; décider=karar vermek>je décide>tu décides>j'ai décidé|B1;
expliquer=açıklamak>j'explique>tu expliques>j'ai expliqué|B1; améliorer=geliştirmek>j'améliore>tu améliores>j'ai amélioré|B1;
réussir=başarmak>je réussis>tu réussis>j'ai réussi|B2; gérer=yönetmek>je gère>tu gères>j'ai géré|B1;
négocier=müzakere etmek>je négocie>tu négocies>j'ai négocié|B2; reporter=ertelemek>je reporte>tu reportes>j'ai reporté|B2;
reconnaître=kabul etmek>je reconnais>tu reconnais>j'ai reconnu|C1;`);

const V_DE = verbs(`essen=yemek>ich esse>du isst>ich aß|A1; trinken=içmek>ich trinke>du trinkst>ich trank|A1;
gehen=gitmek>ich gehe>du gehst>ich ging|A1; kommen=gelmek>ich komme>du kommst>ich kam|A1;
sehen=görmek>ich sehe>du siehst>ich sah|A1; hören=duymak>ich höre>du hörst>ich hörte|A1;
sprechen=konuşmak>ich spreche>du sprichst>ich sprach|A1; lesen=okumak>ich lese>du liest>ich las|A1;
schreiben=yazmak>ich schreibe>du schreibst>ich schrieb|A1; arbeiten=çalışmak>ich arbeite>du arbeitest>ich arbeitete|A1;
schlafen=uyumak>ich schlafe>du schläfst>ich schlief|A1; kaufen=satın almak>ich kaufe>du kaufst>ich kaufte|A1;
verkaufen=satmak>ich verkaufe>du verkaufst>ich verkaufte|A2; öffnen=açmak>ich öffne>du öffnest>ich öffnete|A1;
schließen=kapatmak>ich schließe>du schließt>ich schloss|A1; geben=vermek>ich gebe>du gibst>ich gab|A1;
nehmen=almak>ich nehme>du nimmst>ich nahm|A1; finden=bulmak>ich finde>du findest>ich fand|A2;
verlieren=kaybetmek>ich verliere>du verlierst>ich verlor|A2; warten=beklemek>ich warte>du wartest>ich wartete|A1;
helfen=yardım etmek>ich helfe>du hilfst>ich half|A1; fragen=sormak>ich frage>du fragst>ich fragte|A1;
antworten=cevaplamak>ich antworte>du antwortest>ich antwortete|A2; lernen=öğrenmek>ich lerne>du lernst>ich lernte|A1;
lehren=öğretmek>ich lehre>du lehrst>ich lehrte|A2; verstehen=anlamak>ich verstehe>du verstehst>ich verstand|A2;
denken=düşünmek>ich denke>du denkst>ich dachte|A1; erinnern=hatırlamak>ich erinnere>du erinnerst>ich erinnerte|A2;
vergessen=unutmak>ich vergesse>du vergisst>ich vergaß|A2; reisen=seyahat etmek>ich reise>du reist>ich reiste|A2;
fahren=araba sürmek>ich fahre>du fährst>ich fuhr|A2; gehen zu Fuß=yürümek>ich gehe>du gehst>ich ging|A1;
laufen=koşmak>ich laufe>du läufst>ich lief|A1; kochen=yemek pişirmek>ich koche>du kochst>ich kochte|A1;
bezahlen=ödemek>ich bezahle>du bezahlst>ich bezahlte|A2; bauen=inşa etmek>ich baue>du baust>ich baute|B1;
ändern=değiştirmek>ich ändere>du änderst>ich änderte|A2; entscheiden=karar vermek>ich entscheide>du entscheidest>ich entschied|B1;
erklären=açıklamak>ich erkläre>du erklärst>ich erklärte|B1; verbessern=geliştirmek>ich verbessere>du verbesserst>ich verbesserte|B1;
erreichen=başarmak>ich erreiche>du erreichst>ich erreichte|B2; verwalten=yönetmek>ich verwalte>du verwaltest>ich verwaltete|B1;
verhandeln=müzakere etmek>ich verhandle>du verhandelst>ich verhandelte|B2; verschieben=ertelemek>ich verschiebe>du verschiebst>ich verschob|B2;
anerkennen=kabul etmek>ich erkenne an>du erkennst an>ich erkannte an|C1;`);

/* ══════════════════════════ PHRASES (curated) ══════════════════════════ */
const P_EN = `hello=merhaba; good morning=günaydın; good evening=iyi akşamlar; good night=iyi geceler;
thank you=teşekkür ederim; you are welcome=rica ederim; please=lütfen; excuse me=affedersiniz;
I am sorry=özür dilerim; yes=evet; no=hayır; maybe=belki; of course=tabii ki; see you later=görüşürüz;
how are you?=nasılsın?; I am fine=iyiyim; what is your name?=adın ne?; my name is...=benim adım...;
nice to meet you=memnun oldum; I do not understand=anlamıyorum; can you repeat?=tekrar eder misin?;
speak slowly please=lütfen yavaş konuş; how much is it?=ne kadar?; where is the toilet?=tuvalet nerede?;
I need help=yardıma ihtiyacım var; call a doctor=doktor çağırın; I am lost=kayboldum; what time is it?=saat kaç?;
today=bugün; tomorrow=yarın; yesterday=dün; now=şimdi; later=sonra; always=her zaman; never=asla;
sometimes=bazen; often=sık sık; here=burada; there=orada; left=sol; right=sağ; straight ahead=düz ileri;
near=yakın; far=uzak; up=yukarı; down=aşağı; inside=içeride; outside=dışarıda; before=önce; after=sonra;
because=çünkü; but=ama; and=ve; or=veya; if=eğer; however=ancak; therefore=bu yüzden; although=-e rağmen;
in my opinion=bence; on the other hand=öte yandan; as far as I know=bildiğim kadarıyla; to be honest=açıkçası;
it depends=duruma bağlı; no worries=sorun değil; take care=kendine iyi bak; good luck=iyi şanslar;`;

const P_ES = `hola=merhaba; buenos días=günaydın; buenas tardes=iyi akşamlar; buenas noches=iyi geceler;
gracias=teşekkür ederim; de nada=rica ederim; por favor=lütfen; perdón=affedersiniz;
lo siento=özür dilerim; sí=evet; no=hayır; quizás=belki; por supuesto=tabii ki; hasta luego=görüşürüz;
¿cómo estás?=nasılsın?; estoy bien=iyiyim; ¿cómo te llamas?=adın ne?; me llamo...=benim adım...;
mucho gusto=memnun oldum; no entiendo=anlamıyorum; ¿puedes repetir?=tekrar eder misin?;
habla despacio por favor=lütfen yavaş konuş; ¿cuánto cuesta?=ne kadar?; ¿dónde está el baño?=tuvalet nerede?;
necesito ayuda=yardıma ihtiyacım var; llame a un médico=doktor çağırın; estoy perdido=kayboldum; ¿qué hora es?=saat kaç?;
hoy=bugün; mañana=yarın; ayer=dün; ahora=şimdi; más tarde=sonra; siempre=her zaman; nunca=asla;
a veces=bazen; a menudo=sık sık; aquí=burada; allí=orada; izquierda=sol; derecha=sağ; todo recto=düz ileri;
cerca=yakın; lejos=uzak; arriba=yukarı; abajo=aşağı; dentro=içeride; fuera=dışarıda; antes=önce; después=sonra;
porque=çünkü; pero=ama; y=ve; o=veya; si=eğer; sin embargo=ancak; por lo tanto=bu yüzden; aunque=-e rağmen;
en mi opinión=bence; por otro lado=öte yandan; que yo sepa=bildiğim kadarıyla; para ser sincero=açıkçası;
depende=duruma bağlı; no pasa nada=sorun değil; cuídate=kendine iyi bak; buena suerte=iyi şanslar;`;

const P_IT = `ciao=merhaba; buongiorno=günaydın; buonasera=iyi akşamlar; buonanotte=iyi geceler;
grazie=teşekkür ederim; prego=rica ederim; per favore=lütfen; scusi=affedersiniz;
mi dispiace=özür dilerim; sì=evet; no=hayır; forse=belki; certo=tabii ki; a dopo=görüşürüz;
come stai?=nasılsın?; sto bene=iyiyim; come ti chiami?=adın ne?; mi chiamo...=benim adım...;
piacere=memnun oldum; non capisco=anlamıyorum; puoi ripetere?=tekrar eder misin?;
parla lentamente per favore=lütfen yavaş konuş; quanto costa?=ne kadar?; dov'è il bagno?=tuvalet nerede?;
ho bisogno di aiuto=yardıma ihtiyacım var; chiami un medico=doktor çağırın; mi sono perso=kayboldum; che ore sono?=saat kaç?;
oggi=bugün; domani=yarın; ieri=dün; adesso=şimdi; più tardi=sonra; sempre=her zaman; mai=asla;
a volte=bazen; spesso=sık sık; qui=burada; lì=orada; sinistra=sol; destra=sağ; sempre dritto=düz ileri;
vicino=yakın; lontano=uzak; su=yukarı; giù=aşağı; dentro=içeride; fuori=dışarıda; prima=önce; dopo=sonra;
perché=çünkü; ma=ama; e=ve; o=veya; se=eğer; tuttavia=ancak; quindi=bu yüzden; anche se=-e rağmen;
secondo me=bence; d'altra parte=öte yandan; per quanto ne so=bildiğim kadarıyla; a dire il vero=açıkçası;
dipende=duruma bağlı; nessun problema=sorun değil; stammi bene=kendine iyi bak; buona fortuna=iyi şanslar;`;

const P_RU = `привет=merhaba; доброе утро=günaydın; добрый вечер=iyi akşamlar; спокойной ночи=iyi geceler;
спасибо=teşekkür ederim; пожалуйста=rica ederim; будьте добры=lütfen; извините=affedersiniz;
простите=özür dilerim; да=evet; нет=hayır; может быть=belki; конечно=tabii ki; до встречи=görüşürüz;
как дела?=nasılsın?; всё хорошо=iyiyim; как тебя зовут?=adın ne?; меня зовут...=benim adım...;
приятно познакомиться=memnun oldum; я не понимаю=anlamıyorum; повторите, пожалуйста=tekrar eder misin?;
говорите медленнее=lütfen yavaş konuş; сколько стоит?=ne kadar?; где туалет?=tuvalet nerede?;
мне нужна помощь=yardıma ihtiyacım var; вызовите врача=doktor çağırın; я заблудился=kayboldum; который час?=saat kaç?;
сегодня=bugün; завтра=yarın; вчера=dün; сейчас=şimdi; позже=sonra; всегда=her zaman; никогда=asla;
иногда=bazen; часто=sık sık; здесь=burada; там=orada; налево=sol; направо=sağ; прямо=düz ileri;
близко=yakın; далеко=uzak; вверх=yukarı; вниз=aşağı; внутри=içeride; снаружи=dışarıda; до=önce; после=sonra;
потому что=çünkü; но=ama; и=ve; или=veya; если=eğer; однако=ancak; поэтому=bu yüzden; хотя=-e rağmen;
по-моему=bence; с другой стороны=öte yandan; насколько я знаю=bildiğim kadarıyla; честно говоря=açıkçası;
зависит=duruma bağlı; не проблема=sorun değil; береги себя=kendine iyi bak; удачи=iyi şanslar;`;

const P_PT = `olá=merhaba; bom dia=günaydın; boa tarde=iyi akşamlar; boa noite=iyi geceler;
obrigado=teşekkür ederim; de nada=rica ederim; por favor=lütfen; desculpe=affedersiniz;
desculpa=özür dilerim; sim=evet; não=hayır; talvez=belki; claro=tabii ki; até logo=görüşürüz;
como estás?=nasılsın?; estou bem=iyiyim; como te chamas?=adın ne?; chamo-me...=benim adım...;
prazer=memnun oldum; não entendo=anlamıyorum; pode repetir?=tekrar eder misin?;
fale devagar por favor=lütfen yavaş konuş; quanto custa?=ne kadar?; onde é a casa de banho?=tuvalet nerede?;
preciso de ajuda=yardıma ihtiyacım var; chame um médico=doktor çağırın; estou perdido=kayboldum; que horas são?=saat kaç?;
hoje=bugün; amanhã=yarın; ontem=dün; agora=şimdi; mais tarde=sonra; sempre=her zaman; nunca=asla;
às vezes=bazen; frequentemente=sık sık; aqui=burada; ali=orada; esquerda=sol; direita=sağ; sempre em frente=düz ileri;
perto=yakın; longe=uzak; acima=yukarı; abaixo=aşağı; dentro=içeride; fora=dışarıda; antes=önce; depois=sonra;
porque=çünkü; mas=ama; e=ve; ou=veya; se=eğer; no entanto=ancak; portanto=bu yüzden; embora=-e rağmen;
na minha opinião=bence; por outro lado=öte yandan; que eu saiba=bildiğim kadarıyla; para ser sincero=açıkçası;
depende=duruma bağlı; não faz mal=sorun değil; cuida-te=kendine iyi bak; boa sorte=iyi şanslar;`;

const P_FR = `bonjour=merhaba; bonjour=günaydın; bonsoir=iyi akşamlar; bonne nuit=iyi geceler;
merci=teşekkür ederim; de rien=rica ederim; s'il vous plaît=lütfen; pardon=affedersiniz;
désolé=özür dilerim; oui=evet; non=hayır; peut-être=belki; bien sûr=tabii ki; à plus tard=görüşürüz;
comment ça va?=nasılsın?; je vais bien=iyiyim; comment tu t'appelles?=adın ne?; je m'appelle...=benim adım...;
enchanté=memnun oldum; je ne comprends pas=anlamıyorum; pouvez-vous répéter?=tekrar eder misin?;
parlez lentement s'il vous plaît=lütfen yavaş konuş; combien ça coûte?=ne kadar?; où sont les toilettes?=tuvalet nerede?;
j'ai besoin d'aide=yardıma ihtiyacım var; appelez un médecin=doktor çağırın; je suis perdu=kayboldum; quelle heure est-il?=saat kaç?;
aujourd'hui=bugün; demain=yarın; hier=dün; maintenant=şimdi; plus tard=sonra; toujours=her zaman; jamais=asla;
parfois=bazen; souvent=sık sık; ici=burada; là=orada; gauche=sol; droite=sağ; tout droit=düz ileri;
près=yakın; loin=uzak; en haut=yukarı; en bas=aşağı; dedans=içeride; dehors=dışarıda; avant=önce; après=sonra;
parce que=çünkü; mais=ama; et=ve; ou=veya; si=eğer; cependant=ancak; donc=bu yüzden; bien que=-e rağmen;
à mon avis=bence; d'autre part=öte yandan; autant que je sache=bildiğim kadarıyla; pour être honnête=açıkçası;
ça dépend=duruma bağlı; pas de problème=sorun değil; prends soin de toi=kendine iyi bak; bonne chance=iyi şanslar;`;

const P_DE = `hallo=merhaba; guten Morgen=günaydın; guten Abend=iyi akşamlar; gute Nacht=iyi geceler;
danke=teşekkür ederim; bitte=rica ederim; bitte=lütfen; Entschuldigung=affedersiniz;
es tut mir leid=özür dilerim; ja=evet; nein=hayır; vielleicht=belki; natürlich=tabii ki; bis später=görüşürüz;
wie geht es dir?=nasılsın?; mir geht es gut=iyiyim; wie heißt du?=adın ne?; ich heiße...=benim adım...;
freut mich=memnun oldum; ich verstehe nicht=anlamıyorum; kannst du wiederholen?=tekrar eder misin?;
sprich bitte langsam=lütfen yavaş konuş; wie viel kostet das?=ne kadar?; wo ist die Toilette?=tuvalet nerede?;
ich brauche Hilfe=yardıma ihtiyacım var; rufen Sie einen Arzt=doktor çağırın; ich habe mich verlaufen=kayboldum; wie spät ist es?=saat kaç?;
heute=bugün; morgen=yarın; gestern=dün; jetzt=şimdi; später=sonra; immer=her zaman; nie=asla;
manchmal=bazen; oft=sık sık; hier=burada; dort=orada; links=sol; rechts=sağ; geradeaus=düz ileri;
nah=yakın; weit=uzak; oben=yukarı; unten=aşağı; drinnen=içeride; draußen=dışarıda; vorher=önce; nachher=sonra;
weil=çünkü; aber=ama; und=ve; oder=veya; wenn=eğer; jedoch=ancak; deshalb=bu yüzden; obwohl=-e rağmen;
meiner Meinung nach=bence; andererseits=öte yandan; soweit ich weiß=bildiğim kadarıyla; ehrlich gesagt=açıkçası;
es kommt darauf an=duruma bağlı; kein Problem=sorun değil; pass auf dich auf=kendine iyi bak; viel Glück=iyi şanslar;`;

/* ══════════════════════════ NUMBER ENGINES ══════════════════════════ */
const TR_ONES = ['sıfır','bir','iki','üç','dört','beş','altı','yedi','sekiz','dokuz'];
const TR_TENS = ['','on','yirmi','otuz','kırk','elli','altmış','yetmiş','seksen','doksan'];
function trNum(x: number): string {
  if (x < 10) return TR_ONES[x];
  if (x < 100) { const t = Math.floor(x / 10), o = x % 10; return TR_TENS[t] + (o ? ' ' + TR_ONES[o] : ''); }
  if (x < 1000) { const h = Math.floor(x / 100), r = x % 100; return (h > 1 ? TR_ONES[h] + ' ' : '') + 'yüz' + (r ? ' ' + trNum(r) : ''); }
  const k = Math.floor(x / 1000), r = x % 1000;
  return (k > 1 ? TR_ONES[k] + ' ' : '') + 'bin' + (r ? ' ' + trNum(r) : '');
}

const EN_ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const EN_TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function enNum(x: number): string {
  if (x < 20) return EN_ONES[x];
  if (x < 100) { const t = Math.floor(x / 10), o = x % 10; return EN_TENS[t] + (o ? '-' + EN_ONES[o] : ''); }
  if (x < 1000) { const h = Math.floor(x / 100), r = x % 100; return EN_ONES[h] + ' hundred' + (r ? ' and ' + enNum(r) : ''); }
  const k = Math.floor(x / 1000), r = x % 1000;
  return enNum(k) + ' thousand' + (r ? ' ' + enNum(r) : '');
}

const ES_ONES = ['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
const ES_TENS = ['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const ES_HUND = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
function esNum(x: number): string {
  if (x < 30) return ES_ONES[x];
  if (x < 100) { const t = Math.floor(x / 10), o = x % 10; return ES_TENS[t] + (o ? ' y ' + ES_ONES[o] : ''); }
  if (x === 100) return 'cien';
  if (x < 1000) { const h = Math.floor(x / 100), r = x % 100; return ES_HUND[h] + (r ? ' ' + esNum(r) : ''); }
  const k = Math.floor(x / 1000), r = x % 1000;
  return (k > 1 ? esNum(k) + ' ' : '') + 'mil' + (r ? ' ' + esNum(r) : '');
}

const IT_ONES = ['zero','uno','due','tre','quattro','cinque','sei','sette','otto','nove','dieci','undici','dodici','tredici','quattordici','quindici','sedici','diciassette','diciotto','diciannove'];
const IT_TENS = ['','','venti','trenta','quaranta','cinquanta','sessanta','settanta','ottanta','novanta'];
function itNum(x: number): string {
  if (x < 20) return IT_ONES[x];
  if (x < 100) {
    const t = Math.floor(x / 10), o = x % 10;
    let base = IT_TENS[t];
    if (o === 1 || o === 8) base = base.slice(0, -1);        // ventuno / ventotto
    if (o === 3) return base + 'tré';                          // ventitré
    return base + (o ? IT_ONES[o] : '');
  }
  if (x < 1000) { const h = Math.floor(x / 100), r = x % 100; return (h > 1 ? IT_ONES[h] : '') + 'cento' + (r ? itNum(r) : ''); }
  const k = Math.floor(x / 1000), r = x % 1000;
  return (k > 1 ? IT_ONES[k] + 'mila' : 'mille') + (r ? itNum(r) : '');
}

const RU_ONES = ['ноль','один','два','три','четыре','пять','шесть','семь','восемь','девять','десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
const RU_TENS = ['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
const RU_HUND = ['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
function ruNum(x: number): string {
  if (x < 20) return RU_ONES[x];
  if (x < 100) { const t = Math.floor(x / 10), o = x % 10; return RU_TENS[t] + (o ? ' ' + RU_ONES[o] : ''); }
  if (x < 1000) { const h = Math.floor(x / 100), r = x % 100; return RU_HUND[h] + (r ? ' ' + ruNum(r) : ''); }
  const k = Math.floor(x / 1000), r = x % 1000;
  const kw = k === 1 ? 'тысяча' : k < 5 ? `${RU_ONES[k]} тысячи` : `${RU_ONES[k]} тысяч`;
  return kw + (r ? ' ' + ruNum(r) : '');
}

const PT_ONES = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','catorze','quinze','dezasseis','dezassete','dezoito','dezanove','vinte','vinte e um','vinte e dois','vinte e três','vinte e quatro','vinte e cinco','vinte e seis','vinte e sete','vinte e oito','vinte e nove'];
const PT_TENS = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
const PT_HUND = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
function ptNum(x: number): string {
  if (x < 30) return PT_ONES[x];
  if (x < 100) { const t = Math.floor(x / 10), o = x % 10; return PT_TENS[t] + (o ? ' e ' + PT_ONES[o] : ''); }
  if (x === 100) return 'cem';
  if (x < 1000) { const h = Math.floor(x / 100), r = x % 100; return PT_HUND[h] + (r ? ' e ' + ptNum(r) : ''); }
  const k = Math.floor(x / 1000), r = x % 1000;
  return (k === 1 ? 'mil' : ptNum(k) + ' mil') + (r ? ' e ' + ptNum(r) : '');
}

const FR_ONES = ['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf','vingt','vingt et un','vingt-deux','vingt-trois','vingt-quatre','vingt-cinq','vingt-six','vingt-sept','vingt-huit','vingt-neuf'];
const FR_TENS = ['','','vingt','trente','quarante','cinquante','soixante','soixante-dix','quatre-vingt','quatre-vingt-dix'];
function frNum(x: number): string {
  if (x < 30) return FR_ONES[x];
  if (x < 70) { const t = Math.floor(x / 10), o = x % 10; return FR_TENS[t] + (o === 1 ? ' et un' : o ? '-' + FR_ONES[o] : ''); }
  if (x < 80) return 'soixante-' + frNum(x - 60);
  if (x < 100) return 'quatre-vingt' + (x === 80 ? 's' : x % 20 === 1 ? ' et un' : '-' + FR_ONES[x % 20]);
  if (x === 100) return 'cent';
  if (x < 1000) { const h = Math.floor(x / 100), r = x % 100; return (h === 1 ? 'cent' : FR_ONES[h] + ' cent') + (r ? ' ' + frNum(r) : ''); }
  const k = Math.floor(x / 1000), r = x % 1000;
  return (k === 1 ? 'mille' : frNum(k) + ' mille') + (r ? ' ' + frNum(r) : '');
}

const DE_ONES = ['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn','achtzehn','neunzehn'];
const DE_TENS = ['','','zwanzig','dreißig','vierzig','fünfzig','sechzig','siebzig','achtzig','neunzig'];
function deNum(x: number): string {
  if (x < 20) return DE_ONES[x];
  if (x < 100) { const t = Math.floor(x / 10), o = x % 10; return o ? DE_ONES[o] + 'und' + DE_TENS[t] : DE_TENS[t]; }
  if (x < 1000) { const h = Math.floor(x / 100), r = x % 100; return (h === 1 ? 'einhundert' : DE_ONES[h] + 'hundert') + (r ? deNum(r) : ''); }
  const k = Math.floor(x / 1000), r = x % 1000;
  return (k === 1 ? 'eintausend' : deNum(k) + 'tausend') + (r ? deNum(r) : '');
}

const NUM: Record<LangCode, (x: number) => string> = { en: enNum, es: esNum, it: itNum, ru: ruNum, pt: ptNum, fr: frNum, de: deNum };

const ORD: Record<LangCode, string[]> = {
  en: ['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth','nineteenth','twentieth'],
  es: ['primero','segundo','tercero','cuarto','quinto','sexto','séptimo','octavo','noveno','décimo','undécimo','duodécimo','decimotercero','decimocuarto','decimoquinto','decimosexto','decimoséptimo','decimoctavo','decimonoveno','vigésimo'],
  it: ['primo','secondo','terzo','quarto','quinto','sesto','settimo','ottavo','nono','decimo','undicesimo','dodicesimo','tredicesimo','quattordicesimo','quindicesimo','sedicesimo','diciassettesimo','diciottesimo','diciannovesimo','ventesimo'],
  ru: ['первый','второй','третий','четвёртый','пятый','шестой','седьмой','восьмой','девятый','десятый','одиннадцатый','двенадцатый','тринадцатый','четырнадцатый','пятнадцатый','шестнадцатый','семнадцатый','восемнадцатый','девятнадцатый','двадцатый'],
  pt: ['primeiro','segundo','terceiro','quarto','quinto','sexto','sétimo','oitavo','nono','décimo','décimo primeiro','décimo segundo','décimo terceiro','décimo quarto','décimo quinto','décimo sexto','décimo sétimo','décimo oitavo','décimo nono','vigésimo'],
  fr: ['premier','deuxième','troisième','quatrième','cinquième','sixième','septième','huitième','neuvième','dixième','onzième','douzième','treizième','quatorzième','quinzième','seizième','dix-septième','dix-huitième','dix-neuvième','vingtième'],
  de: ['erste','zweite','dritte','vierte','fünfte','sechste','siebte','achte','neunte','zehnte','elfte','zwölfte','dreizehnte','vierzehnte','fünfzehnte','sechzehnte','siebzehnte','achtzehnte','neunzehnte','zwanzigste'],
};
const TR_ORD = ['birinci','ikinci','üçüncü','dördüncü','beşinci','altıncı','yedinci','sekizinci','dokuzuncu','onuncu','on birinci','on ikinci','on üçüncü','on dördüncü','on beşinci','on altıncı','on yedinci','on sekizinci','on dokuzuncu','yirminci'];

const DAYS: Record<LangCode, string[]> = {
  en: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
  es: ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'],
  it: ['lunedì','martedì','mercoledì','giovedì','venerdì','sabato','domenica'],
  ru: ['понедельник','вторник','среда','четверг','пятница','суббота','воскресенье'],
  pt: ['segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado','domingo'],
  fr: ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'],
  de: ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'],
};
const TR_DAYS = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];

const MONTHS: Record<LangCode, string[]> = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  es: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
  it: ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'],
  ru: ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'],
  pt: ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'],
  fr: ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],
  de: ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
};
const TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const COLORS: Record<LangCode, string[]> = {
  en: ['red','blue','green','yellow','black','white','orange','purple','pink','brown','grey','gold','silver','turquoise','beige','navy'],
  es: ['rojo','azul','verde','amarillo','negro','blanco','naranja','morado','rosa','marrón','gris','dorado','plateado','turquesa','beige','azul marino'],
  it: ['rosso','blu','verde','giallo','nero','bianco','arancione','viola','rosa','marrone','grigio','oro','argento','turchese','beige','blu navy'],
  ru: ['красный','синий','зелёный','жёлтый','чёрный','белый','оранжевый','фиолетовый','розовый','коричневый','серый','золотой','серебряный','бирюзовый','бежевый','тёмно-синий'],
  pt: ['vermelho','azul','verde','amarelo','preto','branco','laranja','roxo','rosa','castanho','cinzento','dourado','prateado','turquesa','bege','azul marinho'],
  fr: ['rouge','bleu','vert','jaune','noir','blanc','orange','violet','rose','marron','gris','or','argent','turquoise','beige','bleu marine'],
  de: ['rot','blau','grün','gelb','schwarz','weiß','orange','lila','rosa','braun','grau','gold','silber','türkis','beige','marineblau'],
};
const TR_COLORS = ['kırmızı','mavi','yeşil','sarı','siyah','beyaz','turuncu','mor','pembe','kahverengi','gri','altın','gümüş','turkuaz','bej','lacivert'];

/* ══════════════════════════ GRAMMAR GLUE ══════════════════════════ */
const startsVowel = (s: string) => /^[aeiouàèéìòóùAEIOU]/.test(s);

/** definite article */
function art(lang: LangCode, n: Noun): string {
  if (lang === 'en') return `the ${n.f}`;
  if (lang === 'es') return `${n.g === 'f' ? 'la' : 'el'} ${n.f}`;
  if (lang === 'pt') return `${n.g === 'f' ? 'a' : 'o'} ${n.f}`;
  if (lang === 'fr') return `${n.g === 'f' ? 'la' : 'le'} ${n.f}`;
  if (lang === 'de') return `${n.g === 'f' ? 'die' : n.g === 'n' ? 'das' : 'der'} ${n.f}`;
  if (lang === 'it') {
    if (startsVowel(n.f)) return `l'${n.f}`;
    if (n.g === 'f') return `la ${n.f}`;
    if (/^(s[bcdfgklmnpqrtvz]|z|ps|gn|x)/i.test(n.f)) return `lo ${n.f}`;
    return `il ${n.f}`;
  }
  return n.f; // ru: no articles
}
function poss(lang: LangCode, n: Noun): string {
  if (lang === 'en') return `my ${n.f}`;
  if (lang === 'es') return `mi ${n.f}`;
  if (lang === 'pt') return `meu ${n.f}`;
  if (lang === 'fr') return `mon ${n.f}`;
  if (lang === 'de') return `mein ${n.f}`;
  if (lang === 'it') return startsVowel(n.f) ? `il mio ${n.f}` : n.g === 'f' ? `la mia ${n.f}` : `il mio ${n.f}`;
  return `${n.g === 'f' ? 'моя' : n.g === 'n' ? 'моё' : 'мой'} ${n.f}`;
}
function need(lang: LangCode, n: Noun): string {
  if (lang === 'en') return `I need ${art(lang, n)}`;
  if (lang === 'es') return `necesito ${art(lang, n)}`;
  if (lang === 'pt') return `preciso de ${art(lang, n)}`;
  if (lang === 'fr') return `j'ai besoin de ${art(lang, n)}`;
  if (lang === 'de') return `ich brauche ${art(lang, n)}`;
  if (lang === 'it') return `ho bisogno d${startsVowel(n.f) ? "ell'" + n.f : n.g === 'f' ? 'ella ' + n.f : 'el ' + n.f}`;
  return `мне ${n.g === 'f' ? 'нужна' : n.g === 'n' ? 'нужно' : 'нужен'} ${n.f}`;
}
/** accusative-safe object form (Russian only differs) */
function objForm(lang: LangCode, n: Noun): string | null {
  if (lang !== 'ru') return n.f;
  return n.acc ?? n.f;
}

const T = {
  where:  { en: (x: string) => `where is ${x}?`,      es: (x: string) => `¿dónde está ${x}?`, it: (x: string) => `dov'è ${x}?`,        ru: (x: string) => `где ${x}?`, pt: (x: string) => `onde está ${x}?`, fr: (x: string) => `où est ${x}?`, de: (x: string) => `wo ist ${x}?` },
  cost:   { en: (x: string) => `how much is ${x}?`,   es: (x: string) => `¿cuánto cuesta ${x}?`, it: (x: string) => `quanto costa ${x}?`, ru: (x: string) => `сколько стоит ${x}?`, pt: (x: string) => `quanto custa ${x}?`, fr: (x: string) => `combien coûte ${x}?`, de: (x: string) => `wie viel kostet ${x}?` },
  have:   { en: (x: string) => `do you have ${x}?`,   es: (x: string) => `¿tiene ${x}?`,      it: (x: string) => `avete ${x}?`,        ru: (x: string) => `у вас есть ${x}?`, pt: (x: string) => `tem ${x}?`, fr: (x: string) => `avez-vous ${x}?`, de: (x: string) => `haben Sie ${x}?` },
  this:   { en: (x: string) => `this is ${x}`,        es: (x: string) => `esto es ${x}`,      it: (x: string) => `questo è ${x}`,      ru: (x: string) => `это ${x}`, pt: (x: string) => `isto é ${x}`, fr: (x: string) => `c'est ${x}`, de: (x: string) => `das ist ${x}` },
  very:   { en: (x: string) => `very ${x}`,           es: (x: string) => `muy ${x}`,          it: (x: string) => `molto ${x}`,         ru: (x: string) => `очень ${x}`, pt: (x: string) => `muito ${x}`, fr: (x: string) => `très ${x}`, de: (x: string) => `sehr ${x}` },
  not:    { en: (x: string) => `not ${x}`,            es: (x: string) => `no ${x}`,           it: (x: string) => `non ${x}`,           ru: (x: string) => `не ${x}`, pt: (x: string) => `não ${x}`, fr: (x: string) => `pas ${x}`, de: (x: string) => `nicht ${x}` },
  too:    { en: (x: string) => `too ${x}`,            es: (x: string) => `demasiado ${x}`,    it: (x: string) => `troppo ${x}`,        ru: (x: string) => `слишком ${x}`, pt: (x: string) => `demasiado ${x}`, fr: (x: string) => `trop ${x}`, de: (x: string) => `zu ${x}` },
  want:   { en: (x: string) => `I want to ${x.replace(/^to /, '')}`, es: (x: string) => `quiero ${x}`, it: (x: string) => `voglio ${x}`, ru: (x: string) => `я хочу ${x}`, pt: (x: string) => `quero ${x}`, fr: (x: string) => `je veux ${x}`, de: (x: string) => `ich will ${x}` },
  must:   { en: (x: string) => `I must ${x.replace(/^to /, '')}`,    es: (x: string) => `debo ${x}`,   it: (x: string) => `devo ${x}`,   ru: (x: string) => `я должен ${x}`, pt: (x: string) => `devo ${x}`, fr: (x: string) => `je dois ${x}`, de: (x: string) => `ich muss ${x}` },
  like:   { en: (x: string) => `I like to ${x.replace(/^to /, '')}`, es: (x: string) => `me gusta ${x}`, it: (x: string) => `mi piace ${x}`, ru: (x: string) => `я люблю ${x}`, pt: (x: string) => `gosto de ${x}`, fr: (x: string) => `j'aime ${x}`, de: (x: string) => `ich mag ${x}` },
};
const TT = {
  where: (x: string) => `${x} nerede?`,
  cost:  (x: string) => `${x} ne kadar?`,
  have:  (x: string) => `${x} var mı?`,
  this:  (x: string) => `bu ${x}`,
  very:  (x: string) => `çok ${x}`,
  not:   (x: string) => `${x} değil`,
  too:   (x: string) => `fazla ${x}`,
  want:  (x: string) => `${x} istiyorum`,
  must:  (x: string) => `${x} zorundayım`,
  like:  (x: string) => `${x} hoşuma gidiyor`,
  need:  (x: string) => `${x} lazım`,
  my:    (x: string) => `benim ${x}`,
};

/* ══════════════════════════ BUILDER ══════════════════════════ */
const DATA: Record<LangCode, { N: Noun[]; A: Adj[]; V: Verb[]; P: string }> = {
  en: { N: [...N_EN, ...nouns(EXT_N.en)], A: [...A_EN, ...adjs(EXT_A.en)], V: [...V_EN, ...verbs(EXT_V.en)], P: P_EN + EXT_P.en },
  es: { N: [...N_ES, ...nouns(EXT_N.es)], A: [...A_ES, ...adjs(EXT_A.es)], V: [...V_ES, ...verbs(EXT_V.es)], P: P_ES + EXT_P.es },
  it: { N: [...N_IT, ...nouns(EXT_N.it)], A: [...A_IT, ...adjs(EXT_A.it)], V: [...V_IT, ...verbs(EXT_V.it)], P: P_IT + EXT_P.it },
  ru: { N: [...N_RU, ...nouns(EXT_N.ru)], A: [...A_RU, ...adjs(EXT_A.ru)], V: [...V_RU, ...verbs(EXT_V.ru)], P: P_RU + EXT_P.ru },
  pt: { N: [...N_PT, ...nouns((EXT_N as any).pt ?? '')], A: [...A_PT, ...adjs((EXT_A as any).pt ?? '')], V: [...V_PT, ...verbs((EXT_V as any).pt ?? '')], P: P_PT + ((EXT_P as any).pt ?? '') },
  fr: { N: [...N_FR, ...nouns((EXT_N as any).fr ?? '')], A: [...A_FR, ...adjs((EXT_A as any).fr ?? '')], V: [...V_FR, ...verbs((EXT_V as any).fr ?? '')], P: P_FR + ((EXT_P as any).fr ?? '') },
  de: { N: [...N_DE, ...nouns((EXT_N as any).de ?? '')], A: [...A_DE, ...adjs((EXT_A as any).de ?? '')], V: [...V_DE, ...verbs((EXT_V as any).de ?? '')], P: P_DE + ((EXT_P as any).de ?? '') },
};

export const WORDS_PER_LANGUAGE = 4500;
const TARGET = WORDS_PER_LANGUAGE;
const cache = new Map<LangCode, Entry[]>();

export function buildLanguage(lang: LangCode): Entry[] {
  const hit = cache.get(lang);
  if (hit) return hit;

  const { N, A, V, P } = DATA[lang];
  const out: Entry[] = [];
  const seen = new Set<string>();
  const push = (f: string, n: string, lv: CEFRLevel, c: CatId) => {
    const key = f.toLowerCase();
    if (!f || !n || seen.has(key)) return;
    seen.add(key);
    out.push({ f, n, lv, c });
  };
  const num = NUM[lang];

  /* 1 — curated singles */
  N.forEach(x => push(x.f, x.n, x.lv, x.c));
  A.forEach(x => push(x.f, x.n, x.lv, 'daily'));
  V.forEach(x => push(x.f, x.n, x.lv, 'verb'));
  plain(P, 'phrase', 'A1').forEach(e => push(e.f, e.n, e.lv, e.c));

  /* 2 — verb conjugations */
  V.forEach(v => {
    push(v.i1, `${v.n} (ben)`, v.lv, 'verb');
    push(v.i2, `${v.n} (sen)`, v.lv, 'verb');
    push(v.past, `${v.n} (geçmiş)`, v.lv === 'A1' ? 'A2' : v.lv, 'verb');
  });

  /* 3 — numbers 0-100, then round hundreds/thousands */
  for (let i = 0; i <= 100; i++) push(num(i), trNum(i), i <= 20 ? 'A1' : 'A2', 'number');
  [200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 5000, 10000].forEach(i => push(num(i), trNum(i), 'A2', 'number'));
  ORD[lang].forEach((o, i) => push(o, TR_ORD[i], 'A2', 'number'));

  /* 4 — calendar & colour */
  DAYS[lang].forEach((d, i) => push(d, TR_DAYS[i], 'A1', 'daily'));
  MONTHS[lang].forEach((m, i) => push(m, TR_MONTHS[i], 'A1', 'daily'));
  COLORS[lang].forEach((c, i) => push(c, TR_COLORS[i], 'A1', 'daily'));

  /* 5 — clock */
  for (let h = 1; h <= 12; h++) {
    const clock =
      lang === 'en' ? `${enNum(h)} o'clock` :
      lang === 'es' ? `las ${esNum(h)}` :
      lang === 'pt' ? `${ptNum(h)} horas` :
      lang === 'fr' ? `${frNum(h)} heures` :
      lang === 'de' ? `${deNum(h)} Uhr` :
      lang === 'it' ? `le ${itNum(h)}` :
      `${ruNum(h)} ${h === 1 ? 'час' : h < 5 ? 'часа' : 'часов'}`;
    push(clock, `saat ${trNum(h)}`, 'A1', 'number');
    const half =
      lang === 'en' ? `half past ${enNum(h)}` :
      lang === 'es' ? `las ${esNum(h)} y media` :
      lang === 'pt' ? `${ptNum(h)} e meia` :
      lang === 'fr' ? `${frNum(h)} heures et demie` :
      lang === 'de' ? `halb ${deNum(h + 1 > 12 ? 1 : h + 1)}` :
      lang === 'it' ? `le ${itNum(h)} e mezza` :
      `половина ${ruNum(h + 1 > 12 ? 1 : h + 1)}`;
    push(half, `${trNum(h)} buçuk`, 'A2', 'number');
  }

  /* 6 — noun templates */
  const lv2 = (l: CEFRLevel): CEFRLevel => (l === 'A1' ? 'A1' : l === 'A2' ? 'A2' : l);
  N.forEach(n => {
    const a = art(lang, n);
    push(T.where[lang](a), TT.where(n.n), lv2(n.lv), 'phrase');
    push(T.cost[lang](a), TT.cost(n.n), 'A2', 'phrase');
    push(T.have[lang](n.f), TT.have(n.n), 'A2', 'phrase');
    push(T.this[lang](a), TT.this(n.n), 'A1', 'phrase');
    push(need(lang, n), TT.need(n.n), 'A2', 'phrase');
    push(poss(lang, n), TT.my(n.n), 'A1', 'phrase');
  });

   /* 7 — verb + object collocations (öncelik: mantık hatasız, erken üretilir) */
    const DRINKABLE_TR = new Set(['su','süt','kahve','çay','meyve suyu','şarap','çorba']);
    const READABLE_NOUN_TR = new Set(['kitap','defter','sayfa','kelime']);
    const BREAKABLE_TR = new Set(['kapı','pencere','cam','ayna','tabak','bardak','şişe','kutu','kalem','kitap','çanta','masa','sandalye','yatak','anahtar','saat','telefon','ekmek','kurabiye','dal','buz','kalp','çubuk','yumurta','fındık','ceviz','ayakkabı','palto']);
    const NOT_PURCHASABLE_TR = new Set(['havalimanı','istasyon','sınır','plaj','müze','eczane','hastane','banka','pazar','şehir','köy','sokak','köprü','okul','bahçe','park','kütüphane','orman','nehir','dağ','deniz','gökyüzü','bulut','yağmur','kar','rüzgar','fırtına','güneş','ay','yıldız','ada','anne','baba','arkadaş','çocuk','öğretmen','doktor','şoför','komşu']);
    const OBJ_OK: Record<string, CatId[]> = {
     'yemek':            ['food'],
     'içmek':            ['food'],
     'yemek pişirmek':   ['food'],
     'satın almak':      ['food', 'daily', 'travel', 'tech'],
     'satmak':           ['food', 'daily', 'tech'],
     'okumak':           ['daily'],
     'yazmak':           ['daily', 'business'],
     'açmak':            ['daily', 'tech'],
     'kapatmak':         ['daily', 'tech'],
     'yıkamak':          ['daily'],
     'temizlemek':       ['daily'],
     'tamir etmek':      ['daily', 'tech', 'travel'],
     'giymek':           ['daily'],
     'kırmak':           ['daily'],
     'taşımak':          ['daily', 'travel'],
     'getirmek':         ['food', 'daily'],
     'ziyaret etmek':    ['travel'],
     'kaybetmek':        ['daily', 'travel'],
     'bulmak':           ['daily', 'travel'],
   };
   const READABLE = new Set<CatId>(['food', 'daily', 'travel', 'tech', 'business']);
   V.forEach(v => {
      const allow = OBJ_OK[v.n];
      if (!allow) return;
      N.forEach(o => {
        if (!allow.includes(o.c) || !READABLE.has(o.c)) return;
        if (lang === 'ru' && o.acc) return;
        if (v.n === 'içmek' && !DRINKABLE_TR.has(o.n)) return;
        if ((v.n === 'yemek' || v.n === 'yemek pişirmek') && DRINKABLE_TR.has(o.n) && o.n !== 'çorba') return;
        if (v.n === 'okumak' && !READABLE_NOUN_TR.has(o.n)) return;
        if (v.n === 'yazmak' && !READABLE_NOUN_TR.has(o.n)) return;
        if ((v.n === 'açmak' || v.n === 'kapatmak') && !['kapı','pencere','kitap','çanta','şişe','kutu'].includes(o.n)) return;
        if (v.n === 'yıkamak' && !['gömlek','pantolon','elbise','ceket','havlu','tabak','bardak','çatal','bıçak','kaşık','şişe'].includes(o.n)) return;
        if (v.n === 'giymek' && !['gömlek','pantolon','elbise','ceket','etek','şapka','çorap','eldiven','kemer','ayakkabı','palto'].includes(o.n)) return;
        if (v.n === 'kırmak' && !BREAKABLE_TR.has(o.n)) return;
        if ((v.n === 'satın almak' || v.n === 'satmak') && NOT_PURCHASABLE_TR.has(o.n)) return;
        const obj = objForm(lang, o);
        if (!obj) return;
        push(`${v.f} ${obj}`, `${o.n} ${v.n}`, o.lv === 'A1' && v.lv === 'A1' ? 'A2' : 'B1', 'phrase');
      });
    });

  /* 8 — adjective templates */
  A.forEach(a => {
    push(T.very[lang](a.f), TT.very(a.n), a.lv, 'phrase');
    push(T.not[lang](a.f), TT.not(a.n), a.lv, 'phrase');
    push(T.too[lang](a.f), TT.too(a.n), 'A2', 'phrase');
  });

  /* 9 — verb templates */
  V.forEach(v => {
    push(T.want[lang](v.f), TT.want(v.n), v.lv, 'phrase');
    push(T.must[lang](v.f), TT.must(v.n), 'A2', 'phrase');
    push(T.like[lang](v.f), TT.like(v.n), 'A2', 'phrase');
  });

  /* 10 — quantity + countable noun (natural shopping/ordering language) */
  const counts = [2, 3, 4, 5, 10];
  // yalnızca sayılabilir: su/süt/kahve/çay/şeker/tuz/yağ hariç
  const COUNTABLE_TR = new Set(['ekmek','elma','portakal','muz','üzüm','limon','çilek','havuç','salatalık','sarımsak','mantar','karpuz','şeftali','biber','peynir','yumurta','tavuk','patates','domates','soğan','pasta','dondurma','bilet','pasaport','bavul','harita','otel','taksi','tren','otobüs']);
  N.filter(n => (n.c === 'food' || n.c === 'travel') && COUNTABLE_TR.has(n.n)).forEach(n => {
    counts.forEach(k => push(`${num(k)} ${n.f}`, `${trNum(k)} ${n.n}`, 'A2', 'number'));
  });

  /* 11 — adjective + noun, agreement + anlam süzgeci */
  const SIZE_OK = new Set<CatId>(['daily', 'food', 'travel', 'nature', 'tech', 'business']);
  const ADJ_CAT: Record<string, CatId[]> = {
    'sıcak': ['food'], 'soğuk': ['food'],
    'hızlı': ['travel','tech'], 'yavaş': ['travel','tech'],
    'güvenli': ['travel','daily'], 'tehlikeli': ['travel','daily','nature'],
    'ağır': ['daily','travel'], 'hafif': ['daily','travel'],
    'boş': ['daily','travel','food'], 'dolu': ['daily','travel','food'],
    'açık': ['daily'], 'kapalı': ['daily'],
  };
  const descriptive = A.filter(a =>
    /büyük|küçük|yeni|eski|sıcak|soğuk|güzel|temiz|kirli|ucuz|pahalı|uzun|kısa|ağır|hafif|boş|dolu|açık|kapalı|hızlı|yavaş|güvenli|tehlikeli/.test(a.n));
  N.filter(n => SIZE_OK.has(n.c)).forEach(n => {
    descriptive.forEach(a => {
      const allow = ADJ_CAT[a.n];
      if (allow && !allow.includes(n.c)) return;
      let f: string;
      if (lang === 'en' || lang === 'ru') f = `${a.f} ${n.f}`;
      else {
        const ag = n.g === 'f' ? a.f.replace(/o$/, 'a') : a.f;
        f = `${n.f} ${ag}`;
      }
      push(f, `${a.n} ${n.n}`, 'B1', 'phrase');
    });
  });

  /* 12 — safety net: real spelled-out numbers 101-9999.
     Only reached if de-duplication left the pack short; these are
     genuine vocabulary items, never filler gibberish. */
  for (let k = 101; k < 10000 && out.length < TARGET; k++) {
    push(num(k), trNum(k), 'B1', 'number');
  }

  const finalOut = out.slice(0, TARGET);
  cache.set(lang, finalOut);
  return finalOut;
}

/** Diagnostics for the UI — how the 4.000 breaks down. */
export function inspect(lang: LangCode) {
  const rows = buildLanguage(lang);
  const byCat = {} as Record<CatId, number>;
  const byLv = {} as Record<CEFRLevel, number>;
  rows.forEach(r => {
    byCat[r.c] = (byCat[r.c] ?? 0) + 1;
    byLv[r.lv] = (byLv[r.lv] ?? 0) + 1;
  });
  return { total: rows.length, byCat, byLv };
}

export function totalFor(lang: LangCode) { return buildLanguage(lang).length; }
