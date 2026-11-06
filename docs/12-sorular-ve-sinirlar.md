# 12. Sorular ve sınırlar

## Olası mülakat soruları

**Neden mikroservis? Bu ölçekte monolit yetmez miydi?**
Vaka, AI düşse de ödeme akışının sürmesini ve bileşenlerin bağımsız düşüp kalkabilmesini istiyordu. Monolitte AI'ın
yavaşlığı ödeme akışını da etkilerdi. Bedelini biliyorum: dağıtık hata ayıklama ve eventual consistency. Bunu
outbox/inbox ve CI'daki dayanıklılık testiyle yönettim.

**Outbox olmadan ne olurdu?**
Veriyi kaydedip olayı gönderemediğimiz an iki servis birbirinden kopardı: işlem var ama AI hiç duymamış olurdu. Olay
iş verisiyle aynı DB işleminde yazıldığı için ya ikisi birden olur ya hiçbiri.

**Aynı olay iki kez gelirse?**
RabbitMQ en az bir kez teslim eder. Her tüketici olay kimliğini `inbox_messages` tablosuna yazar ve tekrarı atlar.
Puan defterinde ayrıca olay ve kural bazında bir tekillik kuralı var.

**İki analist aynı vakaya aynı anda karar verirse?**
Vaka zaten tek bir analiste atanmış oluyor (filtreli unique index). Aynı kişinin iki sekmesi için ETag/If-Match var:
ikinci yazma 412 alır.

**Yapay zekâ ne kadar iyi?**
Test setinde 0,40 eşiğinde precision 0,72, recall 0,52. Yani yanlış alarm az, ama dolandırıcılıkların yaklaşık
yarısı modelden kaçıyor. Kalan yarıyı yakalamak için eşik düşürülebilir; bedeli analist yükünün artması. Gerçek veriyle
yeniden eğitim ilk iş olurdu.

**Neden LLM ile skorlama yapmadın?**
Skor açıklanabilir, tekrarlanabilir ve hızlı olmalı. LLM yalnızca açıklama paragrafını yazar; skor ve karar
scikit-learn modellerinden gelir. LLM anahtarı yoksa sistem aynı şekilde çalışır.

**Ground truth nedir?**
Müşterinin "ben yaptım / ben yapmadım" cevabı. Hem analist puanı hem modelin doğruluk metrikleri buna göre hesaplanır.
Cevapsız vakalar metriğe girmez.

**Güvenliği nasıl test ettin?**
Jürinin listesindeki her saldırıyı [security.py](../scripts/security.py) ile otomatikleştirdim (96 kontrol). Her PR'da
gerçek sisteme karşı çalışır.

**Bu projede senin payın ne?**
Hackathon gecesi iki kişiydik; kaptan bendim. Gecede Ayşe mimari dokümanları, Identity/Transaction servislerinin ilk
hâlini ve frontend temelini kurdu. Ben entegrasyonu, AI kapalıyken çalışan akışı, demo akışlarını ve arayüzü yaptım.
Etkinlikten sonraki Part 0–6 tamamlamasını tek başıma yaptım. Kodun önemli bir kısmını yapay zekâyla (Claude Code)
birlikte, kendi koyduğum kurallar altında yazdım. Her değişikliği okudum, testle doğruladım ve küçük PR'larla birleştirdim.

**Yapay zekâyla yazılan kodu nasıl sahiplendin?**
Kuralları ben koydum: tek komutla açılış, her iş kuralı için önce kırmızı test, yeşil CI olmadan merge yok. Her PR'ın
açıklamasını ben yazdım ve bu dokümanlardaki her sayıyı koddan doğruladım.

## Bilinen sınırlar

| Sınır | Etkisi | Ne yapardım |
|---|---|---|
| Model recall'u 0,52 | Dolandırıcılıkların yaklaşık yarısı vakaya dönmüyor | Eşik ayarı, gerçek veriyle yeniden eğitim, Şüpheli Davranış için ek özellikler |
| Eğitim verisi sentetik | Gerçek dünyadaki dağılımı bilmiyoruz | Gerçek, anonimleştirilmiş veri |
| OTP sınırı yalnızca IP başına | Aynı numaraya farklı IP'lerden deneme sınırsız | GSM başına sayaç |
| Personel oluşturma tek DB işleminde değil | Kullanıcı oluşup profil oluşmayabilir | Tek transaction ya da outbox ile telafi |
| Gerçek SMS yok | OTP ekranda gösteriliyor | SMS sağlayıcısı entegrasyonu |
| HTTPS yok | Yerelde HTTP | Ters vekil ya da bulut yük dengeleyici |
| Tek makine (Compose) | Yatay ölçek yok | Servisler zaten ayrı; Kubernetes'e geçiş kod değiştirmez |
| Canlı demoda SSE ve gerçek model yok | Demo, kuralları taklit eder | Bilinçli tercih (bkz. [09](09-yayin-stratejisi.md)) |

## Yol haritası

1. GSM başına OTP sınırı ve personel oluşturmanın tek işlemde yapılması.
2. Modelin eşik ayarı ve Şüpheli Davranış türü için yeni özellikler.
3. OpenTelemetry ile servisler arası izleme (bugün `traceId` ve `correlationId` loglarda var).
4. Gerçek sistemin çalıştığı 2 dakikalık video.
