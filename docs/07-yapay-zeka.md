# 07. Yapay zekâ

FraudCell'in özgün tarafı, yapay zekâ ile insan kararının birlikte çalışmasıdır. Model riskli işlemi bulur, analist
karar verir, müşteri ise kararın doğru olup olmadığını söyler. Modelin başarısı bu cevaba göre ölçülür.

Ayrıntılı model kartı: [MODEL_CARD.md](../BACKEND/src/Ai/fraudcell-ai/MODEL_CARD.md).

## İki model

| Model | Algoritma | Çıktı |
|---|---|---|
| Risk | HistGradientBoosting + sigmoid kalibrasyon | 0–1 arası skor |
| Fraud türü | RandomForest (300 ağaç) | Çalıntı Kart, Hesap Ele Geçirme, Para Aklama, Şüpheli Davranış |

Kalibrasyon önemli: skor 0,90 dediğinde gerçekten "yüksek ihtimal" anlamına gelmeli, çünkü eşikler (0,40 / 0,90)
doğrudan bu skora uygulanıyor.

## Veri

- 10.000 sentetik Türk kart ve cüzdan işlemi, yaklaşık 1.250 simüle müşteri, sabit seed
  ([synthetic_data.py](../BACKEND/src/Ai/fraudcell-ai/app/ml/synthetic_data.py)).
- Dolandırıcılık oranı %11. Etiket, özelliklerden lojistik bir fonksiyonla örneklenir. Bu yüzden sınıflar iç içe geçer
  ve metrikler şişmez.
- 120 elle yazılmış Türkçe senaryo ("Gece yarısı yurt dışından, yeni cihazla art arda yüksek tutarlı kart ödemeleri"
  gibi) eğitime **girmez**; bağımsız bir kabul seti olarak kullanılır.
- Veri repoda duruyor; bir test, repodaki dosyanın üreticiyle bayt bayt aynı olduğunu kontrol ediyor.

## Özellikler

15 kolon ([features.py](../BACKEND/src/Ai/fraudcell-ai/app/ml/features.py)):

- **Tutar:** tutar ve müşterinin ortalamasından sapma.
- **Zaman:** saat ve gece bilgisi (İstanbul saatine göre).
- **Yenilik:** yurt dışı, yeni cihaz, yeni alıcı.
- **Hız:** son 10 dakika ve son 24 saatteki işlem sayısı.
- **İşlem türü.**

AI servisi Transaction veritabanına bağlanamaz. Bu yüzden hız ve yenilik sinyallerini **kendi** tahmin geçmişinden
hesaplar. Servis sınırını korumanın bedeli buydu.

**Saat hatası:** Container UTC'de çalışıyordu ve gece 02:00'deki bir işlem modele 23:00 olarak gidiyordu. "Gece işlemi"
özelliği yanlış hesaplanıyordu. Saati açıkça İstanbul saat dilimine çevirdim ve bunu bir testle sabitledim.

## Metrikler (dürüst hâli)

Test setinde, 0,40 eşiğinde:

| PR-AUC | Precision | Recall | F1 | Yanlış pozitif oranı |
|---|---|---|---|---|
| 0,609 | 0,715 | **0,521** | 0,603 | 0,026 |

- Recall 0,52: model dolandırıcılıkların yaklaşık yarısını yakalıyor. Bu eşikte yanlış alarm oranını düşük tutmayı
  tercih ettim. Bedeli, kaçan vakalar.
- Türkçe senaryolarda: meşru senaryoların %100'ü geçti; dolandırıcılık senaryolarının %47'si yakalandı; tür tahmini
  %87 doğru. Şüpheli Davranış türünde başarı %33 ile en zayıf yer.
- Bu sınır [12 Sorular ve sınırlar](12-sorular-ve-sinirlar.md) dosyasında da yazıyor; mülakatta saklamıyorum.

## Açıklama

Her skorun yanında **gerekçe kodları** gelir: "İlk kez görülen cihaz", "Normal tutarın 10 katı" gibi
([reason_codes.py](../BACKEND/src/Ai/fraudcell-ai/app/ml/reason_codes.py)). Bunlar modelin iç açıklaması değil;
özelliklerden kural tabanlı üretilir ve analistin okuyabileceği bir dildedir. `GEMINI_API_KEY` verilirse aynı bilgiler
bir LLM ile akıcı bir paragrafa çevrilir. Anahtar yoksa aynı paragraf şablonla üretilir. LLM yalnızca anlatımı yazar;
skor ve karara asla dokunmaz ([explanation.py](../BACKEND/src/Ai/fraudcell-ai/app/ml/explanation.py)).

## Geri bildirim döngüsü

1. Süpervizör AI'ın türünü ya da risk seviyesini düzeltirse `case.fraud_type.overridden` /
   `case.risk_level.overridden` olayı gelir.
2. Analist karar verince `case.decision.made` olayı müşterinin cevabıyla birlikte gelir.
3. AI bunları `prediction_feedback` tablosuna yazar
   ([feedback.py](../BACKEND/src/Ai/fraudcell-ai/app/ml/feedback.py)) ve türe göre precision ile recall hesaplar.
4. Süpervizör panelindeki "Model doğruluğu" kartı bu metrikleri gösterir.

Yalnızca gerçekten puanlanmış satırlar sayılır. Cevapsız vakalar oranı şişirmez.

## AI kapalıyken

AI servisi düşerse işlem yine kaydedilir. 5 saniye içinde sonuç gelmezse vaka "Belirsiz" riskle manuel kuyruğa açılır
ve süpervizör atar. CI'da `demo.py ai-down` adımı AI container'ını durdurup bunu her PR'da doğrular.

## Model yaşam döngüsü

- Model, Docker image'ı derlenirken repodaki veriden eğitilir; artifact'lar repoya girmez.
- `model_versions` ve `model_bundles` tablolarında sürüm ve checksum tutulur. Checksum uyuşmazsa servis "hazır değil"
  durumuna geçer ve sağlık kontrolünden geçmez.
- Image boyutu eğitim bağımlılıkları ayrılarak 1,72 GB'tan 700 MB'a indi.
