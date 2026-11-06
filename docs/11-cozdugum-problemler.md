# 11. Çözdüğüm problemler

Her hikâye aynı sırayla anlatılıyor: problem, çözüm, neden ve koddaki yeri.

## 1. Temiz makinede açılmıyordu

- **Problem:** Repo yeni klonlandığında sistem açılmıyordu. İki sebebi vardı:
  - Postgres init betiğinin çalıştırma izni yoktu ("Permission denied").
  - AI model dosyaları `.gitignore`'daydı ve Dockerfile eğitim yapmıyordu.
- **Çözüm:**
  - Betiğe git'te çalıştırma izni verdim.
  - Modeli Docker build sırasında repodaki veriden eğittim.
  - CI'a, her PR'da temiz bir makinede `docker compose up` yapıp demo akışını koşan bir iş ekledim.
- **Neden:** "Bende çalışıyor" bir kanıt değil. Jüri ya da mülakatçı repoyu kendi makinesinde açacak.

## 2. AI kapalıyken işlem kaybolmamalı

- **Problem:** Vaka, AI servisi düşse bile ödeme akışının durmamasını istiyor.
- **Çözüm:**
  - İşlem her durumda kaydedilir ve olay outbox'a yazılır.
  - [AssessmentWatchdogWorker](../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/BackgroundJobs/AssessmentWatchdogWorker.cs)
    5 saniyede sonuç gelmeyen işlemi `TIMED_OUT` yapar ve "Belirsiz" riskli bir vakayı manuel kuyruğa açar.
- **Neden:** Riskli olabilecek bir işlemi sessizce "düşük risk" saymak en kötü sonuçtu. Belirsiz bırakıp bir insanın
  önüne koymak daha güvenli.
- **Kanıt:** CI'daki `demo.py ai-down` adımı AI'ı durdurup bunu her PR'da test eder.

## 3. Sağlıklı AI cevapları da zaman aşımına düşüyordu

- **Problem:** Sağlıklı trafik bile manuel kuyruğa düşüyordu. Compose bütün outbox'ları 2 saniyede bir yokluyordu, AI'ın
  süresi de 2 saniyeydi. `transaction.created` olayı çoğu zaman outbox'tan süre dolduktan sonra çıkıyordu.
- **Çözüm:** Outbox yoklamasını 500 ms'ye indirdim ve AI süresini 5 saniyeye çıkardım
  ([AssessmentOptions.cs](../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Common/AssessmentOptions.cs)).
  Gidiş-dönüş (outbox → AI → AI'ın outbox'ı → tüketici) yaklaşık 1–1,5 saniye; 5 saniye soğuk açılışlara pay bırakıyor.
- **Neden:** Zaman aşımı bir güvenlik ağı; normal yolun parçası olmamalı. Süreyi zincirin gerçek uzunluğuna göre seçtim.

## 4. Puan kuralı analisti her şeyi bloklamaya itiyordu

- **Problem:** Her blok +15 "doğrulanmış dolandırıcılık" puanı alıyordu. Yanlış blok da ödüllendiriliyordu.
- **Çözüm:**
  - Önce bunu yakalayan kırmızı bir test yazdım.
  - Sonra kuralı müşterinin cevabına bağladım: blok ve "ben yapmadım" ise +15, blok ve "ben yaptım" ise −8
    ([PointRuleEngine.cs](../BACKEND/src/Services/Gamification/FraudCell.Gamification.Service/Common/PointRuleEngine.cs)).
- **Neden:** Vakada kararın doğruluğunu bilen tek kaynak müşteri. Oyunlaştırma yanlış davranışı ödüllendirirse zarar
  verir.

## 5. Rozet bir karar geç geliyordu

- **Problem:** "İlk Yakalama" ilk doğru blokta değil, ikincisinde veriliyordu (off-by-one).
- **Çözüm:** Rozet eşiği kontrol edilirken o anki kararın da sayılması.
- **Nasıl fark ettim:** Canlı demoda doğru bir bloktan sonra analistin rozet sayısı 0 kaldı. Önce bunu tekrar
  eden bir Testcontainers testi yazdım, sonra düzelttim. Bugün tarayıcı testi de rozet toast'ını bekliyor.

## 6. Tek veritabanı, sözde servis sınırları

