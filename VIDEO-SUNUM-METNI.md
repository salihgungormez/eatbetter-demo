# EatBetter — Confidence-Aware Meal Logging

## Videonun ana fikri

Bu projeyi EatBetter'ın tamamını yeniden yaptığım bir klon olarak değil, fotoğraftan öğün kaydında doğruluk ve kullanıcı düzeltme deneyimini iyileştiren bir MVP olarak anlatıyorum.

Temel problem şu: Bir görsel model yemeği tanıyabilir ama fotoğraftan her şeyi kesin olarak bilemez. Özellikle porsiyon, sos, pişirme yağı veya birbirine benzeyen ürünlerde hata oluşabilir. Bu yüzden ürünün amacı sadece bir kalori sayısı göstermek değil; modelin ne gördüğünü, ne kadar emin olduğunu ve kullanıcının sonucu nasıl düzeltebildiğini görünür hale getirmek.

## Açılış konuşması

> Bu case'te odaklandığım şey EatBetter'ın bütün ürününü yeniden yapmak değildi. Meal logging akışında modelin eksik veya belirsiz tahminlerini kullanıcıyla birlikte daha güvenilir hale getirmeye çalıştım.
>
> Fotoğraftan yemek tanımak tek başına yeterli değil. Model örneğin tavuğu doğru tanıyabilir ama porsiyonu yanlış tahmin edebilir; beyaz bir bölgeyi lor peyniri sanabilir ama aslında yoğurt olabilir. Bu nedenle tasarım kararım, yapay zekânın belirsizliğini saklamak yerine kullanıcıya kontrollü bir düzeltme akışı sunmak oldu.

## Teknoloji ve proje kökü

Proje kökü:

`/Users/salihgungormez/Documents/Codex/2026-08-14/referenced-chatgpt-conversation-this-is-an-2`

Kullanılan temel yapı:

- Expo + React Native + TypeScript: mobil MVP'yi hızlı ve tip güvenli geliştirmek için.
- Expo Router: ekranlar arası navigation için.
- Zustand: öğün taslağını ve uygulama state'ini ekranlar arasında taşımak için.
- AsyncStorage: auth ve backend olmadan öğün geçmişini cihazda saklamak için.
- Gemini Vision endpoint: fotoğraftaki görünür yemek bölgelerini analiz etmek için.
- Küçük nutrition dataset'i: modelin besin değerlerini serbestçe uydurmasını engellemek ve temel aritmetiği uygulamanın kontrolünde tutmak için.

## Dosya haritası

### Ekranlar — `app/`

#### `app/index.tsx`

Today ekranı. Cihazda kayıtlı bugünkü öğünleri gösterir, toplam kalori ve makroları hesaplar, yeni öğün ekleme akışını başlatır.

Buradaki önemli karar, ana ekranın sadece kayıtlı veriyi göstermesi. Kalori ve makro toplamları kaydedilmiş `MealItem` değerlerinden hesaplanır.

#### `app/add.tsx`

Öğün ekleme başlangıcı. Kullanıcı öğün türünü seçebilir, fotoğraf galeriden seçebilir, açıklama yazabilir veya kamerayla öğün tarayabilir.

Burada saat ve geçmiş öğünlere dayalı zayıf bir başlangıç önerisi gösterilir. Ancak bu öneri kesin karar değildir; kullanıcı geç uyanmışsa ilk öğününün öğle veya akşam saatine denk gelmesi mümkün olduğu için kullanıcı seçimi korunur.

#### `app/scan.tsx`

Kamera akışı. `expo-camera` ile kesintisiz preview gösterilir ve kullanıcı capture düğmesine bastığında yalnızca bir fotoğraf alınır.

Bu gerçek zamanlı object detection olarak sunulmuyor. MVP'de doğru yaklaşım “AI camera scan”: tabağı kadraja alma yönlendirmesi, tek çekim, ardından analiz.

Capture lock'ları sayesinde:

- timer ile tekrar tekrar fotoğraf çekilmez,
- hızlı art arda tıklamalarda ikinci capture başlamaz,
- analiz sürerken capture düğmesi kapanır,
- ekran kapanırsa işlem akışı devam ettirilmez.

#### `app/analyze.tsx`

Visual Meal Review ekranı. AI sonucunu kullanıcıya gösterir.

Bu ekranda:

- fotoğraf üstünde bölge noktaları ve callout'lar,
- düşük güvenli bölgelerde turuncu uyarı,
- belirsiz bölgede alternatif adaylar,
- her bölge için gramaj düzenleme,
- bölgeyi silme veya yeni ürün seçme,
- görselin altında aynı `foodRegions` state'inden üretilen düzenlenebilir özet liste,
- toplam kalori ve makroların yeniden hesaplanması,
- seçimi onaylayan bir drawer bulunur.

