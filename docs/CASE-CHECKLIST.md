# FraudCell: Case Uyum Kontrol Listesi

Kaynak: [Turkcell CodeNight 2026 Final case dokümanı][case PDF] (18 sayfa).
Denetim tarihi: 2026-11-05; Part 7 sonunda (2026-11-06) güncellendi. Başlangıç noktası, hackathon bitişindeki kod: tag
[`allstar-final-2026-07-23`](https://github.com/mrfiratatalay/FraudCell/tree/allstar-final-2026-07-23)
(`b139a9c`, 2026-07-23 04:52).

Bu liste case dokümanındaki her gereksinimi tek satıra indirir ve üç soruyu cevaplar:
kodda gerçekten var mı, nereden kanıtlanıyor, eksikse hangi adımda kapanacak?
Her part bittiğinde ilgili satırlar güncellenir.

**Durum**

| İşaret | Anlamı |
|---|---|
| ✅ | Karşılanıyor. Kodda var, kanıtı gösterildi. |
| ⚠️ | Kısmen. Var ama case'in istediğinden eksik ya da henüz doğrulanmadı. |
| ❌ | Eksik. |
| 🐛 | Hatalı. Var ama yanlış çalışıyor. |

**Kanıt türleri:** dosya/satır bağlantısı kod incelemesidir. "canlı" işareti, 2026-11-04'te Docker Compose ile
yapılan uçtan uca çalıştırmayı gösterir (iki kurulum engeli geçici olarak yamanmıştı, bkz. 2.2-d).

## Özet

| Bölüm | ✅ | ⚠️ | ❌ | 🐛 |
|---|---:|---:|---:|---:|
| 2. Mimari | 11 | 0 | 0 | 0 |
| 3. Identity | 19 | 1 | 0 | 0 |
| 4. Transaction | 20 | 0 | 0 | 0 |
| 5. AI | 14 | 0 | 0 | 0 |
| 6. Gamification | 13 | 0 | 0 | 0 |
| 7. Süpervizör paneli | 4 | 2 | 0 | 0 |
| 8. API tasarımı | 2 | 2 | 0 | 0 |
| 9. Event akışı | 3 | 0 | 0 | 0 |
| 10. Güvenlik | 7 | 0 | 0 | 0 |
| 11. Demo senaryosu | 10 | 0 | 0 | 0 |
| 12. Değerlendirme ve bonus | 7 | 0 | 0 | 0 |
| 13. Diskalifiye koşulları | 5 | 0 | 0 | 0 |
| 14. Teslimat | 9 | 0 | 0 | 0 |
| **Toplam (129 satır)** | **124** | **5** | **0** | **0** |

Bazı satırlar aynı kök nedene bağlıdır. Örneğin `docker compose up` sorunu 2.2-d, 11.3-1 ve 13.2-b'de
ayrı ayrı görünür.

**En kritik dört açık:**

1. ~~Analistin AI kararını değiştirmesi AI servisine ulaşmıyor (4.3-c, 5.4).~~ Part 5'te düzeltildi.
2. ~~"+15 doğrulanmış dolandırıcılık" puanı her blok kararına veriliyor (6.1-c).~~ Part 3'te düzeltildi.
3. ~~AI servisinin endpoint'leri token olmadan erişilebilir (10-b).~~ Part 4'te gateway'de kapatıldı.
4. ~~Veritabanları tek PostgreSQL container'ında (2.2-a).~~ Part 2'de düzeltildi.

Her part ayrı bir PR'dır (PR #4–#11); satırlardaki "Part" sütunu kapandığı adımı gösterir.

## 2. Mimari gereksinimler

| # | Gereksinim | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 2.1-a | En az 4 bağımsız mikroservis ve 1 API Gateway | ✅ | Identity, Transaction, Gamification (.NET 10), AI (FastAPI), Edge Gateway (YARP). Her biri ayrı image ve container ([docker-compose.yml]). | |
| 2.1-b | Gateway: tek giriş noktası, routing, rate limiting, JWT doğrulama | ✅ | Gateway JWT'yi Identity'nin JWKS'iyle doğrular, rotalara rol politikası uygular; [security.py](../scripts/security.py) token'sız 401 ve yanlış rol 403 matrisini her PR'da dener. | Part 2, 4 |
| 2.1-c | Identity: kayıt, giriş, token, rol/yetki, audit log, hesap kilitleme | ✅ | §3 | |
| 2.1-d | Transaction: işlem kaydı, vaka yaşam döngüsü, SLA, analist notu | ✅ | §4 | |
| 2.1-e | AI: risk skorlama, tür sınıflandırma, akıllı atama | ✅ | §5 | |
| 2.1-f | Gamification: puan, rozet, seviye, liderlik; event ile tetiklenir | ✅ | §6 | |
| 2.2-a | Database-per-service; bir servis başka servisin DB'sine erişemez | ✅ | Dört ayrı PostgreSQL container'ı, her biri yalnızca kendi servisinin özel ağında ([docker-compose.yml]). | Part 2 |
| 2.2-b | Servisler arası iletişim: message queue tercih edilir | ✅ | RabbitMQ topic exchange, transactional outbox, idempotent inbox, TTL tabanlı retry kuyrukları ve DLQ ([RabbitMqTopology.cs], [OutboxPublisherService.cs]). Servisler arasında senkron REST çağrısı yok. | |
| 2.2-c | Bir servis çökünce diğerleri çalışır; AI kapalıyken işlem oluşturulur, BELIRSIZ olarak işaretlenip manuel atamaya düşer | ✅ | CI'da `demo.py ai-down` AI'ı durdurur: işlem kaydedilir, `TIMED_OUT`, vaka `MANUAL_QUEUE`; `demo.py resilience` her container'ı sırayla durdurur. | Part 1, 2 |
| 2.2-d | `docker compose up` ile tüm sistem ayağa kalkar | ✅ | Part 1'de düzeltildi: [init-multiple-databases.sh] çalıştırılabilir, AI modeli image build'inde eğitiliyor (model dosyaları hâlâ gitignore'da: [BACKEND/.gitignore#L30-L31]), gateway yalnızca Identity'yi bekliyor. CI'daki `demo-e2e` job'u her PR'da temiz makinede `docker compose up` yapıp demoyu çalıştırıyor. | |
| 2.2-e | Her servisin README'si: sorumluluk, endpoint listesi, environment değişkenleri | ✅ | Altı servisin README'si ve [docs/](README.md) altındaki 12 doküman. | Part 7 |

## 3. Identity Service

| # | Gereksinim | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 3.1-a | Müşteri kaydı: GSM + OTP (sabit 1234); ad, soyad, GSM, e-posta (opsiyonel) | ✅ | [OtpService.cs] (sabit kod, 5 dk geçerlilik, 5 deneme), [VerifyOtpChallengeEndpoint.cs]. canlı | |
| 3.1-b | Personel hesabını admin oluşturur; e-posta + şifre; uzmanlık/bölge çoklu seçilir | ✅ | Uzmanlık yalnızca analist için zorunlu; süpervizör ve admin uzmanlıksız oluşturulabiliyor ([CreateStaffEndpoint.cs]). `demo.py seed` süpervizörü uzmanlıksız açıyor, CI'da her PR'da koşuyor. | |
| 3.1-c | Şifre politikası (min 8, 1 büyük harf, 1 rakam, 1 özel karakter); ihlal edilen kural net mesajla dönülür | ⚠️ | Kurallar doğru ([Identity/Program.cs#L68-L73]). Hata `violations` kodlarıyla dönüyor ([CreateStaffEndpoint.cs#L91-L98]) ama mesajlar ASP.NET Identity'nin İngilizce varsayılanları. | Part 4 |
| 3.1-d | bcrypt veya argon2 ile hash | ✅ | Argon2id ([Argon2idPasswordHasher.cs], kayıt [Identity/Program.cs#L88]) | |
| 3.1-e | 5 başarısız girişte 15 dk kilit; kilitli hesapta kalan süre döner | ✅ | [Identity/Program.cs#L75-L78]; kilitli hesap 423 `ACCOUNT_LOCKED` ve `remainingSeconds` döner ([StaffLoginEndpoint.cs#L69-L82]). Test: `scripts/security.py` (CI demo-e2e), 5 yanlış şifreden sonra doğru şifre 423 alıyor. | |
| 3.2-a | Access token JWT, 15 dk; payload'da user_id, rol, uzmanlık/bölge | ✅ | RS256, [Identity/appsettings.json#L16-L17], claim'ler [JwtTokenService.cs#L38-L39] | |
| 3.2-b | Refresh token 7 gün, veritabanında saklanır | ✅ | Hash'lenmiş olarak saklanıyor, HttpOnly cookie ile taşınıyor ([RefreshTokenService.cs]) | |
| 3.2-c | Rotation; iptal edilmiş refresh token tekrar kullanılırsa kullanıcının **tüm** oturumları sonlanır | ✅ | Reuse'da kullanıcının bütün oturumları (başka cihazdakiler dahil) iptal ediliyor ([RefreshTokenService.cs]). Test: [RefreshTokenServiceTests.cs] (Postgres), `scripts/security.py` (CI demo-e2e). | |
| 3.2-d | Logout refresh token'ı geçersiz kılar | ✅ | [LogoutEndpoint.cs] | |
| 3.3-a | İşlem oluşturma: yalnızca müşteri | ✅ | [CreateTransactionEndpoint.cs#L60] | |
| 3.3-b | Kayıt görme: müşteri kendininkini, personel atananı, süpervizör ve admin tümünü | ✅ | Vaka detayı [GetCaseEndpoint.cs]; işlem detayında analist yalnızca kendisine atanmış vakanın işlemini görüyor, aksi 404 ([GetTransactionEndpoint.cs]). Test: `scripts/security.py` (CI demo-e2e). | |
| 3.3-c | Durum değiştirme: personel ve süpervizör | ✅ | İnceleme, doğrulama ve karar endpoint'leri `ANALYST, SUPERVISOR` istiyor | |
| 3.3-d | Manuel atama: yalnızca süpervizör | ✅ | [ManualAssignmentEndpoint.cs], [ReassignmentEndpoint.cs] | |
| 3.3-e | Kategori/tür değiştirme (AI override): personel ve süpervizör | ✅ | [FraudTypeOverrideEndpoint.cs#L27] | |
| 3.3-f | Dashboard görüntüleme: süpervizör ve admin | ✅ | AI metrikleri gateway'de yalnızca süpervizör ve admin'e açık ([Edge/Program.cs]). Liderlik tablosu ve rozet listesi personele açık, müşteriye 403 (§6.4 analistler için de). Test: `scripts/security.py` (CI demo-e2e) rol matrisi. | |
| 3.3-g | Personel hesabı oluşturma: admin | ✅ | [CreateStaffEndpoint.cs#L37] | |
| 3.3-h | Audit log görüntüleme: admin | ✅ | [GetAuditLogsEndpoint.cs] | |
| 3.3-i | Yetkisiz erişim 403 döner ve audit log'a yazılır | ✅ | Her servis, AI dahil, kendi 403'ünü kendi outbox'ı üzerinden audit'e yazıyor ([AuthorizationDeniedAuditMiddleware.cs], AI: [security.py]). Gateway AI route'larında yalnızca geçerli token istiyor, bu yüzden her 403 tek kez yazılıyor. Test: `scripts/security.py` (Transaction ve AI 403'ü audit log'da tam bir kez). Sahiplik ihlallerinde bilinçli olarak 404. | |
| 3.4-a | Audit: başarılı/başarısız giriş, kilitlenme, rol değişikliği, 403, kritik durum değişiklikleri | ✅ | [AuditWriter.cs]; diğer servisler `audit.entry.requested` yayınlıyor, Identity tüketiyor ([AuditEntryRequestedConsumer.cs]). 403 kaydı `scripts/security.py` (CI demo-e2e) ile test ediliyor; diğer eylemlerin otomatik testi yok. | |
| 3.4-b | Kayıt alanları: kim, ne, ne zaman, nereden (IP), sonuç, detay | ✅ | [AuditLog.cs] | |

## 4. Transaction Service

| # | Gereksinim | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 4.1-a | Girdi: tutar, tip (ÖDEME/TRANSFER/FATURA/ÇEKİM), alıcı, kaynak cihaz, konum (şehir), zaman | ✅ | [CreateTransactionEndpoint.cs#L20-L27]; `Idempotency-Key` header'ı zorunlu | |
| 4.1-b | Her işlem otomatik olarak AI'a gider; risk skoru, tür ve karar (ONAY/İNCELEME/BLOK) atanır | ✅ | `transaction.created` → AI → `ai.assessment.completed`. Eşikler Transaction'da yeniden uygulanıyor ([RiskThresholds.cs]). canlı: 0.71 / YUKSEK / CALINTI_KART | |
| 4.1-c | AI erişilemezse işlem yine kaydedilir (BELIRSIZ, İNCELEME), manuel kuyruğa düşer | ✅ | Watchdog 2 sn sonra `TIMED_OUT` yapıp `MANUAL_QUEUE`'ya alıyor ([AssessmentWatchdogWorker.cs]); risk `BELIRSIZ` gösteriliyor ([Transaction.cs#L145]). canlı | |
| 4.1-d | Sistem genelinde benzersiz, okunabilir işlem numarası (TRX-2026-000123) | ✅ | [TransactionNumberGenerator.cs#L46] `TRX-{yıl}-{000000}`, atomik sayaç | |
| 4.2-a | State machine: YENI → ATANDI → INCELENIYOR ⇄ MUSTERI_DOGRULAMA → ONAYLANDI/BLOKLANDI; ONAYLANDI → KAPANDI (48 saat) | ✅ | [RiskCase.cs]: her geçiş ayrı metot, genel bir `Status` setter'ı yok; kapanış [CaseClosureWorker.cs]. Test: [RiskCaseStateMachineTests.cs] | |
| 4.2-b | Kural dışı geçiş 422 döner | ✅ | Domain kuralı 422 `INVALID_CASE_TRANSITION` / `CASE_ALREADY_DECIDED` olarak dönüyor. Endpoint seviyesinde: `demo.py smoke` bloklanmış vakaya ikinci kararın 422 döndüğünü kontrol ediyor. | |
| 4.2-c | BLOKLANDI kararında not zorunlu | ✅ | [RiskCase.cs] `Block` | |
| 4.2-d | BLOKLANDI vakanın kapanışı | ✅ | Karar: BLOKLANDI da 48 saat sonra KAPANDI olur. Müşteri yalnızca KAPANDI vakayı puanlayabildiği (§4.6) ve bloklanan işlemi de puanladığı (§11.1) için. Gerekçe [RiskCase.cs] `Close` yorumunda; test [RiskCaseStateMachineTests.cs]. | |
| 4.3-a | Türler: CALINTI_KART, HESAP_ELE_GECIRME, PARA_AKLAMA, SUPHELI_DAVRANIS, TEMIZ | ✅ | [Transaction/Domain/Enums.cs#L13-L20] | |
| 4.3-b | Tür AI tarafından atanır; analist veya süpervizör değiştirebilir | ✅ | [FraudTypeOverrideEndpoint.cs#L27] | |
| 4.3-c | Tür değişikliği AI Service'e bildirilir (doğruluk metriği için) | ✅ | AI `case.fraud_type.overridden`'ı tüketip vakanın `prediction_feedback` satırını yanlış sınıflandırma olarak işaretliyor ([feedback_consumers.py]). | |
| 4.3-d | Risk seviyeleri DUSUK/ORTA/YUKSEK/KRITIK; skor > 0.9 → KRITIK ve otomatik geçici blok; süpervizör değiştirebilir | ✅ | [RiskThresholds.cs], [AiAssessmentCompletedConsumer.cs#L166-L184], [RiskLevelOverrideEndpoint.cs] (yalnızca süpervizör) | |
| 4.4-a | SLA: KRITIK 15 dk, YUKSEK 1 sa, ORTA 4 sa, DUSUK 24 sa | ✅ | [RiskCase.cs#L63-L69] | |
| 4.4-b | Aşımda: KRITIK işlem geçici bloklanır ve panelde en üstte kırmızı görünür; YUKSEK turuncu; ORTA ve DUSUK görsel uyarı | ✅ | Aşılan SLA listelerde ve panelde en üstte; KRITIK kırmızı, YUKSEK turuncu, ORTA/DUSUK uyarı rengiyle. | Part 6 |
| 4.4-c | SLA vaka oluşturulunca başlar, kararla durur; kalan süre analist ve süpervizör ekranında görünür | ✅ | `StartSla` vaka oluşturulurken, `SlaStoppedAt` kararda; geri sayım [SlaCountdown.tsx] | |
| 4.5-a | Şüpheli işlemde müşteriye uygulama içi doğrulama bildirimi | ✅ | [VerificationRequestsEndpoint.cs] ve `user.notification.requested` → SSE | |
| 4.5-b | Müşteri "ben yaptım" ya da "ben yapmadım" der; yanıt karara girdi olur | ✅ | [VerificationResponsesEndpoint.cs] | |
| 4.5-c | "Ben yapmadım" cevabında işlem BLOK'a yaklaşır, risk skoru yükselir | ✅ | Skor en az 0.91'e çıkar, seviye KRITIK olur, SLA yeniden hesaplanır, geçici blok konur ([VerificationResponsesEndpoint.cs#L71-L85]) | |
| 4.6-a | Vaka KAPANDI olduktan sonra müşteri tek seferlik 1–5 yıldız verir | ✅ | Kapanan vakada müşteri ekranında 1–5 yıldız formu; tarayıcı testi bu adımı yürütür. | Part 6 |
| 4.6-b | Puan verilince Gamification'a event gider | ✅ | `customer.feedback.submitted` ([SubmitFeedbackEndpoint.cs#L77-L86]) | |

## 5. AI Service

| # | Gereksinim | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 5.1-a | Girdi: tutar, tip, konum, cihaz, zaman, geçmiş işlem sıklığı. Çıktı: 0.0–1.0 skor ve karar (ONAY < 0.4, İNCELEME 0.4–0.9, BLOK > 0.9) | ✅ | Özellikler [features.py], eşikler [decision_policy.py]. Saat ve "gece" artık İstanbul saatiyle (UTC+3) hesaplanıyor; test [test_features.py]. | |
| 5.1-b | Skor < 0.40 otomatik ONAY, > 0.90 otomatik geçici BLOK, arası analiste | ✅ | [AiAssessmentCompletedConsumer.cs#L166-L184] | |
| 5.1-c | Yaklaşım: kendi eğitilen klasik ML modeli | ✅ | scikit-learn, deterministik eğitim (seed 20260722) [train.py]; metrikler [metadata.json] | |
| 5.1-d | Kendi veriyle eğitimde veri repoda ve eğitim süreci README'de | ✅ | Eğitim verisi `data/training_data.csv` repoda; `generate_data.py` deterministik üretiyor, test commit'lenen dosyanın üreticiyle birebir aynı olduğunu kontrol ediyor. Image build'i bu dosyadan eğitiyor. Veri, özellikler, metrikler ve sınırlar: [MODEL_CARD.md]. | |
| 5.1-e | Gerçekçi Türkçe şüpheli ve meşru işlem örnekleri, en az ~100 | ✅ | `data/scenarios_tr.csv`: 24 Türkçe şablondan 120 örnek, 5 sınıfın hepsi ([scenarios.py]). Eğitimde kullanılmıyor; model her eğitimde bunlarla ölçülüyor (meşru %100 geçiyor, fraud türü %87 doğru, fraud'un %47'si işaretleniyor; [MODEL_CARD.md]). | |
| 5.2-a | Tür sınıflandırma (5 sınıf) | ✅ | Skor 0.40'ın altındaysa TEMIZ ([transaction_created_consumer.py#L66]) | |
| 5.2-b | Tür analist ekranında görsel olarak gösterilir | ✅ | Vaka detayında risk göstergesi ve tür etiketi ([CaseDetailPage.tsx]) | |
| 5.3-a | Skorlamaya dayalı otomatik atama: uzmanlık × 0.5 + boşluk × 0.3 + performans × 0.2 | ✅ | [assignment.py#L18-L22], [assignment.py#L79-L81] | |
| 5.3-b | Kapasite analist başına 10 aktif vaka; kapasite yoksa vaka kuyruğa alınır | ✅ | AI öneriyor; Transaction kapasiteyi `FOR UPDATE` kilidiyle kesinleştiriyor ([AssignmentService.cs]). Kapasite yoksa `QUEUED` ([AiAssessmentCompletedConsumer.cs#L220-L224]). | Part 2 |
| 5.3-c | Performans: analistin doğru karar oranı | ✅ | Ground truth müşterinin doğrulama cevabı (§4.5): "ben yaptım" denen işlemi bloklamak ve "ben yapmadım" denen işlemi onaylamak yanlış karar; cevap yoksa karar doğru sayılıyor ([PointRuleEngine.cs], [PointRuleEngineTests.cs]). | |
| 5.3-d | Süpervizör her zaman manuel atama yapabilir | ✅ | [ManualAssignmentEndpoint.cs] | |
| 5.4-a | Tür değiştirilirse "yanlış sınıflandırma" olarak kaydedilir | ✅ | 4.3-c; test [test_feedback.py]. | |
| 5.4-b | Süpervizör panelinde AI doğruluk oranı (doğru / toplam × 100) | ✅ | Ground truth: önce müşterinin doğrulama cevabı, yoksa analistin kararı ([feedback.py]). Oranlar yalnızca notlanabilen satırları sayıyor. `demo.py smoke` bloktan sonra kararın AI metriklerine ulaştığını kontrol ediyor. | |
| 5.4-c | Kategori bazlı doğruluk kırılımı | ✅ | `/api/v1/ai/metrics/categories` her tür için precision ve recall dönüyor; süpervizör panelindeki "Model doğruluğu" kartında görünüyor. Test [test_feedback.py], `demo.py smoke`. | |

## 6. Gamification Service

| # | Gereksinim | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 6.0 | Olay tabanlı çalışır, doğrudan çağrı yok | ✅ | Puanı yalnızca consumer'lar yazıyor ([CaseDecisionMadeConsumer.cs]); dışarıya açık "puan ekle" endpoint'i yok | |
| 6.1-a | Her karar +10 | ✅ | [PointRuleEngine.cs]; test [PointRuleEngineTests.cs] | |
| 6.1-b | 15 dakikadan kısa karar +5 | ✅ | [PointRuleEngine.cs]; test [PointRuleEngineTests.cs] | |
| 6.1-c | Gerçek dolandırıcılık yakalandı (müşteri teyitli BLOK) +15 | ✅ | Yalnızca müşteri "ben yapmadım" dediyse veriliyor; cevap `case.decision.made` ile geliyor ([SubmitDecisionEndpoint.cs], [PointRuleEngine.cs]). Teyitsiz tek blok 15 puan. Test [PointRuleEngineTests.cs]; `demo.py smoke` teyitli blokta tam +45 puanı kontrol ediyor. | |
| 6.1-d | KRITIK vaka SLA içinde +15 | ✅ | [PointRuleEngine.cs]; test [PointRuleEngineTests.cs] | |
| 6.1-e | SLA aşımı −5 | ✅ | [CaseSlaBreachedConsumer.cs] → [PointRuleEngine.cs]. Ceza artık günlük/haftalık liderlik puanından da düşüyor. Test [PointRuleEngineTests.cs] | |
| 6.1-f | Yanlış blok (meşru işlem bloklandı) −8 | ✅ | Müşteri "ben yaptım" dediği işlem bloklanırsa karar anında −8 ve yanlış pozitif sayılıyor. 1–5 yıldız memnuniyet puanı (§4.6) artık puan değiştirmiyor ([CustomerFeedbackSubmittedConsumer.cs]). Test [PointRuleEngineTests.cs] | |
| 6.2 | Rozetler: İlk Yakalama, Keskin Göz, Sıfır Hata, Maratoncu, Kriz Yöneticisi, Uzman Avcı | ✅ | Eşikler artık mevcut kararı da sayıyor (önceden kaydedilmemiş satırlar sayılmadığı için her rozet bir karar geç geliyordu). İlk Yakalama ve Uzman Avcı müşteri teyitli bloğa bağlı. Test [PointRuleEngineTests.cs] | |
| 6.3 | Seviyeler: Bronz 0–499, Gümüş 500–1.499, Altın 1.500–2.999, Platin 3.000+ | ✅ | [Gamification/Domain/Enums.cs#L31-L40]; test [LevelThresholdsTests.cs] | |
| 6.4-a | Günlük ve haftalık liderlik tablosu, ilk 10, puana göre | ✅ | [LeaderboardEndpoint.cs] | |
| 6.4-b | Liderlik tablosu gerçek zamanlı ya da sayfa yenilemede güncel | ✅ | SSE ve sorgu yenileme ([useRealtime.ts]) | |
| 6.4-c | Profil: toplam puan, seviye, rozetler, günlük/haftalık sıra, çözülen vaka, ortalama puan | ✅ | Profil sayfası: toplam puan, seviye çubuğu, rozetler, günlük/haftalık sıra, çözülen vaka, vaka başına ortalama puan. | Part 6 |
| 6.4-d | Rozet kazanılınca toast/modal | ✅ | `badge.earned` → toast ([useRealtime.ts#L99]) | Part 6 |

## 7. Süpervizör paneli

| # | Gereksinim | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 7-a | Dolandırıcılık türüne göre dağılım (pasta/bar) | ✅ | "Fraud tipi kırılımı" ([SupervisorDashboardPage.tsx#L192]) | |
| 7-b | Risk seviyesi dağılımı **ve trendi** | ⚠️ | Dağılım var, trend yok. | Part 6 |
| 7-c | SLA uyum oranı ve SLA'sı aşılmış aktif vakalar | ✅ | KPI şeridinde "SLA uyumu" yüzdesi ve "Acil / aşılmış SLA" sayısı; aşılanlar listede en üstte. | Part 6 |
| 7-d | AI doğruluğu: risk kararı isabet oranı, yanlış pozitif oranı | ✅ | Karar uyumu, yanlış pozitif ve tür doğruluğu `prediction_feedback`'ten hesaplanıp panelde gösterilir. | Part 5, 6 |
| 7-e | Analist performansı: karar sayısı, ortalama süre, doğru karar oranı | ⚠️ | Performans endpoint'i var ([GetPerformanceEndpoint.cs]); panelde analist tablosu doğrulanmadı. | Part 6 |
| 7-f | Bekleyen kuyruk: BELIRSIZ ya da kapasite bekleyen vakalar ve manuel atama | ✅ | Kuyruk varsayılan olarak BELIRSIZ ve kapasite bekleyen vakaları birlikte gösterir; vaka detayından manuel atama. | Part 6 |

## 8. API tasarımı

| # | Gereksinim | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 8-a | Gateway routing: `/auth`, `/transactions`, `/ai`, `/game` | ✅ | [Edge/appsettings.json#L21-L75] | |
| 8-b | Örnek endpoint'ler: `POST /transactions`, `POST /ai/score`, `GET /game/leaderboard?period=daily`, `PATCH /cases/:id/decision` | ⚠️ | `POST /ai/score` yok: skorlama `transaction.created` event'iyle tetikleniyor. Bilinçli bir tasarım kararı ama belgelenmemiş. Diğerleri var. | Part 7 |
| 8-c | Standart yanıt formatı `{ success, data, error }` | ⚠️ | .NET servisleri uyuyor ([ApiResponse.cs]). AI servisi başarılı yanıtlarda zarf kullanıyor, ama FastAPI hataları `{"detail": ...}` olarak dönüyor. | Part 5 |
| 8-d | Swagger/OpenAPI | ✅ | .NET servislerinde OpenAPI + Scalar, FastAPI'de `/docs`; snapshot'lar [BACKEND/contracts/openapi/] | Part 7 |

## 9. Servisler arası event akışı

| # | Gereksinim | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 9-a | Olay tabanlı tasarım; örnek `transaction.blocked` akışı | ✅ | `case.decision.made` → Gamification puan ve rozet → `badge.earned` → SSE → toast. Event adı farklı. | |
| 9-b | Diğer event'ler: işlem oluşturuldu, tür değiştirildi, müşteri doğruladı, SLA aşıldı | ✅ | `transaction.created`, `case.fraud_type.overridden`, `customer.verification.responded`, `case.sla.breached` | |
| 9-c | EVENTS.md: tüm event'ler ve payload'ları | ✅ | [BACKEND/EVENTS.md]: bütün olaylar, temel payload'lar ve `case.decision.made` örneği (`customerVerification` dahil). | Part 7 |

## 10. Güvenlik (jürinin canlı testi)

| # | Senaryo | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 10-a | SQL injection | ✅ | EF Core sorguları parametreli; ham SQL'ler `FromSql` / `ExecuteSqlAsync` ile parametreleniyor. Test: `scripts/security.py` (CI demo-e2e), login, OTP ve liste filtrelerine `' OR 1=1 --`: 400/401 ya da boş sonuç, hiç 5xx yok. | |
| 10-b | Müşteri token'ıyla süpervizör endpoint'i | ✅ | .NET servisleri ve AI servisi rolü ve token'ı kendileri doğruluyor (AI: [security.py], JWKS, RS256, issuer/audience); gateway de token istiyor. Test: `scripts/security.py`, 9 endpoint × 4 rol + token'sız; AI için [test_security.py]. | |
| 10-c | IDOR (kayıt ID'si değiştirerek başkasının verisi) | ✅ | Başka müşterinin işlemi, vakası, doğrulaması 404; atanmamış analist işlemi, vakayı göremiyor ve karar veremiyor (404); başkasının oyun profili ve performansı 403. Test: `scripts/security.py` (CI demo-e2e). | |
| 10-d | Süresi dolmuş ya da değiştirilmiş JWT | ✅ | RS256, issuer, audience ve süre doğrulaması. Test: [JwtValidationTests.cs] (süresi dolmuş, yanlış issuer/audience, başka anahtar, alg=none, HS256, değiştirilmiş rol) ve `scripts/security.py` (CI demo-e2e) (gateway'de değiştirilmiş rol, alg=none, kesilmiş imza 401). | |
| 10-e | İptal edilmiş refresh token'ın yeniden kullanımı | ✅ | 3.2-c | |
| 10-f | XSS | ✅ | API metni JSON olarak saklıyor ve döndürüyor (`nosniff`); React çıktıyı escape ediyor; CSP `script-src 'self'`. Test: `scripts/security.py` (CI demo-e2e), script'li alan JSON'da düz metin, CSP başlığı var, frontend'de `dangerouslySetInnerHTML`/`innerHTML`/`eval` yok. | |
| 10-g | Brute-force (ardışık hızlı giriş, rate limit) | ✅ | Gateway'de personel girişi ve OTP için adres ve endpoint başına dakikada 30 istek ([Edge/Program.cs]); personel hesabı 5 hatada kilitleniyor; OTP 5 yanlış kodda kapanıyor. Test: `scripts/security.py` (CI demo-e2e), 40 hızlı deneme 429 alıyor. | |

## 11. Kullanıcı akışları ve zorunlu demo

| # | Adım | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 11.1 | Müşteri akışı: GSM + OTP → işlem → AI analizi → doğrulama → takip → 1–5 yıldız | ✅ | Uçtan uca: OTP → işlem → AI → doğrulama → takip → 1–5 yıldız; `roles.spec.ts` CI'da yürütür. | Part 6 |
| 11.2 | Analist akışı: panel → atanan vakalar risk sıralı → AI skoru ve tür → müşteri doğrulaması → karar ve not → puan ve rozet | ✅ | Atanan vakalar en riskli ve SLA'sı aşılan önce; karar paneli, müşteri doğrulaması, not, puan ve rozet toast'ı. | Part 3, 6 |
| 11.3-1 | `docker compose up` ile tüm sistem ayağa kalkar | ✅ | 2.2-d | |
| 11.3-2 | Müşteri olarak gece, yurt dışından, yüksek tutarlı işlem | ✅ | canlı | |
| 11.3-3 | AI risk skoru, türü ve kararı gösterilir | ✅ | canlı: 0.71 / YUKSEK / CALINTI_KART / İNCELEME | |
| 11.3-4 | Vaka doğru uzmanlıktaki analiste atanır | ✅ | `demo-seed` her uzmanlık için bir analist açıyor; `scripts/demo.py smoke` vakanın AI'ın bulduğu türün uzmanına atandığını assert ediyor. | |
| 11.3-5 | Analist vakayı inceler ve blok kararı verir | ✅ | canlı | |
| 11.3-6 | Puan liderlik tablosuna yansır | ✅ | Puan müşteri cevabına göre (+15 yalnızca doğrulanmış dolandırıcılık); rozet ilk doğru blokta. | Part 3 |
| 11.3-7 | Bir servis `docker stop` ile kapatılır, geri kalanı çalışır | ✅ | `demo.py resilience` RabbitMQ dahil her container'ı sırayla durdurur ve sistemin toparlandığını CI'da doğrular. | Part 2 |
| 11.3-8 | Jürinin güvenlik testlerine hazır olmak | ✅ | §10 senaryolarının hepsi `scripts/security.py` (CI demo-e2e) ile her PR'da koşuyor (`make security`). | |

## 12. Değerlendirme kriterleri ve bonus

| # | Kriter | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 12-a | Unit ve integration testleri | ✅ | 51 .NET (Testcontainers ile outbox/inbox, puan kuralları, refresh), 49 Python, 11 Vitest, 2 Playwright testi; 47 demo ve 96 güvenlik kontrolü. | Part 2–6 |
| 12-b | Anlamlı commit geçmişi | ✅ | Hackathon hâli tag'de; sonrası part başına PR, Conventional Commits, yeşil CI ile merge. | Her part |
| B-1 | Kendi eğitilen ML modeli, veri ve süreç dokümante (+8) | ✅ | Eğitim verisi, 120 Türkçe senaryo ve model kartı repoda. | Part 5 |
| B-2 | Message queue ile event iletimi (+5) | ✅ | RabbitMQ (2.2-b) | |
| B-3 | Panelde kategori bazlı AI doğruluk kırılımı (+3) | ✅ | Panelde türe göre isabet ve yakalama oranı. | Part 5, 6 |
| B-4 | Gerçek zamanlı bildirim, WebSocket/SSE (+2) | ✅ | SSE, kısa ömürlü tek kullanımlık ticket ile ([RealtimeEndpoints.cs]) | Part 2 |
| B-5 | CI/CD pipeline (+2) | ✅ | [ci.yml]: .NET build + test, AI lint/typecheck/test, frontend test/typecheck/build, compose doğrulaması. Part 0'da düzeltildi: CA1873 hataları `LoggerMessage` ile giderildi, npm lock yenilendi, SDK `global.json`'dan ve Node `.nvmrc`'den okunuyor. | Part 1 (compose E2E job'u) |

## 13. Diskalifiye koşulları

| # | Koşul | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 13.2-a | Monolith değil | ✅ | 5 ayrı deploy edilen servis | |
| 13.2-b | `docker compose up` ile sistem ayağa kalkar | ✅ | 2.2-d | |
| 13.2-c | AI servisi mock ya da sabit çıktılı değil | ✅ | Eğitilmiş model ve özellik çıkarımı; farklı girdiler farklı skor üretiyor. Bunu kanıtlayan test yok. | Part 5 |
| 13.2-d | Servisler tek/ortak veritabanı paylaşmaz | ✅ | 2.2-a | Part 2 |
| 13.2-e | Proje build edilebilir | ✅ | SDK 10.0.403 ile `dotnet build` 0 uyarıyla geçiyor; CI ve Dockerfile'lar aynı sürüme sabit. | |

## 14. Teslimat

| # | Gereksinim | Durum | Kanıt | Plan |
|---|---|:---:|---|---|
| 14.1-a | Public ya da davetli GitHub repo | ✅ | github.com/mrfiratatalay/FraudCell | |
| 14.1-b | Ana branch'te çalışır kod, anlamlı commit geçmişi | ✅ | 2.2-d, 12-b | Part 1 |
| 14.1-c | **Kök dizinde** `docker-compose.yml` (servisler, veritabanları, gateway) | ✅ | Kök dizindeki `docker-compose.yml`, `BACKEND/docker-compose.yml`'ı `include` eder; `docker compose up` kökten çalışır. | Part 7 |
| 14.1-d | Servis başına `.env.example` | ✅ | Her servis klasöründe `.env.example`; ortak sırlar [BACKEND/.env.example]'da. | Part 7 |
| 14.2-a | Ana README: genel bakış, mimari diyagram, kurulum (`docker compose up` + seed), demo kullanıcıları | ✅ | [README.md]: her işletim sistemi için kurulum, otomatik seed, 7 demo kullanıcısı. | Part 7 |
| 14.2-b | Servis başına README | ✅ | 2.2-e | Part 7 |
| 14.2-c | EVENTS.md | ✅ | 9-c | Part 7 |
| 14.2-d | AI yaklaşım dokümanı (yöntem, gerekçe, çalışma şekli, eğitim verisi ve süreç) | ✅ | [MODEL_CARD.md]: veri, özellikler, eşikler, offline ve canlı metrikler, sınırlar. Eğitim verisi repoda. | |
| 14.2-e | Swagger/OpenAPI (en az Transaction ve AI) | ✅ | 8-d | |

## Planda olmayan, bu denetimde bulunan sorunlar

Hackathon sonrası ilk planda yer almayan, kod okunurken çıkan bulgular. Her biri ilgili part'ta önce
başarısız bir testle gösterilip sonra düzeltilecek.

1. ~~`/api/v1/ai/**` herkese açık; AI servisi token'ı kendisi doğrulamıyor.~~ Part 4'te gateway'de, Part 5'te AI servisinin kendisinde kapatıldı.
2. ~~`prediction_feedback` tablosuna hiçbir kod yazmıyor.~~ Part 5'te düzeltildi.
3. ~~Rozet koşulları henüz kaydedilmemiş satırları sayıyor.~~ Part 3'te düzeltildi.
4. ~~"Gece" özelliği UTC saatine göre hesaplanıyor.~~ Part 5'te düzeltildi: İstanbul saati.
5. ~~Analist, kendisine atanmamış işlemin detayını okuyabiliyor.~~ Part 4'te düzeltildi.
6. ~~Refresh token yeniden kullanıldığında yalnızca o token ailesi iptal ediliyor.~~ Part 4'te düzeltildi: kullanıcının tüm oturumları iptal ediliyor.
7. ~~Müşterinin 1–5 yıldız vereceği ekran yok.~~ Part 6'da eklendi.
8. Personel oluşturma tek bir transaction değil: kullanıcı ve profil ayrı `SaveChanges` çağrılarında; profil adımı hata verirse profilsiz kullanıcı kalıyor ([CreateStaffEndpoint.cs]). (Part 3)
9. ~~CI tag push'larında da çalışıyor.~~ Part 0'da düzeltildi: CI yalnızca main ve PR'larda çalışıyor.

<!-- Bağlantılar -->
[case PDF]: ../BACKEND/references/CodeNight_FINAL_FraudCell_Case.pdf
[docker-compose.yml]: ../BACKEND/docker-compose.yml
[init-multiple-databases.sh]: ../BACKEND/docker/postgres/init-multiple-databases.sh
[BACKEND/.gitignore#L30-L31]: ../BACKEND/.gitignore#L30-L31
[BACKEND/.env.example]: ../BACKEND/.env.example
[BACKEND/EVENTS.md]: ../BACKEND/EVENTS.md
[BACKEND/contracts/openapi/]: ../BACKEND/contracts/openapi
[README.md]: ../README.md
[ci.yml]: ../.github/workflows/ci.yml

[RabbitMqTopology.cs]: ../BACKEND/src/BuildingBlocks/FraudCell.BuildingBlocks/Messaging/RabbitMq/RabbitMqTopology.cs
[OutboxPublisherService.cs]: ../BACKEND/src/BuildingBlocks/FraudCell.BuildingBlocks/Messaging/Outbox/OutboxPublisherService.cs
[ApiResponse.cs]: ../BACKEND/src/BuildingBlocks/FraudCell.BuildingBlocks/Api/ApiResponse.cs

[Edge/Program.cs#L73-L90]: ../BACKEND/src/Services/Edge/FraudCell.Edge.Gateway/Program.cs#L73-L90
[Edge/Program.cs#L149-L170]: ../BACKEND/src/Services/Edge/FraudCell.Edge.Gateway/Program.cs#L149-L170
[Edge/appsettings.json#L21-L75]: ../BACKEND/src/Services/Edge/FraudCell.Edge.Gateway/appsettings.json#L21-L75
[RealtimeEndpoints.cs]: ../BACKEND/src/Services/Notification/FraudCell.Notification.Service/Realtime/RealtimeEndpoints.cs

[Identity/Program.cs#L68-L73]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Program.cs#L68-L73
[Identity/Program.cs#L75-L78]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Program.cs#L75-L78
[Identity/Program.cs#L88]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Program.cs#L88
[Identity/appsettings.json#L16-L17]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/appsettings.json#L16-L17
[OtpService.cs]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/OtpService.cs
[VerifyOtpChallengeEndpoint.cs]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Features/Auth/CustomerOtp/VerifyOtpChallengeEndpoint.cs
[CreateStaffEndpoint.cs]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Features/Staff/CreateStaff/CreateStaffEndpoint.cs
[CreateStaffEndpoint.cs#L37]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Features/Staff/CreateStaff/CreateStaffEndpoint.cs#L37
[CreateStaffEndpoint.cs#L91-L98]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Features/Staff/CreateStaff/CreateStaffEndpoint.cs#L91-L98
[Argon2idPasswordHasher.cs]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/Argon2idPasswordHasher.cs
[StaffLoginEndpoint.cs#L69-L82]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Features/Auth/StaffLogin/StaffLoginEndpoint.cs#L69-L82
[JwtTokenService.cs#L38-L39]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/JwtTokenService.cs#L38-L39
[RefreshTokenService.cs]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/RefreshTokenService.cs
[LogoutEndpoint.cs]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Features/Auth/Logout/LogoutEndpoint.cs
[GetAuditLogsEndpoint.cs]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Features/Audit/GetAuditLogs/GetAuditLogsEndpoint.cs
[AuditWriter.cs]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Common/AuditWriter.cs
[AuditEntryRequestedConsumer.cs]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Messaging/AuditEntryRequestedConsumer.cs
[AuditLog.cs]: ../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Domain/AuditLog.cs

[CreateTransactionEndpoint.cs#L20-L27]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Transactions/CreateTransaction/CreateTransactionEndpoint.cs#L20-L27
[CreateTransactionEndpoint.cs#L60]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Transactions/CreateTransaction/CreateTransactionEndpoint.cs#L60
[GetCaseEndpoint.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/GetCase/GetCaseEndpoint.cs
[GetTransactionEndpoint.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Transactions/GetTransaction/GetTransactionEndpoint.cs
[ListCasesEndpoints.cs#L99]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/ListCases/ListCasesEndpoints.cs#L99
[ManualAssignmentEndpoint.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/Assignment/ManualAssignmentEndpoint.cs
[ReassignmentEndpoint.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/Reassignment/ReassignmentEndpoint.cs
[FraudTypeOverrideEndpoint.cs#L27]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/FraudTypeOverride/FraudTypeOverrideEndpoint.cs#L27
[RiskLevelOverrideEndpoint.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/RiskLevelOverride/RiskLevelOverrideEndpoint.cs
[VerificationRequestsEndpoint.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/VerificationRequests/VerificationRequestsEndpoint.cs
[VerificationResponsesEndpoint.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/VerificationResponses/VerificationResponsesEndpoint.cs
[VerificationResponsesEndpoint.cs#L71-L85]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/VerificationResponses/VerificationResponsesEndpoint.cs#L71-L85
[SubmitFeedbackEndpoint.cs#L52-L61]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/Feedback/SubmitFeedbackEndpoint.cs#L52-L61
[SubmitFeedbackEndpoint.cs#L77-L86]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/Feedback/SubmitFeedbackEndpoint.cs#L77-L86
[RiskThresholds.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Domain/RiskThresholds.cs
[RiskCase.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Domain/RiskCase.cs
[RiskCase.cs#L63-L69]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Domain/RiskCase.cs#L63-L69
[Transaction.cs#L145]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Domain/Transaction.cs#L145
[Transaction/Domain/Enums.cs#L13-L20]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Domain/Enums.cs#L13-L20
[TransactionNumberGenerator.cs#L46]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Common/TransactionNumberGenerator.cs#L46
[AssignmentService.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Common/AssignmentService.cs
[ManualFallbackCaseCreator.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Common/ManualFallbackCaseCreator.cs
[AssessmentWatchdogWorker.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/BackgroundJobs/AssessmentWatchdogWorker.cs
[CaseClosureWorker.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/BackgroundJobs/CaseClosureWorker.cs
[SlaBreachWorker.cs#L67-L86]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/BackgroundJobs/SlaBreachWorker.cs#L67-L86
[AiAssessmentCompletedConsumer.cs#L166-L184]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Messaging/AiAssessmentCompletedConsumer.cs#L166-L184
[AiAssessmentCompletedConsumer.cs#L220-L224]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Messaging/AiAssessmentCompletedConsumer.cs#L220-L224
[RiskCaseStateMachineTests.cs]: ../BACKEND/tests/FraudCell.Transaction.Service.Tests/RiskCaseStateMachineTests.cs

[CaseDecisionMadeConsumer.cs]: ../BACKEND/src/Services/Gamification/FraudCell.Gamification.Service/Messaging/CaseDecisionMadeConsumer.cs
[CaseSlaBreachedConsumer.cs]: ../BACKEND/src/Services/Gamification/FraudCell.Gamification.Service/Messaging/CaseSlaBreachedConsumer.cs
[PointRuleEngine.cs]: ../BACKEND/src/Services/Gamification/FraudCell.Gamification.Service/Common/PointRuleEngine.cs
[PointRuleEngineTests.cs]: ../BACKEND/tests/FraudCell.Gamification.Service.Tests/PointRuleEngineTests.cs
[LevelThresholdsTests.cs]: ../BACKEND/tests/FraudCell.Gamification.Service.Tests/LevelThresholdsTests.cs
[SubmitDecisionEndpoint.cs]: ../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Features/Cases/Decision/SubmitDecisionEndpoint.cs
[CustomerFeedbackSubmittedConsumer.cs]: ../BACKEND/src/Services/Gamification/FraudCell.Gamification.Service/Messaging/CustomerFeedbackSubmittedConsumer.cs
[Gamification/Domain/Enums.cs#L31-L40]: ../BACKEND/src/Services/Gamification/FraudCell.Gamification.Service/Domain/Enums.cs#L31-L40
[LeaderboardEndpoint.cs]: ../BACKEND/src/Services/Gamification/FraudCell.Gamification.Service/Features/Leaderboard/LeaderboardEndpoint.cs
[ProfilesEndpoints.cs]: ../BACKEND/src/Services/Gamification/FraudCell.Gamification.Service/Features/Profiles/ProfilesEndpoints.cs
[GetPerformanceEndpoint.cs]: ../BACKEND/src/Services/Gamification/FraudCell.Gamification.Service/Features/Performance/GetPerformanceEndpoint.cs

[features.py]: ../BACKEND/src/Ai/fraudcell-ai/app/ml/features.py
[decision_policy.py]: ../BACKEND/src/Ai/fraudcell-ai/app/ml/decision_policy.py
[train.py]: ../BACKEND/src/Ai/fraudcell-ai/train.py
[metadata.json]: ../BACKEND/src/Ai/fraudcell-ai/models/metadata.json
[transaction_created_consumer.py#L66]: ../BACKEND/src/Ai/fraudcell-ai/app/messaging/transaction_created_consumer.py#L66
[assignment.py#L18-L22]: ../BACKEND/src/Ai/fraudcell-ai/app/ml/assignment.py#L18-L22
[assignment.py#L79-L81]: ../BACKEND/src/Ai/fraudcell-ai/app/ml/assignment.py#L79-L81

[SlaCountdown.tsx]: ../FRONTEND/app/src/shared/ui/SlaCountdown.tsx
[CaseDetailPage.tsx]: ../FRONTEND/app/src/routes/analyst/CaseDetailPage.tsx
[useRealtime.ts]: ../FRONTEND/app/src/features/realtime/useRealtime.ts
[useRealtime.ts#L99]: ../FRONTEND/app/src/features/realtime/useRealtime.ts#L99
[SupervisorDashboardPage.tsx#L192]: ../FRONTEND/app/src/routes/supervisor/SupervisorDashboardPage.tsx#L192
[AnalystPointsPage.tsx]: ../FRONTEND/app/src/routes/analyst/AnalystPointsPage.tsx
[AssignmentQueuePage.tsx]: ../FRONTEND/app/src/routes/supervisor/AssignmentQueuePage.tsx
[RefreshTokenServiceTests.cs]: ../BACKEND/tests/FraudCell.Identity.Service.Tests/RefreshTokenServiceTests.cs
[Edge/Program.cs]: ../BACKEND/src/Services/Edge/FraudCell.Edge.Gateway/Program.cs
[AuthorizationDeniedAuditMiddleware.cs]: ../BACKEND/src/BuildingBlocks/FraudCell.BuildingBlocks/Security/AuthorizationDeniedAuditMiddleware.cs
[JwtValidationTests.cs]: ../BACKEND/tests/FraudCell.BuildingBlocks.Tests/JwtValidationTests.cs
[MODEL_CARD.md]: ../BACKEND/src/Ai/fraudcell-ai/MODEL_CARD.md
[security.py]: ../BACKEND/src/Ai/fraudcell-ai/app/security.py
[feedback_consumers.py]: ../BACKEND/src/Ai/fraudcell-ai/app/messaging/feedback_consumers.py
[feedback.py]: ../BACKEND/src/Ai/fraudcell-ai/app/ml/feedback.py
[scenarios.py]: ../BACKEND/src/Ai/fraudcell-ai/app/ml/scenarios.py
[test_features.py]: ../BACKEND/src/Ai/fraudcell-ai/tests/test_features.py
[test_feedback.py]: ../BACKEND/src/Ai/fraudcell-ai/tests/test_feedback.py
[test_security.py]: ../BACKEND/src/Ai/fraudcell-ai/tests/test_security.py
