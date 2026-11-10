# İçerik JSON biçimi

Çalışma kartları ve sorular bu biçimdeki bir JSON dosyasıyla içe aktarılır
(uygulamada **JSON içe aktar**). Dosyayı elle yazabilir ya da bir yapay zekâya
hazırlatabilirsin; hazır istem uygulamadaki **Yapay zekâ için şablon** sayfasında.

Tam bir örnek: [`examples/ornek-icerik.json`](../examples/ornek-icerik.json)

## Kök

```json
{
  "format": "studyapp-content",
  "version": 1,
  "course": "Veri Yapıları",
  "decks": [],
  "questionSets": []
}
```

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `course` | hayır | Ders adı. Aynı adlı ders varsa o seçilir, yoksa yeni ders önerilir. |
| `decks` | hayır | Kart desteleri. |
| `questionSets` | hayır | Testler. |

`decks` ve `questionSets`'ten en az biri olmalı. Kısa yazımlar da kabul edilir:
yalnızca bir kart listesi (`[{ "front": …, "back": … }]`) ya da yalnızca bir soru listesi.

## Deste ve kart

```json
{ "title": "Ağaçlar", "cards": [ { "front": "…", "back": "…", "hint": "…", "topic": "…" } ] }
```

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `front` | evet | Ön yüz: soru ya da kavram. |
| `back` | evet | Arka yüz: cevap ya da tanım. |
| `hint` | hayır | İpucu; kart çevrilmeden önce istenirse gösterilir. |
| `topic` | hayır | Konu adı. |

## Test

```json
{ "title": "2024 Güz Vize", "kind": "cikmis", "year": 2024, "term": "Güz",
  "examType": "vize", "durationMin": 60, "questions": [] }
```

| Alan | Açıklama |
|---|---|
| `kind` | `"cikmis"` (çıkmış sınav soruları) ya da `"calisma"` (çalışma soruları). |
| `year`, `term` | Çıkmış sınavın yılı ve dönemi. |
| `examType` | `"vize"`, `"final"`, `"but"`, `"quiz"`. |
| `durationMin` | Sınav modunda önerilen süre (dakika). |

## Sorular

Her soruda `type` ve `prompt` zorunludur. `explanation` (cevaptan sonra gösterilen
açıklama), `topic` ve `difficulty` (1–5) isteğe bağlıdır.

| `type` | Ek alanlar |
|---|---|
| `mcq` çoktan seçmeli | `options` (en az 2 şık), `answer`: doğru şıkkın harfi (`"A"`, `"B"`…) ya da 0'dan başlayan sıra numarası |
| `tf` doğru/yanlış | `answer`: `true` ya da `false` |
| `fill` boşluk doldurma | `answers`: kabul edilen cevaplar; sayısal cevapta isteğe bağlı `tolerance` |
| `open` klasik | `solution`: örnek çözüm (kullanıcı kendini değerlendirir) |
| `code` kod yazma | `pythonVersion`, `starter`, `solution`, `tests` |

### Kod soruları

Yalnızca Python. Program girdiyi `input()` ile okur, sonucu `print()` ile yazar.

```json
{
  "type": "code",
  "prompt": "Girdiden bir n tam sayısı oku ve n faktöriyeli yazdır.",
  "pythonVersion": "3.9",
  "starter": "n = int(input())\n",
  "solution": "…",
  "tests": [ { "stdin": "5\n", "expected": "120\n" } ]
}
```

- `pythonVersion`: `"3.9"`, `"3.10"`, `"3.11"`, `"3.12"`, `"3.13"`.
- `tests` varsa çıktı beklenenle karşılaştırılır (satır sonu türü ve sondaki boşluklar
  önemsenmez). Yoksa örnek çözüm gösterilir ve kullanıcı kendini değerlendirir.

## Metin biçimi

Tüm metin alanlarında Markdown geçerlidir.

- Formül: satır içi `$x^2$`, ayrı satırda `$$\int_0^1 x\,dx$$`.
  JSON içinde ters eğik çizgi çiftlenir: `"$\\frac{1}{2}$"`.
- Kod: üç ters tırnakla çitlenmiş blok (ör. dil adı `python`).
- Görsel: `![açıklama](https://…)` ya da gömülü `data:image/png;base64,…`.
- Boşluk doldurmada boşluk `___` ile gösterilir.

## Tekrar içe aktarma

Aynı başlıklı deste ya da test zaten varsa yeni öğeler onun içine eklenir. Aynı
kart (ön yüz) ya da soru (metin) yeniden gelirse atlanır ya da, istenirse, içeriği
güncellenir; çalışma geçmişi korunur.

## Hatalar

Hatalı bir kart ya da soru tek başına atlanır, geri kalanı içe aktarılır.
Önizleme ekranı atlanan her öğeyi nedeniyle listeler
(ör. “2024 Güz Vize › 3. soru: "answer" şıklarda yok”).
