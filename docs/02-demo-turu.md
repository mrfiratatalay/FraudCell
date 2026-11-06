# 02. Demo turu (5 dakika)

Bu tur teknik bilgi istemez. [Canlı demoyu](https://fraud-cell.vercel.app) açın; giriş ekranında dört rol kartı var, her biri tek tıkla ve şifresiz
giriş yapar. Sağ alttaki **Demoyu sıfırla** düğmesi her şeyi başa döndürür.

## Dört rol, tek hikâye

Demo, gerçek sistemin bir gününü taklit eder: birkaç saat önce açılmış vakalar, SLA'sı aşılmış bir vaka,
müşteriden cevap bekleyen bir vaka ve kapanmış, puanlanmış vakalar. Tarihler her açılışta bugüne göre hesaplanır.

### 1. Müşteri: Ahmet Yılmaz

1. Ana sayfada sarı bir uyarı görürsünüz: "Bir işlem senin onayını bekliyor". Londra'dan 18.750 TL'lik bir transfer.
2. **Yanıtla** → **Ben yapmadım** → **Yanıtı gönder**. İşlem güvenlik için beklemeye alınır.
3. **İşlemler** sekmesinde her işlemin sonucu yazar: Tamamlandı, İncelemede, Onaylandı ya da Engellendi.
4. Engellenen 42.000 TL'lik işlemi açın. Dekontun yanında işlem süreci görünür: alındı → skorlandı → analist
   inceledi → engellendi. Altta 1–5 yıldızla süreci değerlendirebilirsiniz.
5. **Yeni işlem** ile yurt dışına yüksek tutarlı bir transfer deneyin. Skoru yükselir ve bir analiste düşer.

### 2. Analist: Deniz Kaya (Çalıntı Kart uzmanı)

1. **Vakalarım** tablosunda en riskli ve en acil vaka en üsttedir. SLA sütunu canlı geri sayar.
2. New York'tan 50.000 TL'lik kritik vakayı açın. Risk skoru 0,40 ve 0,90 eşik çizgileriyle gösterilir; yanında yapay
   zekânın gerekçesi ("ilk kez görülen cihaz, normal tutarın 10 katı…") yazar.
3. Sağdaki karar paneli her adımda tek bir sonraki işi gösterir: **İncelemeyi başlat** → **Müşteriden doğrulama iste**
   ya da not yazıp **Onayla / Blokla**.
4. **Profilim** sayfasında puan hareketleri, seviye çubuğu ve rozetler vardır. Müşterinin doğruladığı bir dolandırıcılığı
   bloklamak "İlk Yakalama" rozetini getirir.

### 3. Süpervizör: Murat Demir

1. **Panel** "Müdahale bekleyenler" ile açılır: SLA'sı aşılanlar en üstte.
2. Üstteki şeritte açık vaka, acil SLA, SLA uyumu, kritik risk ve AI–analist uyumu sayıları vardır. Bu sayılar demo
   verisinden hesaplanır, elle yazılmaz.
3. **Atama Kuyruğu**: Yapay zekânın türünü belirleyemediği (Belirsiz) ve uygun analist bekleyen vakalar. Birini açıp
   **Analist ata** ile atayın; gerekçe zorunludur.
4. Vaka detayında AI sonucunu düzeltebilirsiniz: **Risk seviyesini değiştir**, **Risk tipini değiştir**.
5. **Liderlik**: günlük ve haftalık sıralama.

### 4. Yönetici: Selin Aydın

1. **Personel**: Rol, uzmanlık, bölge ve "atamaya açık" durumu. **Personel ekle** ile yeni analist oluşturun; ardından
   süpervizör olarak ona vaka atayabilirsiniz.
2. **Denetim**: Girişler, atamalar, kararlar ve reddedilen erişimler (403) kayıtlıdır.

## Demo ile gerçek sistemin farkı

| Konu | Canlı demo | Gerçek sistem (`docker compose up`) |
|---|---|---|
| Sunucu | Yok; istekleri tarayıcıdaki Mock Service Worker karşılar | 6 servis, 4 Postgres, RabbitMQ |
| Veri | Bu tarayıcıda (localStorage) saklanır | Her servisin kendi veritabanı |
| Yapay zekâ | Basit bir kural seti skoru taklit eder | Eğitilmiş scikit-learn modelleri |
| Gerçek zamanlı bildirim | Yok (rozet toast'ı görünmez) | SSE ile anında |
| Vaka kapanışı | Karardan 20 sn sonra | 48 saat sonra (ayarlanabilir) |
| Ekran kodu | Aynı | Aynı |

Demo, gerçek API ile aynı sözleşmeyi taşıma katmanında karşılar; ekran kodu iki modda da aynıdır. Canlı derlemede demo
kodu pakete hiç girmez. Ayrıntısı: [08 Arayüz ve tasarım](08-arayuz-ve-tasarim.md#demo-modu).
