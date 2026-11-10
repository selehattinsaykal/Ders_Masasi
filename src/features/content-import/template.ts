// Yapay zekâya verilecek hazır istem ve örnek dosya. docs/json-format.md ile aynı biçimi anlatır.

export const EXAMPLE_JSON = `{
  "format": "studyapp-content",
  "version": 1,
  "course": "Veri Yapıları",
  "decks": [
    {
      "title": "Ağaçlar",
      "cards": [
        {
          "front": "AVL ağacında denge faktörü nedir?",
          "back": "Sol ve sağ alt ağaç yükseklikleri farkı: $h_{sol} - h_{sağ} \\\\in \\\\{-1, 0, 1\\\\}$",
          "hint": "Yükseklik farkı",
          "topic": "Ağaçlar"
        }
      ]
    }
  ],
  "questionSets": [
    {
      "title": "2024 Güz Vize",
      "kind": "cikmis",
      "year": 2024,
      "term": "Güz",
      "examType": "vize",
      "durationMin": 60,
      "questions": [
        {
          "type": "mcq",
          "prompt": "Yığın (stack) hangi ilkeyle çalışır?",
          "options": ["FIFO", "LIFO", "Rastgele erişim", "Öncelik sırası"],
          "answer": "B",
          "explanation": "Son giren ilk çıkar.",
          "topic": "Yığın"
        },
        {
          "type": "tf",
          "prompt": "İkili arama, sırasız bir dizide de doğru sonuç verir.",
          "answer": false,
          "explanation": "İkili arama yalnızca sıralı dizide çalışır.",
          "topic": "Arama"
        },
        {
          "type": "fill",
          "prompt": "Kuyruk ___ ilkesiyle çalışır.",
          "answers": ["FIFO", "ilk giren ilk çıkar"],
          "topic": "Kuyruk"
        },
        {
          "type": "open",
          "prompt": "Bağlı liste ile dizinin araya eleman ekleme maliyetini karşılaştır.",
          "solution": "Dizide kaydırma gerektiği için $O(n)$; bağlı listede düğüm biliniyorsa $O(1)$.",
          "topic": "Bağlı liste"
        },
        {
          "type": "code",
          "prompt": "Girdiden bir n tam sayısı oku ve n faktöriyeli yazdır.",
          "language": "python",
          "pythonVersion": "3.9",
          "starter": "n = int(input())\\n# kodunu buraya yaz\\n",
          "solution": "n = int(input())\\nsonuc = 1\\nfor i in range(2, n + 1):\\n    sonuc *= i\\nprint(sonuc)",
          "tests": [
            { "stdin": "5\\n", "expected": "120\\n" },
            { "stdin": "0\\n", "expected": "1\\n" }
          ],
          "topic": "Döngüler"
        }
      ]
    }
  ]
}`

export const RULES = `Çıktın yalnızca tek bir JSON nesnesi olsun; öncesine ya da sonrasına açıklama yazma.

Kök alanlar:
- "format": "studyapp-content", "version": 1
- "course": dersin adı (isteğe bağlı)
- "decks": kart desteleri listesi (isteğe bağlı)
- "questionSets": testler listesi (isteğe bağlı)

Deste: { "title", "cards": [ { "front", "back", "hint"?, "topic"? } ] }
- "front" ön yüz (soru ya da kavram), "back" arka yüz (cevap ya da tanım).

Test: { "title", "kind", "year"?, "term"?, "examType"?, "durationMin"?, "questions": [...] }
- "kind": çıkmış sınav soruları için "cikmis", çalışma soruları için "calisma".
- "examType": "vize" | "final" | "but" | "quiz".

Soru tipleri (her soruda "type" ve "prompt" zorunlu; "explanation", "topic", "difficulty" (1-5) isteğe bağlı):
- "mcq" çoktan seçmeli: "options" (en az 2 şık), "answer" doğru şıkkın harfi ("A", "B"…) ya da 0'dan başlayan sıra numarası.
- "tf" doğru/yanlış: "answer" true ya da false.
- "fill" boşluk doldurma: boşluğu ___ ile göster; "answers" kabul edilen cevapların listesi; sayısal cevapta isteğe bağlı "tolerance".
- "open" klasik: "solution" örnek çözüm.
- "code" kod yazma (yalnızca Python): "pythonVersion" ("3.9"–"3.13"), "starter" başlangıç kodu, "solution" örnek çözüm, "tests" listesi: { "stdin": girdi, "expected": beklenen çıktı }. Program girdiyi input() ile okur, sonucu print() ile yazar.

Metin alanlarında Markdown kullanabilirsin. Formülleri LaTeX ile yaz: satır içi $...$, ayrı satırda $$...$$. Kod parçalarını \`\`\`python çitleri içine al. JSON içinde ters eğik çizgileri çiftle (\\\\frac gibi) ve satır sonlarını \\n ile yaz.
Soruların "topic" alanına konu adını yaz; aynı konu için hep aynı adı kullan.`

export function buildPrompt(kind: 'kart' | 'soru' | 'cikmis' | 'kod'): string {
  const task: Record<typeof kind, string> = {
    kart: 'Ekteki ders notlarından arkalı önlü çalışma kartları hazırla. Her kart tek bir bilgiyi sorsun; ön yüz kısa bir soru ya da kavram, arka yüz net bir cevap olsun. Konuları kapsayacak kadar kart üret ve kartları konu başlıklarına göre destelere ayır.',
    soru: 'Ekteki ders notlarından sınava hazırlık için çalışma soruları hazırla. Çoktan seçmeli, doğru/yanlış, boşluk doldurma ve klasik soruları karıştır. Her soruya kısa bir açıklama ekle. "kind" alanı "calisma" olsun.',
    cikmis: 'Ekteki çıkmış sınav kâğıdındaki soruları olduğu gibi aktar; soruları değiştirme, sırayı koru. Cevap anahtarı varsa onu kullan, yoksa doğru cevabı sen belirle ve açıklamasını yaz. "kind" alanı "cikmis" olsun; yıl, dönem ve sınav türünü doldur.',
    kod: 'Ekteki konulardan Python kod yazma soruları hazırla. Her soruda program girdiyi input() ile okusun, sonucu print() ile yazsın. Her soruya başlangıç kodu, örnek çözüm ve en az üç test ekle (girdi ve beklenen çıktı). "pythonVersion" alanına dersin kullandığı sürümü yaz ve o sürümde olmayan dil özelliklerini kullanma.',
  }
  return `${task[kind]}\n\nÇıktıyı aşağıdaki biçimde, bir uygulamaya içe aktarılacak JSON olarak ver.\n\n${RULES}\n\nÖrnek:\n${EXAMPLE_JSON}`
}
