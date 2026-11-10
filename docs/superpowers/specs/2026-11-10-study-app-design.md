# Ders Çalışma Uygulaması (Study App) — Tasarım ve Uygulama Planı

## Bağlam

Üniversite vize/finallerine çalışmak için kişisel bir uygulama isteniyor. Klasör (`C:\Users\Selettin\Desktop\Study_App`) boş; sıfırdan proje. Kullanıcıyla netleşen kararlar:

- **Platform:** Tek kod tabanlı web uygulaması (PWA). Bilgisayarda tarayıcıdan, Android telefonda ana ekrana eklenerek, çevrimdışı çalışır.
- **Yayınlama:** GitHub Pages (kod açık, ders verisi yalnızca cihazda).
- **Veri:** Hesap/sunucu yok. Her şey cihazda (IndexedDB). Cihazlar arası taşıma tek dosyalık dışa/içe aktarma ile.
- **İçerik üretimi:** Kartlar ve testler dışarıda (Claude'a) hazırlatılan JSON dosyalarından içe aktarılır; uygulama içinde yapay zekâ yok.
- **Soru tipleri:** çoktan seçmeli, doğru/yanlış, boşluk doldurma, klasik (açık uçlu), **kod yazma** (Python, sürüm seçimli).
- **İçerik biçimi:** Markdown + LaTeX formül + kod bloğu + görsel.
- **Arayüz dili:** Türkçe.

## Teknoloji

| Konu | Seçim | Neden |
|---|---|---|
| Çatı | Vite + React + TypeScript | Hızlı, PWA eklentisi olgun |
| Stil | Tailwind CSS, açık/koyu tema | Mobil öncelikli, tek tasarım sistemi |
| Yönlendirme | React Router (HashRouter), Vite `base: './'` | GitHub Pages alt yolunda sorunsuz |
| Veritabanı | Dexie (IndexedDB) | PDF blob'ları dahil büyük veri, çevrimdışı |
| PWA | vite-plugin-pwa (Workbox) | Çevrimdışı kabuk + Pyodide önbelleği |
| PDF | pdfjs-dist | Android Chrome gömülü PDF göstermez |
| İçerik | react-markdown + remark-math + rehype-katex + rehype-highlight | Formül, kod, görsel |
| Kod editörü | CodeMirror 6 | Telefonda da kullanılabilir |
| Python | Pyodide, Web Worker içinde | Tarayıcıda, çevrimdışı, sürüm seçimli |
| Aralıklı tekrar | ts-fsrs | Kanıtlanmış zamanlama algoritması |
| Yedek dosyası | @zip.js/zip.js (akış halinde) | Telefonda büyük PDF'lerde bellek taşmaz |
| Doğrulama | Zod | JSON içe aktarmada anlaşılır hata mesajı |
| Test | Vitest + fake-indexeddb | Saf mantık için TDD |

Ortam: Node 24, npm 12, git mevcut. `gh` CLI yok → GitHub deposu oluşturma/push adımını kullanıcı yapar.

## Özellikler

### 1. Dersler
- Ders ekle/düzenle/arşivle: ad, kod, dönem, renk, simge.
- Her dersin sekmeleri: Genel bakış · Materyaller · Testler · Kartlar · Kod · Konular · İstatistik.
- **Konular:** Ders içi konu/ünite listesi. Soru ve kartlar konuya bağlanır; her konunun durumu (başlanmadı / çalışılıyor / tamam) işaretlenir → sınav öncesi konu takip listesi.

### 2. Materyaller (PDF)
- Tür: **Ders sunumu**, **Çalışma PDF'i**, **Çıkmış sınav (PDF)**, Diğer. Çoklu yükleme, sürükle-bırak.
- Görüntüleyici: sayfa gezinme, yakınlaştırma, tam ekran, metin arama, koyu modda ters çevirme, **kaldığın sayfayı hatırlama**, sayfa yer imi + sayfa notu.
- Masaüstünde bölünmüş görünüm: solda PDF, sağda not veya cevap formu.
- **Optik form:** Yalnızca PDF olarak duran çıkmış sınavlar için. Soru sayısı ve cevap anahtarı girilir; PDF'e bakarak şıklar işaretlenir, doğru/yanlış/boş sayılır ve istatistiğe girer.

### 3. Testler (çıkmış sorular + çalışma soruları)
- Test seti türü: `cikmis` (yıl, dönem, vize/final/büt bilgisiyle) veya `calisma`.
- **Modlar:**
  - *Çalışma modu:* Her sorudan sonra anında doğru/yanlış + açıklama.
  - *Sınav modu:* Süre sayacı, cevaplar sonda.
  - *Yanlışlarım:* Yalnızca daha önce yanlış yapılanlar.
  - *Karışık test:* Ders / konu / soru tipi / tür / yıldızlı / hiç görülmemiş filtreleriyle N soruluk test; soru ve şık karıştırma.
- **Puanlama:**
  - Çoktan seçmeli, D/Y: otomatik.
  - Boşluk doldurma: otomatik; büyük-küçük harf ve boşluk duyarsız (Türkçe yerel ayar), birden çok kabul edilen cevap, sayısal cevapta tolerans.
  - Klasik: örnek çözüm gösterilir, kullanıcı doğru / kısmen / yanlış işaretler.
  - Kod: bkz. bölüm 5.
- **Sonuç ekranı:** doğru / yanlış / boş / kısmen sayıları, yüzde, süre, konu bazında döküm, cevapları inceleme. İsteğe bağlı "net" hesabı (N yanlış 1 doğruyu götürür; varsayılan kapalı).
- **Soru bazında geçmiş:** kaç kez görüldü, kaç doğru/yanlış, son sonuç; yıldızlama; soruya kişisel not.
- Yarıda kalan test kaydedilir, kaldığı yerden devam edilir.
- Uygulama içi soru ekleme/düzenleme (canlı önizlemeli Markdown editörü).

### 4. Çalışma kartları (arkalı önlü)
- Deste → kartlar. Ön/arka Markdown (formül, kod, görsel), isteğe bağlı ipucu.
- Çevirme animasyonu; telefonda kaydırma, masaüstünde klavye kısayolları (Boşluk: çevir, 1–4: puanla).
- **Aralıklı tekrar (FSRS):** Tekrar / Zor / İyi / Kolay → bir sonraki gösterim tarihi. "Bugün tekrar edilecekler" kuyruğu.
- **Sınav öncesi mod:** Zamanlamayı yok sayıp desteyi baştan sona, karışık veya yalnızca "bilmediklerim" ile geçme; bildim/bilemedim sayacı.
- Kartı ters çalışma (arka → ön), yıldızlama, uygulama içi kart düzenleme.

### 5. Kod yazma (Python, sürüm seçimli)
- CodeMirror editör, stdin kutusu, Çalıştır/Durdur, çıktı ve hata paneli.
- **Sürüm seçici.** Her sürüm ayrı bir Pyodide derlemesi; ilk kullanımda bir kez indirilir (~10 MB), sonra çevrimdışı çalışır. Ayarlar'da indirilen sürümler listelenir (indir/sil).

  | Python | Pyodide derlemesi (uygulamada doğrulanacak) |
  |---|---|
  | 3.9 | 0.19.1 |
  | 3.10 | 0.22.1 |
  | 3.11 | 0.25.1 |
  | 3.12 | 0.27.x |
  | 3.13 | 0.29.x |

  Uygulama sırasında her derleme yüklenip `sys.version` yazdırılarak eşleme doğrulanır; tablo buna göre sabitlenir. 3.8 ve altı kapsam dışı.
- Çalıştırma Web Worker'da; sonsuz döngüde süre aşımıyla worker sonlandırılır. `input()` stdin kutusundan beslenir.
- **Kod sorusu puanlama (ikisi de):** JSON'da test girdisi/beklenen çıktı varsa otomatik (geçen/kalan test sayısı); yoksa örnek çözüm gösterilir, kullanıcı kendini işaretler. Soru kendi Python sürümünü belirtebilir, kullanıcı değiştirebilir.
- **Serbest kod alanı:** Derse bağlı, kaydedilebilir kod parçaları.

### 6. JSON içe aktarma (içerik)
- Dosya seç / sürükle-bırak / metin yapıştır. Tek dosyada hem desteler hem testler olabilir.
- **Önizleme:** kaç deste, kart, test, soru geleceği; hatalı öğeler satır satır Türkçe mesajla ("3. soru: `answer` şıklarda yok"). Hatalılar atlanıp geri kalan alınabilir.
- Hedef ders seçimi (JSON'daki ders adı eşleşirse otomatik, yoksa yeni ders önerilir). Aynı içerik tekrar aktarılırsa atla/güncelle seçimi.
- Görseller: Markdown içinde data URL (içeri alınır, cihazda saklanır) veya https bağlantısı.
- **"Yapay zekâ için şablon" sayfası:** Kopyalanabilir hazır istem + şema + örnek. Kullanıcı bunu PDF'iyle birlikte Claude'a verir, çıkan JSON'u doğrudan içe aktarır. Aynı içerik depoda `docs/json-format.md` ve `examples/` altında da durur.

Biçim (özet):

```json
{
  "format": "studyapp-content",
  "version": 1,
  "course": "Veri Yapıları",
  "decks": [
    { "title": "Ağaçlar", "cards": [
      { "front": "AVL ağacında denge faktörü?", "back": "$h_{sol} - h_{sağ} \\in \\{-1,0,1\\}$", "hint": "yükseklik", "topic": "Ağaçlar" }
    ] }
  ],
  "questionSets": [
    { "title": "2024 Güz Vize", "kind": "cikmis", "year": 2024, "term": "Güz", "examType": "vize",
      "questions": [
        { "type": "mcq", "prompt": "…", "options": ["…","…","…","…"], "answer": 2, "explanation": "…", "topic": "Yığın", "difficulty": 2 },
        { "type": "tf", "prompt": "…", "answer": true, "explanation": "…" },
        { "type": "fill", "prompt": "Kuyruk ___ ilkesiyle çalışır.", "answers": ["FIFO", "ilk giren ilk çıkar"] },
        { "type": "open", "prompt": "…", "solution": "…" },
        { "type": "code", "prompt": "…", "language": "python", "pythonVersion": "3.9",
          "starter": "def f(n):\n    pass", "solution": "…",
          "tests": [ { "stdin": "5\n", "expected": "120\n" } ] }
      ] }
  ]
}
```

### 7. Tam yedek: dışa/içe aktarma (telefon ↔ bilgisayar)
- **Tek dosya:** `ders-yedek-YYYY-AA-GG.studyapp` (zip): `manifest.json` (şema sürümü, tarih, sayımlar) + `data.json` (tüm tablolar) + `blobs/` (PDF ve görseller, sıkıştırmasız).
- Kapsam: dersler, konular, PDF'ler, yer imleri/notlar, testler, sorular, tüm deneme geçmişi, kartlar ve tekrar zamanlamaları, kod parçaları, sınav takvimi, çalışma süreleri, ayarlar. **Hiçbir şey dışarıda kalmaz.**
- Seçenekler: tam yedek · PDF'siz hafif yedek · tek ders (arkadaşla paylaşmak için; istenirse kişisel ilerleme hariç).
- Kaydetme: masaüstünde indirme; Android'de paylaşım menüsü (Drive, WhatsApp, e-posta) veya indirme.
- **İçe aktarma modları:** *Değiştir* (cihazdaki her şeyi siler, onay ister) veya *Birleştir* (kayıtlar kalıcı kimlik + güncelleme zamanı taşır; yeni olan kazanır, deneme geçmişleri birleşir).
- İçe aktarmadan önce özet ekranı (dosyada ne var, cihazda ne var). Şema sürümü farklıysa otomatik geçiş.
- Koruma: kalıcı depolama izni istenir (`navigator.storage.persist`), Ayarlar'da kullanılan alan gösterilir, son yedekten bu yana 7 gün geçtiyse hatırlatma.

### 8. Ek işe yarar özellikler
- **Ana sayfa:** yaklaşan sınavlara geri sayım, bugün tekrar edilecek kart sayısı, günlük hedef ve seri (streak), kaldığın yerden devam (son PDF sayfası, yarım test), zayıf konular.
- **Sınav takvimi:** ders, tür (vize/final/büt/quiz), tarih-saat, kapsanan konular, not.
- **İstatistik:** derse göre doğruluk oranının zamanla değişimi, konuya ve soru tipine göre başarı, kart hatırlama oranı, çalışma süresi, günlük etkinlik ısı haritası.
- **Pomodoro sayacı:** derse bağlanır, çalışma süresi istatistiğine yazılır.
- **Genel arama:** ders, soru, kart ve dosya başlıklarında.
- Koyu/açık tema; telefonda alt sekme çubuğu, masaüstünde yan menü.

**Kapsam dışı (bilinçli):** hesap/bulut eşitleme, uygulama içi yapay zekâ, PDF üzerine çizim/vurgulama, Python dışı diller, not ortalaması hesaplayıcı. İstenirse sonradan eklenir.

## Mimari

```
Study_App/
  index.html · vite.config.ts · package.json
  public/            simgeler, py-worker.js (klasik worker; her Pyodide sürümünü importScripts ile yükler)
  src/
    db/              schema.ts (tablolar + tipler), db.ts (Dexie), migrations.ts
    lib/             grading.ts · scheduler.ts (ts-fsrs sarmalayıcı) · content-schema.ts (Zod)
                     content-import.ts · backup-export.ts · backup-import.ts · python-runner.ts · ids.ts
    ui/              ortak bileşenler (Markdown, Düğme, Sayfa düzeni, Grafikler)
    features/
      dashboard/ courses/ materials/ quizzes/ flashcards/ code/
      content-import/ backup/ stats/ planner/ search/ settings/
  docs/json-format.md · examples/*.json
  .github/workflows/deploy.yml
```

**Tablolar:** `courses`, `topics`, `files`, `blobs`, `bookmarks`, `questionSets`, `questions`, `attempts`, `answers`, `decks`, `cards` (FSRS durumu dahil), `reviews`, `snippets`, `exams`, `studySessions`, `settings`. Her kayıtta `id` (UUID) ve `updatedAt` → birleştirerek içe aktarma bunun üzerine kurulu. Blob'lar ayrı tabloda → listeler hızlı kalır.

**Sınırlar:** `lib/` altındaki her modül arayüzden bağımsız saf mantıktır ve tek başına test edilir; `features/` yalnızca `db` ve `lib` üzerinden konuşur.

## Uygulama aşamaları

Her aşama sonunda çalışan bir uygulama kalır; aşama sonlarında kısa bir gösterim/kontrol yapılır.

0. **İskelet:** `git init`, tasarım belgesini `docs/superpowers/specs/2026-11-10-study-app-design.md` olarak kaydet, Vite + React + TS + Tailwind, PWA kabuğu, Dexie şeması, gezinme düzeni (mobil alt çubuk / masaüstü yan menü), tema. Görsel yön için `frontend-design` becerisi kullanılır.
1. **Dersler + Materyaller + Tam yedek:** ders CRUD, PDF yükleme ve görüntüleyici, tam dışa/içe aktarma (Değiştir + Birleştir). Yedekleme erken gelir ki sonraki her tablo baştan kapsansın.
2. **JSON içe aktarma + Kartlar:** Zod şeması, önizleme/hata ekranı, şablon sayfası, deste ve kart ekranları, FSRS, sınav öncesi mod.
3. **Testler:** dört soru tipi, modlar, sonuç ekranı, soru geçmişi, yanlışlarım, karışık test, optik form.
4. **Kod:** Pyodide worker, sürüm yöneticisi, kod sorusu puanlama, serbest kod alanı.
5. **Ana sayfa, takvim, istatistik, pomodoro, konu takibi, arama.**
6. **Yayın:** GitHub Actions ile Pages dağıtımı, çevrimdışı kontrol, telefonda kurulum.

`lib/` modülleri test önce yazılarak (TDD) geliştirilir.

## Doğrulama

- **Birim testleri (`npm test`):** puanlama (Türkçe büyük-küçük harf, çoklu cevap, tolerans), JSON şema doğrulama ve hata mesajları, FSRS sarmalayıcı, yedek **gidiş-dönüş** testi (dışa aktar → boş veritabanına içe aktar → tüm tablolar ve blob baytları birebir aynı), birleştirme kuralları.
- **Uçtan uca (yerleşik tarayıcıda, masaüstü ve 375×812 mobil görünüm):**
  1. Ders oluştur, PDF yükle, 5. sayfaya git, kapat-aç → 5. sayfada açılıyor.
  2. `examples/` altındaki örnek JSON'u içe aktar → kart ve soru sayıları önizlemeyle aynı; kasıtlı bozuk JSON anlaşılır hata veriyor.
  3. Bir testi çöz → doğru/yanlış/boş sayıları ve soru geçmişi doğru; "Yanlışlarım" yalnızca yanlışları getiriyor.
  4. Kartları puanla → "bugün tekrar" sayısı düşüyor, sonraki tarih ileri gidiyor.
  5. Python 3.9 ve 3.12'de `sys.version` yazdır → seçilen sürüm görünüyor; 3.10+ `match` ifadesi 3.9'da sözdizimi hatası veriyor; sonsuz döngü süre aşımıyla duruyor; testli kod sorusu geçen/kalan sayısını gösteriyor.
  6. Tam yedeği dışa aktar, site verisini temizle, içe aktar → her şey (PDF, geçmiş, kart zamanlaması) geri geliyor.
  7. Ağ kapalıyken yeniden yükle → uygulama ve daha önce indirilen Python sürümü çalışıyor.
- **Gerçek cihaz:** Yayından sonra Android'de ana ekrana ekle; bilgisayardan alınan yedeği telefonda içe aktar, telefonda çözülen testle birlikte geri bilgisayara birleştir. Bu adım kullanıcıyla birlikte yapılır.

## Kullanıcıdan gerekenler

- GitHub hesabı ve bir depo oluşturup ilk push'u yapmak (kimlik bilgisi girişini ben yapamam; komutları adım adım veririm).
- Aşama 6'da telefonda kurulum ve yedek aktarma denemesi.