- **Problem:** Dört servis tek bir Postgres'i ve tek bir ortak anahtar dosyasını paylaşıyordu.
- **Çözüm:**
  - Her servise kendi Postgres'ini ve özel ağını verdim.
  - Başka servisin verisine olaylardan beslenen projeksiyonlarla ulaştım.
  - İmza anahtarını JWKS ile yalnızca Identity'de tuttum.
- **Neden:** Bir servisin şeması değiştiğinde diğerleri kırılmamalı. Private key de tek yerde durmalı.
- **Bedeli:** Eventual consistency. Atama anında analistin durumu bir kez daha kontrol ediliyor.

## 7. Gerçek zamanlı bildirim gateway'in içindeydi

- **Problem:** SSE bağlantıları gateway'deydi. Gateway yeniden başladığında bütün canlı bağlantılar kopuyordu ve
  gateway'in tek işi yönlendirme olmaktan çıkıyordu.
- **Çözüm:**
  - Ayrı bir notification servisi kurdum. RabbitMQ'dan olayları dinliyor, tarayıcıya SSE ile iletiyor.
  - Tarayıcı bağlantıyı kısa ömürlü, tek kullanımlık bir biletle açıyor; token URL'e yazılmıyor.
- **Neden:** Her servisin tek bir sorumluluğu olsun. Token da loglara sızmasın.

## 8. İki süpervizör aynı vakayı aynı anda atarsa

- **Problem:** Son yazan kazanıyor ve ilk atama sessizce kayboluyordu (lost update).
- **Çözüm:**
  - Her kayda bir `version` kolonu ekledim.
  - `GET` cevabı ETag dönüyor, yazma `If-Match` istiyor. Eski sürüm 412 alıyor.
  - Aynı anda gelen iki yazmayı EF Core'un concurrency token'ı 409 ile yakalıyor.
- **Neden:** Bir kararın başkası farkında olmadan ezilmesi dolandırıcılık operasyonunda kabul edilemez.

## 9. Müşteri liderlik tablosunu okuyabiliyordu

- **Problem:** Müşteri token'ı, personelin puanlarını ve rozetlerini dönen uçlara erişebiliyordu.
- **Çözüm:**
  - Gamification uçlarını personele kapattım.
  - Jürinin deneyeceği bütün saldırıları [security.py](../scripts/security.py) betiğine yazıp CI'a bağladım (96 kontrol).
- **Neden:** Tek tek düzeltmek yerine, aynı hata türünün geri gelmesini otomatik testle engellemek.

## 10. Çalınan refresh token

- **Problem:** Refresh token çalınırsa saldırgan oturumu sonsuza kadar uzatabilirdi.
- **Çözüm:**
  - Her yenilemede token değişiyor (rotation).
  - Kullanılmış bir token tekrar gelirse kullanıcının bütün oturumları kapatılıyor (reuse detection).
- **Neden:** Gerçek kullanıcı ile saldırganın hangisi olduğunu bilemiyoruz. Güvenli olan, ikisini de dışarı atmak.

## 11. Gece işlemi yanlış hesaplanıyordu

- **Problem:** Container UTC'de çalışıyordu. İstanbul'da gece 02:00'de yapılan bir işlem modele 23:00 olarak gidiyordu.
- **Çözüm:** Saat ve gece özelliklerini açıkça İstanbul saat dilimine göre hesaplayıp bir testle sabitledim.
- **Neden:** "Gece işlemi" en güçlü dolandırıcılık sinyallerinden biri. Yanlış hesaplanırsa model sessizce kötüleşir.

## 12. Arayüz şablon gibi duruyordu

- **Problem:** Ekranlar kart yığınlarından, boş başlık kartlarından ve pazarlama metinlerinden oluşuyordu. Analistin asıl
  işi (karar vermek) ekranda kayboluyordu.
- **Çözüm:**
  - Ekranları bir vaka yönetim aracı gibi yeniden kurdum: yoğun tablolar, sabit karar paneli, "önce müdahale bekleyenler"
    diye açılan panel.
  - Müşteriye risk seviyesi yerine işlemin sonucunu gösterdim.
  - Dört rolü tek vaka üzerinden yürüten Playwright testini CI'a bağladım.
- **Neden:** Bu bir operasyon aracı. Güzelliği, doğru işi ilk bakışta göstermesinden geliyor.
