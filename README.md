# Ders Masası

Vize ve finallere çalışmak için kişisel uygulama. Telefonda ve bilgisayarda aynı
şekilde çalışır, çevrimdışı açılır; tüm veri cihazda durur ve tek dosyayla taşınır.

## Neler var

- **Dersler:** her dersin PDF'leri, testleri, kartları, kodları, konu listesi ve istatistiği.
- **PDF:** ders sunumu, çalışma PDF'i, çıkmış sınav. Kaldığın sayfa, yer imi ve not,
  PDF içinde arama, gece okuma, **optik form** (PDF'teki sınavı işaretle, anahtarla karşılaştır).
- **Testler:** çıkmış sorular ve çalışma soruları. Çoktan seçmeli, doğru/yanlış,
  boşluk doldurma, klasik, kod. Çalışma modu, sınav modu, yanlışlarım, karışık test.
  Doğru/yanlış/boş sayıları, konu bazında döküm, soru geçmişi.
- **Kartlar:** arkalı önlü, aralıklı tekrar (FSRS), sınav öncesi mod.
- **Python:** tarayıcıda çalışır, sürüm seçilir (3.9–3.13), otomatik testler.
- **JSON içe aktarma:** hazırlattığın kart ve soru dosyaları; biçim için
  [`docs/json-format.md`](docs/json-format.md).
- **Yedek:** her şeyi içeren tek `.studyapp` dosyası; değiştirerek ya da birleştirerek içe aktarma.
- Sınav takvimi, pomodoro, istatistik, genel arama, koyu/açık tema.

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # birim testleri
npm run build    # dist/ klasörüne üretim derlemesi
```

Yapı: `src/db` (şema ve veritabanı), `src/lib` (arayüzden bağımsız, testli mantık),
`src/features` (ekranlar), `src/ui` (ortak bileşenler), `public/py-worker.js` (Python çalıştırıcı).

## Yayınlama (GitHub Pages)

1. GitHub'da boş bir depo oluştur.
2. Bu klasörü o depoya gönder (`main` dalı).
3. Depoda **Settings → Pages → Source: GitHub Actions** seç.
4. `.github/workflows/deploy.yml` her gönderimde testleri çalıştırır, derler ve yayınlar.
5. Telefonda adresi Chrome ile aç, menüden **Ana ekrana ekle**.

Python sürümleri ilk kullanımda `cdn.jsdelivr.net` üzerinden iner ve önbelleğe alınır;
sonrasında çevrimdışı çalışır.