Bir bölgeye dokunmak önce o bölgeyi highlight eder. Callout'a veya ürün adına dokununca edit drawer açılır. Drawer aşağı sürüklenerek veya kapatma butonuyla kapanabilir.

#### `app/_layout.tsx`

Expo Router'ın kök layout'u. Navigation stack ve uygulamanın ortak ekran yapılandırmasını tutar.

### UI bileşenleri — `components/`

- `ui.tsx`: renkler, ortak stiller, `PrimaryButton`, `SectionLabel` gibi tekrar kullanılan UI parçaları.
- `FoodItemRow.tsx`: görsel altındaki malzeme özetinde isim ve gramaj düzenleme, +/- ve silme işlemleri.
- `MacroSummary.tsx`: Today ekranındaki kalori, protein, karbonhidrat ve yağ özetini gösterir.
- `MealCard.tsx`: bugünün kayıtlı öğünlerini kart olarak gösterir ve öğün adlarını Türkçeleştirir.

### Tipler — `types/`

- `types/meal.ts`: `Meal`, `MealItem`, `FoodRegion`, `FoodCandidate`, `NutritionValues` gibi domain modelleri.
- `types/visual-meal-analysis.ts`: AI cevabının Zod şeması ve coverage verification modelleri.

En önemli model `FoodRegion`:

```ts
type FoodRegion = {
  id: string;
  boundingBox: NormalizedBoundingBox;
  anchor: NormalizedPoint;
  status: 'recognized' | 'ambiguous' | 'unknown';
  selectedCandidateId?: string;
  candidates: FoodCandidate[];
};
```

Buradaki fikir şu: Aynı görsel bölge için yoğurt ve lor peyniri iki ayrı malzeme değildir. Bunlar aynı bölgenin iki aday tahminidir. Böylece beslenme toplamında yalnızca seçilen aday sayılır ve aynı yemek iki kez hesaplanmaz.

### AI ve pipeline — `services/ai.ts`

Ana AI orchestration burada.

#### Pass 1 — Visible food inventory

Modelden önce tüm tabağı incelemesi istenir. Her görünür ve anlamlı yemek bölgesi ayrı bir `FoodRegion` olarak döner:

- protein,
- karbonhidrat veya tahıl,
- sebze,
- yan yemek,
- görünür sos,
- anlamlı garnitür,
- tanımlanamayan yiyecek.

Model aynı görsel bölge için yarışan tahminleri `candidates` içinde döndürür. Görünür bir yiyecek, belirsiz olduğu için aşağıdaki hidden suggestions listesine kaçırılmaz.

Prompt ayrıca monitör, masa, kablo ve arka planı yok saymasını söyler. Çünkü fotoğrafı test amacıyla bilgisayar ekranından çekmek mümkün; modelin monitörü yiyecek sanmaması gerekir.

#### Pass 2 — Coverage verifier

İkinci istek, ilk envanteri tekrar kontrol eder. Şunları sorar:

- Büyük ve anlamlı bir yiyecek bölgesi eksik mi?
- Ana protein veya karbonhidrat atlanmış mı?
- Açıklamada geçen ama `foodRegions` içinde bulunmayan bir yiyecek var mı?
- İki farklı bölge aslında aynı yere mi işaret ediyor?
- Arka plan nesnesi yanlışlıkla yiyecek olarak mı etiketlenmiş?

Eksik bölgeler varsa sonuç doğrudan besin hesabına sokulmaz. İki denemeye kadar düzeltme prompt'u gönderilir; sonrasında eksik bölgeler merge edilir ve kapsam sonucu işaretlenir.

#### Pass 3 — Nutrition enrichment

Kapsam doğrulandıktan sonra modelden yalnızca mevcut `regionId` ve `candidateId` değerleri için gramaj ve besin değerleri istenir.

Bu aşama yeni bölge keşfetmez, bölge silmez veya iki bölgeyi birleştirmez. Böylece detection ile nutrition estimation birbirinden ayrılır.

#### Controlled nutrition

`services/nutrition.ts`, bilinen yiyecek adlarını küçük ve kontrollü bir besin dataset'iyle eşleştirir. Son aritmetiği uygulama yapar.

Bu, modelin örneğin 100 gram pirinci her analizde farklı ve kontrolsüz biçimde hesaplamasını azaltır. Yine de sonuç bir tahmindir; tıbbi veya kesin bir ölçüm olarak sunulmaz.

### Mock ve gerçek AI — `services/mock-ai.ts`, `services/ai.ts`

API anahtarı yoksa uygulama mock analizle demo akışını çalıştırabilir. Bu, UI ve düzeltme akışını internetsiz test etmek için kullanılır.

Gerçek AI yolu `services/ai.ts` içindeki Gemini isteğidir. Videoda mock sonucu gerçek model sonucu gibi anlatmamak gerekir. Demo sırasında gerçek Gemini kullanılıyorsa bunu belirtmek; mock kullanılıyorsa açıkça “mock fallback” demek doğru olur.

