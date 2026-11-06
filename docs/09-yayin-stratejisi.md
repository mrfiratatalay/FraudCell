# 09. Yayın stratejisi

## Problem

Yeni mezunum ve projeyi canlıda tutacak bütçem yok. FraudCell yedi uygulama container'ı, dört Postgres ve RabbitMQ
ister. Ücretsiz katmanlarda backend uyur, veritabanının süresi dolup silinir; İK uzmanı linke tıkladığında boş bir sayfa
görür.

## Çözüm: iki kanal

| Kanal | Kime | Ne |
|---|---|---|
| Canlı demo | İK, teknik olmayan okur | Vercel'de backend'siz demo; dört rolle tek tıkla giriş |
| Kod ve sistem | Mühendis | GitHub'daki kod, bu dokümanlar ve tek komutla ayağa kalkan gerçek sistem |

**Neden böyle?** Demo bedava ve hep açık. Mühendis ise gerçek sistemi kendi makinesinde bir komutla çalıştırabiliyor ve
her PR'da CI'ın onu temiz bir makinede nasıl açtığını görebiliyor.

**Bedeli:** Demo, gerçek mesaj kuyruğunu ve gerçek modeli göstermez. Bunu demoda ve
[02 Demo turu](02-demo-turu.md#demo-ile-gerçek-sistemin-farkı) dosyasında açıkça yazıyorum.

## Vercel (demo)

- [vercel.json](../FRONTEND/app/vercel.json): `npm run build:demo` ile derler, derin linkleri `index.html`'e yönlendirir.
  Sayfa yenilense de rota çalışır.
- Vercel projesinin kök dizini `FRONTEND/app`'tir.
- Maliyeti sıfır; sunucu yok, veritabanı yok.

## Docker (gerçek sistem)

- Her .NET servisi çok aşamalı bir Dockerfile ile derlenir; çalışma image'ı yalnızca ASP.NET runtime'ını taşır ve
  root olmayan kullanıcıyla çalışır.
- Taban image sürümleri sabittir ("latest" yok). Aynı commit her zaman aynı image'ı verir.
- AI image'ı eğitimi derleme sırasında yapar ve eğitim bağımlılıklarını son image'a taşımaz (700 MB).
- web, nginx'in root olmayan sürümüyle SPA'yı sunar.

## CI: her PR'da beş iş

[.github/workflows/ci.yml](../.github/workflows/ci.yml):

| İş | Ne yapar |
|---|---|
| dotnet | Derleme (uyarılar hata sayılır) ve 51 test; Testcontainers ile gerçek Postgres ve RabbitMQ |
| ai | 49 pytest testi |
| frontend | OpenAPI'den üretilen tiplerin güncel olduğunu kontrol, 11 birim testi, tip kontrolü, derleme |
| compose-config | `docker compose config` geçerli mi |
| demo-e2e | Temiz makinede `docker compose up --build`, ardından demo akışı (47 kontrol), AI kapalıyken akış, her container'ı sırayla durdurma, Playwright ile dört rol ve 96 güvenlik kontrolü |

`main`'e yalnızca beş işi de yeşil olan PR'lar girdi.

## Neden Kubernetes yok?

Vaka ve bütçe tek makinelik bir kurulum istiyor. Compose; sağlık kontrolleri, bağımlılık sırası ve özel ağlarla
ihtiyacı karşılıyor. Çok makineye çıkmak gerektiğinde servisler zaten ayrı image'lar ve ayrı veritabanları olduğu için
geçiş kodu değiştirmeyi gerektirmez.
