# 01. Hikâye

## Vaka

Turkcell CodeNight 2026 All-Star finalinde bize "FraudCell" vakası verildi: dijital ödemelerde dolandırıcılığı
yakalayan bir platform. İstenenler:

- Her işlemi yapay zekâyla skorlamak.
- Riskli olanı vakaya çevirip doğru analiste atamak.
- Vakayı SLA süresiyle takip etmek.
- Gerekirse müşteriye "bu işlemi sen mi yaptın?" diye sormak.
- Analistleri puan, rozet ve liderlik tablosuyla motive etmek.

Dört rol vardı: müşteri, analist, süpervizör, yönetici. Vaka dokümanı repoda duruyor:
[CodeNight_FINAL_FraudCell_Case.pdf](../BACKEND/references/CodeNight_FINAL_FraudCell_Case.pdf).

## Ekip ve roller

İki kişiydik: kaptan ben (Fırat Atalay), takım arkadaşım Ayşe Mandıralı. Finalde derece almadık; All-Star finalisti
olarak yarıştık.

## İki dönem

**Hackathon gecesi (2026-07-22 17:45 → 2026-07-23 04:52, 16 commit).**

- **Ayşe:** Mimari dokümanlarını, Identity ve Transaction servislerinin ilk hâlini ve frontend'in temel katmanını kurdu.
- **Ben:** Servisleri birbirine bağladım, AI kapalıyken işlemin kaybolmamasını sağlayan yedek akışı yazdım, demo akışlarını
  tamamladım ve arayüzü yeniden yaptım.

Gece biterken sistem çalışıyordu ama temiz bir makinede açılmıyordu ve birçok kural eksikti.

**Etkinlik sonrası (Kasım 2026, Part 0–6).** Projeyi CV'mde savunabilmek için baştan sona ben tamamladım. Kodun önemli
bir kısmını yapay zekâyla (Claude Code) birlikte, kendi koyduğum kurallar altında yazdım. Her adımı ayrı bir PR'da
yaptım ve her PR'ı yeşil CI ile birleştirdim.

## Kendime koyduğum kurallar

1. **Tek komutla açılsın.** `docker compose up` temiz bir makinede, elle hiçbir adım olmadan çalışmalı.
2. **Her iddiayı bir test kanıtlasın.** Vaka dokümanındaki zorunlu akış CI'da her PR'da baştan çalışır.
3. **Servis sınırları gerçek olsun.** Her servisin kendi veritabanı vardır; servisler birbirinin tablosuna dokunmaz.
4. **Önce kırmızı test, sonra düzeltme.** İş kuralı hatalarını önce bir testle yakalayıp sonra düzelttim.
5. **Gece ile sonrası karışmasın.** Hackathon hâli bir tag'de duruyor; sonrası küçük commit'lerle geliyor.

## Önce / sonra

| Konu | Hackathon sonunda | Bugün |
|---|---|---|
| Temiz makinede açılış | Açılmıyordu: init betiği çalıştırılamıyordu, model dosyaları repoda yoktu | `make up` ya da `docker compose up` yeterli |
| Veritabanı | Tek Postgres, ortak anahtar dosyası | Servis başına ayrı Postgres, özel ağ, JWKS |
| Gerçek zamanlı bildirim | Gateway'in içindeydi | Ayrı notification servisi (SSE) |
| Puan kuralı | Her blok +15 puan alıyordu | +15 yalnızca müşteri "ben yapmadım" dediyse |
| Güvenlik | Müşteri liderlik tablosunu okuyabiliyordu | 96 saldırı denemesi CI'da her PR'da koşuyor |
| AI | Model dosyaları ve eğitim verisi repoda yoktu | Veri ve 120 Türkçe senaryo repoda, model kartı, geri bildirim döngüsü |
| Testler | C# tarafında 5 test | 51 .NET, 49 Python, 11 birim, 2 tarayıcı testi + 47 demo, 96 güvenlik kontrolü |
| CI | Temmuz'dan beri kırmızıydı | 5 iş yeşil: .NET, AI, frontend, compose, uçtan uca demo |
| Arayüz | Kart yığınları, pazarlama metinleri | Vaka tabloları, karar paneli, açık/koyu tema |
| Dokümanlar | 36 bin satır AI üretimi plan | Bu 12 dosya, Türkçe ve İngilizce |

Sayıların kaynağı: son CI koşusunun çıktısı ve [CASE-CHECKLIST.md](CASE-CHECKLIST.md).