### Region ve nutrition mantığı — `utils/`

- `utils/food-regions.ts`: bölgeyi seçili adaydan meal item'a dönüştürür ve yalnızca seçili adayı toplama dahil eder.
- `utils/coverage.ts`: duplicate bölgeleri, eksik bölgeleri ve coverage retry kararını yönetir.
- `utils/visual-review.ts`: normalized koordinatları ekrandaki fotoğraf koordinatlarına ve callout yerleşimine çevirir.
- `utils/localization.ts`: modelden İngilizce gelse bile kullanıcıya gösterilecek malzeme ve öğün adlarını Türkçeleştirir.
- `utils/accuracy.ts`: testlerde besin ve doğruluk hesaplarını tekrar üretmek için kullanılır.

### Kullanıcı geçmişi — `store/` ve `services/`

#### `store/meal-store.ts`

Zustand store. Öğünleri ve correction kayıtlarını AsyncStorage ile kalıcı hale getirir. Kullanıcı uygulamayı kapatıp açsa bile bugünkü öğünler ve düzeltme hafızası korunur.

#### `services/meal-context.ts`

Analizden önce bugünkü ve son 14 gündeki öğünleri özetler. Saat, bugünkü öğün sayısı ve tekrar eden kişisel örüntülerden bir context üretir.

Bu context yalnızca zayıf bir prior'dır. Örneğin saat 18:00 ise akşam öğünü önerilebilir; fakat kullanıcı geç uyanmışsa ilk öğünü olabilir. Görsel kanıt ve kullanıcı seçimi her zaman daha güçlüdür.

#### `services/personal-profile.ts`

Yeterli tekrar oluştuğunda, örneğin kahvaltıların çoğunda yumurta veya ekmek bulunması gibi kişisel örüntüler çıkarır. Bu bilgi modelin görünür yiyecek keşfinin yerine geçmez; yalnızca olası isim veya porsiyon için yardımcı context olur.

#### `services/correction-memory.ts`

Kullanıcı bir belirsiz bölgeyi düzeltip öğünü kaydettiğinde correction record oluşturur. Geçici editor hareketleri kaydedilmez.

Yeni analizde yalnızca belirsiz, düşük güvenli veya adayları birbirine yakın bölgelerde correction memory uygulanır. History, görsel kanıtın önüne geçemez; boost sınırlıdır. Kullanıcı yine başka adayı seçebilir.

#### `services/correction-repository.ts`

Correction kayıtlarını cihazda kalıcı saklayan repository katmanı. Bu abstraction ileride backend'e taşınsa bile ekran kodunun değişmesini azaltır.

## Pipeline'ı tek cümlede anlatma

> Fotoğrafı alıyorum, önce tabağın içindeki bütün görünür yiyecek bölgelerini çıkarıyorum, sonra ikinci bir coverage doğrulamasıyla eksik veya tekrarlı bölgeleri kontrol ediyorum. Kapsam doğrulanmadan besin hesabına geçmiyorum. Ardından gramaj ve besin değerlerini kontrollü dataset ile hesaplıyor, yalnızca belirsiz alanları kullanıcıya düzenletiyor ve sonucu cihazda saklıyorum.

## Videoda ekran akışı

### 1. Today

> Burası kullanıcının bugünkü öğünlerini ve toplam makrolarını gördüğü ekran. Buradaki değerler doğrudan cihazda kayıtlı öğünlerden geliyor; henüz eklenmemiş veya unresolved bir analiz bu toplamı etkilemiyor.

### 2. Add Meal

> Kullanıcı öğün tipini seçiyor. Saat ve geçmiş kayıtlar başlangıç önerisi veriyor ama kullanıcıyı zorlamıyor. Geç uyanmış bir kullanıcının ilk öğünü öğle saatinde olabilir; bu yüzden saat sadece yardımcı context.

### 3. Camera scan

> Kamera ekranında gerçek zamanlı nesne tespiti iddiasında bulunmuyorum. Tabağı kadraja almasını söylüyor, kullanıcıdan tek bir fotoğraf alıyor ve bu fotoğrafı AI analizine gönderiyorum. Capture lock sayesinde beklerken veya hızlı tıklarken sürekli fotoğraf çekilmiyor.

### 4. Visual review

> Modelin bulduğu her görünür bölgenin fotoğraf üzerinde bir noktası var. Noktaya dokununca bölge highlight oluyor; ürün adına dokununca düzenleme drawer'ı açılıyor. Düşük güvenli alanlar turuncu gösteriliyor.

### 5. Ambiguous correction

