# FraudCell dokümanları

FraudCell'i ben, Fırat Atalay, anlatıyorum. Takım iki kişiydi: kaptan bendim, takım arkadaşım Ayşe Mandıralı'ydı.
Proje Turkcell CodeNight 2026 All-Star finalinin "FraudCell" vakası için yazıldı. Etkinlikten sonra
sistemi tek başıma tamamladım. Hangi kısmın gecede, hangisinin sonrasında yazıldığını
[01-hikaye.md](01-hikaye.md) ayrı ayrı anlatıyor.

English version: [en/README.md](en/README.md)

## Okuma yolları

| Kim için | Süre | Sırayla oku |
|---|---|---|
| İK ve teknik olmayan okur | 5 dk | [01 Hikâye](01-hikaye.md) → [02 Demo turu](02-demo-turu.md) |
| Mühendis | 15 dk | [03 Mimari](03-mimari.md) → [05 İş kuralları](05-is-kurallari.md) → [11 Çözdüğüm problemler](11-cozdugum-problemler.md) |
| Mülakat öncesi hızlı tekrar | 10 dk | [11 Çözdüğüm problemler](11-cozdugum-problemler.md) → [12 Sorular ve sınırlar](12-sorular-ve-sinirlar.md) |
| Sistemi kendi makinesinde çalıştıracak kişi | 5 dk | [10 Çalıştırma ve API](10-calistirma-ve-api.md) |

## Dosyalar

| No | Dosya | İçerik |
|---|---|---|
| 01 | [Hikâye](01-hikaye.md) | Projenin doğuşu, ekip, kendime koyduğum kurallar, önce/sonra |
| 02 | [Demo turu](02-demo-turu.md) | Dört rolle beş dakikalık tur; demo ile gerçek sistemin farkı |
| 03 | [Mimari](03-mimari.md) | Servisler, olaylar, bir işlemin yolculuğu |
| 04 | [Veritabanı](04-veritabani.md) | Servis başına veritabanı, tablolar, outbox/inbox |
| 05 | [İş kuralları](05-is-kurallari.md) | Risk bantları, vaka durum makinesi, SLA, puanlar |
| 06 | [Güvenlik](06-guvenlik.md) | Kimlik, yetki, saldırı denemeleri, bilinen eksikler |
| 07 | [Yapay zekâ](07-yapay-zeka.md) | Modeller, veri, metrikler, geri bildirim döngüsü |
| 08 | [Arayüz ve tasarım](08-arayuz-ve-tasarim.md) | React mimarisi, tasarım dili, demo modu |
| 09 | [Yayın stratejisi](09-yayin-stratejisi.md) | Ücretsiz canlı demo, Docker ve CI |
| 10 | [Çalıştırma ve API](10-calistirma-ve-api.md) | Tek komutla kurulum, ortam değişkenleri, curl örnekleri |
| 11 | [Çözdüğüm problemler](11-cozdugum-problemler.md) | Problem → çözüm → neden hikâyeleri |
| 12 | [Sorular ve sınırlar](12-sorular-ve-sinirlar.md) | Olası mülakat soruları, bilinen sınırlar, yol haritası |

Ayrıca:

- [CASE-CHECKLIST.md](CASE-CHECKLIST.md): vaka dokümanının maddeleriyle karşılaştırma.
- [EVENTS.md](../BACKEND/EVENTS.md): olay kataloğu.
- [MODEL_CARD.md](../BACKEND/src/Ai/fraudcell-ai/MODEL_CARD.md): model kartı.

Hackathon gecesinde yazılan tasarım dokümanları (yaklaşık 36 bin satır) repodan çıkarıldı.
O gecenin hâli `allstar-final-2026-07-23` tag'inde aynen duruyor.
