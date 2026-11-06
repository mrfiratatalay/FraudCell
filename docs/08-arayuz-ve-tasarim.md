# 08. Arayüz ve tasarım

## Teknoloji

| Katman | Seçim |
|---|---|
| Çatı | React 19, TypeScript 5.9, Vite 8 |
| Yönlendirme | TanStack Router: filtreler ve sayfalama URL'de durur, paylaşılabilir |
| Sunucu durumu | TanStack Query: önbellek, yeniden deneme, invalidation |
| Formlar | React Hook Form + Zod |
| Stil | Tailwind CSS 4, Radix UI primitive'leri |
| Test | Vitest (birim), Playwright (tarayıcı) |
| Demo | Mock Service Worker (MSW) 2 |

Kod klasörleri: `routes/` ekranlar, `features/` alan bazlı API ve bileşenler, `shared/` tasarım sistemi ve API
istemcisi ([FRONTEND/app/src](../FRONTEND/app/src/)).

## Sunucu durumu tek yerde

Global bir store yok. Sunucudan gelen her şey TanStack Query önbelleğindedir. Gerçek zamanlı olaylar ikinci bir store
kurmaz; yalnızca ilgili sorguyu geçersiz kılar. Örneğin `case.decision.made` gelince vaka listesi yeniden çekilir.
Böylece aynı verinin iki farklı kopyası birbirinden kopamaz.

- **Access token yalnızca bellekte:** Sayfa yenilenince HttpOnly refresh cookie ile yenisi alınır.
- **SSE kısa ömürlü bilet ile açılır:** Token URL'e yazılmaz, böylece log ve geçmişe sızmaz.
- **ETag:** Vaka ekranı sürümü saklar ve her yazmada `If-Match` gönderir. 412 gelirse kullanıcı uyarılır.

## Tasarım dili

**Problem:** İlk sürüm kart yığınları, her sayfanın tepesinde boş bir başlık kartı ve pazarlama cümlelerinden
oluşuyordu. Analist bir vakaya bakmak için ekranın yarısını kaplayan bir halka göstergeyi aşmak zorundaydı.

**Çözüm:** Ekranları bir vaka yönetim aracı gibi yeniden kurdum:

- **Analist gelen kutusu:** Yoğun bir tablo; risk, işlem, tutar, durum ve canlı SLA tek satırda. En riskli ve en acil
  vaka üstte ([CaseTable.tsx](../FRONTEND/app/src/features/cases/CaseTable.tsx)).
- **Vaka çalışma alanı:** Üstte olgu şeridi, ortada eşik çizgili risk ölçeği ve AI gerekçesi, altta vaka geçmişi.
  Sağda sabit bir karar paneli her adımda tek bir sonraki işi gösterir
  ([CaseParts.tsx](../FRONTEND/app/src/features/cases/CaseParts.tsx)).
- **Süpervizör paneli:** "Şu an ne yapmalıyım?" sorusuyla açılır: önce müdahale bekleyen vakalar, sonra yük ve model.
- **Müşteri:** Bankacılık uygulaması düzeni. Müşteriye modelin risk seviyesi değil, işlemin **sonucu** gösterilir:
  Tamamlandı, İncelemede, Onaylandı, Engellendi.

**Renk:** Turkcell sarısı (#FFC900) yalnızca birincil eylemde ve aktif menüde, Turkcell laciverti ise kenar çubuğunda ve
koyu temada kullanılır. Bunu etkinliğe gönderme olarak bilerek yaptım; logo ve marka adı arayüzde yok.

**Risk renkleri** sıralıdır: Düşük yeşil, Orta koyu kehribar, Yüksek turuncu, Kritik kırmızı. Seviyeler renk tonunun
yanında açıklıkta da ayrışır ve her zaman yazıyla birlikte gösterilir; renk körlüğü olan biri de ayırt edebilir.
Orta seviyenin kehribarı, birincil butonun sarısından bilerek daha koyu tutuldu.

## Tema ve erişilebilirlik

- Açık ve koyu tema aynı CSS değişkenlerinden gelir. Tema ilk boyamadan önce ayarlanır, böylece ekran yanıp sönmez.
  CSP satır içi script'e izin vermediği için bu kod ayrı bir dosyadadır
  ([theme-init.js](../FRONTEND/app/public/theme-init.js)).
- Klavyeyle gezinmede görünür odak halkası, simge düğmelerde `aria-label`, gerçek `<button>` ve `<a>` elemanları.
- `prefers-reduced-motion` açıksa animasyonlar kapanır.
- Tablolar dar ekranda iki satırlık kartlara katlanır. Kırılma noktası ekranın değil, tablonun kendi genişliğine bağlıdır
  (container query). Aynı tablo hem tam sayfada hem panel sütununda düzgün durur.

## Demo modu

`VITE_API_MODE=mock` ile derlenen sürümde istekleri tarayıcıdaki bir Service Worker karşılar
([src/demo](../FRONTEND/app/src/demo/)):

- **Aynı sözleşme:** Ekran kodu gerçek sürümle birebir aynıdır; yalnızca taşıma katmanı değişir. Demo handler'ları
  `contract.ts` tiplerini döner.
- **Aynı kurallar:** Risk bantları, SLA süreleri, durum makinesi, puan tablosu ve ETag kontrolü backend'le aynıdır.
- **Taze veri:** Tohum veri her açılışta bugüne göre hesaplanır ve localStorage'da saklanır. Sağ alttaki rozet demoyu
  sıfırlar.
- **Pakete sızmaz:** Canlı derlemede `import.meta.env.VITE_API_MODE !== 'live'` derleme anında `false` olur. Demo
  dosyaları pakete hiç girmez; bunu derleme çıktısında kontrol ettim.

## Testler

- Birim: Vitest ile olay şeması, bildirim modeli ve yardımcılar (11 test).
- Tarayıcı: [roles.spec.ts](../FRONTEND/app/e2e/roles.spec.ts) dört rolü tek bir vaka üzerinden uçtan uca yürütür;
  CI'da gerçek sisteme karşı koşar. [auth-responsive.spec.ts](../FRONTEND/app/e2e/auth-responsive.spec.ts) giriş
  ekranının 320 pikselden masaüstüne kadar taşmadığını kontrol eder.