> Örneğin aynı beyaz bölge için Yoğurt ve Lor peyniri iki aday olabilir. Bunları iki ayrı malzeme gibi göstermiyorum. Aynı region içinde aday olarak tutuyorum. Kullanıcı Yoğurt'u seçerse aynı region korunuyor, yalnızca selectedCandidateId değişiyor.

### 6. Recalculation and save

> Gramaj veya aday değiştiğinde toplam kalori ve makrolar anında yeniden hesaplanıyor. Kullanıcı onaylayıp kaydettiğinde öğün AsyncStorage'a yazılıyor. Aynı anda yapılan anlamlı düzeltme Correction Memory'ye ekleniyor; geçici seçimler kaydedilmiyor.

## Kodda gösterebileceğin üç yer

### 1. `services/ai.ts`

Pass 1, Pass 2 ve Pass 3'ü göster. Şunu söyle:

> Burada modeli tek bir serbest metin cevabına bırakmak yerine strict JSON schema kullanıyorum. Bu sayede her bölgenin koordinatı, durumu, adayları ve confidence değeri uygulamanın okuyabileceği sabit bir yapıda geliyor.

### 2. `utils/food-regions.ts`

`selectedCandidate` ve `regionTotals` fonksiyonlarını göster. Şunu söyle:

> Nutrition hesabı candidate listesindeki bütün adayları toplamıyor. Sadece kullanıcının seçtiği aday hesaplanıyor. Bu, aynı görsel bölgenin iki kez sayılmasını engelliyor.

### 3. `services/correction-memory.ts`

Conservative reranking ve boost cap'i göster. Şunu söyle:

> Kullanıcı geçmişini görsel kanıtın yerine koymuyorum. Sadece belirsiz bölgelerde küçük bir boost veriyorum ve bu boost'un üst sınırı var. Böylece kişiselleştirme yardımcı oluyor ama modeli kör biçimde override etmiyor.

## Evaluation ve testler

Test dosyaları `scripts/` klasöründe:

- `accuracy.test.ts`: callout ve görsel doğruluk yardımcıları.
- `camera-regression.test.ts`: tek capture, hızlı tekrar tıklama ve ekran yaşam döngüsü guard'ları.
- `coverage-pipeline.test.ts`: eksik tavuk/patates/pirinç gibi görünür bölgelerin coverage ile yakalanması.
- `food-regions.test.ts`: tek region içinde alternatif aday ve yalnızca seçili adayın toplamı.
- `nutrition-pipeline.test.ts`: controlled nutrition ve toplam hesabı.
- `correction-memory.test.ts`: düzeltme kaydı, memory boost, güçlü görsel kanıtın korunması.
- `meal-context.test.ts`: saat, geç uyanma ve tekrar eden kişisel öğün örüntüleri.
- `uncertainty.test.ts`: yalnızca anlamlı belirsizliklerde soru üretimi.
- `localization.test.ts`: İngilizce model adlarının Türkçeleştirilmesi.

Videoda şöyle ifade edebilirsin:

> Buradaki hedefim production seviyesinde beslenme doğruluğu iddia etmek değil. Hangi aşamada hata olduğunu ölçülebilir hale getirmek: ingredient recall, coverage completeness, portion error, calorie error ve correction count. Böylece baseline prompt ile geliştirilmiş pipeline'ı aynı fotoğraf setinde karşılaştırabilirim.

## Kapanış konuşması

> Bu projenin ana katkısı yalnızca fotoğraftan kalori tahmini yapmak değil. Modelin eksik veya belirsiz olduğu noktaları görünür hale getirip kullanıcı düzeltmesini akışın doğal bir parçası yapmak.
>
> Bu nedenle sistemi üç ana prensiple kurdum: görünür yiyecekleri sessizce atlamamak, aynı bölgenin alternatiflerini ayrı malzeme gibi saymamak ve güçlü görsel kanıt yoksa kesinlik iddiasında bulunmamak.
>
> Bir sonraki adım, daha geniş ve elle doğrulanmış bir fotoğraf setiyle baseline ve geliştirilmiş pipeline'ı karşılaştırmak olurdu. Böylece yalnızca daha iyi görünen bir arayüz değil, hangi değişikliğin meal logging doğruluğunu gerçekten artırdığını da gösterebilirim.

## Kısa teknik özet

```text
Fotoğraf / kamera
        ↓
Add Meal + öğün context'i
        ↓
Pass 1: görünür yiyecek bölgeleri
        ↓
Pass 2: coverage ve tutarlılık doğrulaması
        ↓
Eksik / bilinmeyen / duplicate bölgeleri düzeltme
        ↓
Pass 3: gramaj ve nutrition enrichment
        ↓
Controlled nutrition hesaplama
        ↓
Visual Meal Review + kullanıcı düzeltmesi
        ↓
Seçili adayla yeniden hesaplama
        ↓
AsyncStorage'a öğün kaydı
        ↓
Correction Memory ve kişisel pattern güncellemesi
```
