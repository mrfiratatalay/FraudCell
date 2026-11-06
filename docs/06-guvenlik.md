# 06. Güvenlik

## Kimlik

| Konu | Karar | Kod |
|---|---|---|
| Müşteri girişi | Telefon + 4 haneli tek kullanımlık kod (OTP). Demo ortamında kod `1234` ve ekranda yazar | [OtpService.cs](../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/OtpService.cs) |
| Personel girişi | E-posta + şifre; 5 hatalı denemede hesap 15 dakika kilitlenir | [StaffLoginEndpoint.cs](../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Features/Auth/StaffLogin/StaffLoginEndpoint.cs) |
| Şifre saklama | Argon2id (varsayılan PBKDF2 yerine) | [Argon2idPasswordHasher.cs](../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/Argon2idPasswordHasher.cs) |
| Access token | RS256 imzalı JWT, 15 dakika; yalnızca bellekte tutulur, localStorage'a yazılmaz | |
| Refresh token | 7 gün, HttpOnly cookie, her kullanımda yenilenir (rotation) | [RefreshTokenService.cs](../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/RefreshTokenService.cs) |
| Çalınan refresh token | Eski bir token tekrar kullanılırsa kullanıcının **bütün** oturumları kapatılır | aynı dosya |
| Anahtar paylaşımı | Identity public key'i JWKS olarak yayınlar; diğer servisler token'ı onunla doğrular | [JwksEndpoints.cs](../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/JwksEndpoints.cs) |

**Neden JWKS?** Hackathon sürümünde imza anahtarı ortak bir dosya volume'üyle bütün servislere dağıtılıyordu. Bu hem
private key'in gereğinden fazla yere gitmesi hem de anahtar değişiminin zorlaşması demekti. Şimdi private key yalnızca
Identity'de duruyor; diğer servisler public key'i JWKS'ten çekiyor.

## Yetki

- Gateway kaba kontrolü yapar: token geçerli mi, rota için rol yeterli mi.
- Her servis ince kontrolü kendisi yapar: "bu vaka bu analiste mi atanmış?", "bu işlem bu müşterinin mi?".
- Arayüzdeki rol menüleri yalnızca görüntüdür, güvenlik değildir. Gerçek kontrol backend'dedir.

| Rol | Görebildikleri |
|---|---|
| Müşteri | Yalnızca kendi işlemleri, doğrulamaları ve oturumları |
| Analist | Yalnızca kendisine atanmış vakalar ve o vakaların işlemleri |
| Süpervizör | Bütün vakalar, kuyruk, atama, AI düzeltmesi, panel, liderlik |
| Yönetici | Süpervizörün gördükleri + personel yönetimi + denetim kayıtları |

## Denetim (audit)

- Giriş, kilitlenme, personel değişikliği, atama ve karar `audit_logs` tablosuna yazılır.
- Reddedilen her istek (403) de kaydedilir. Bunu her servis kendi outbox'ı üzerinden yapar
  ([AuthorizationDeniedAuditMiddleware.cs](../BACKEND/src/BuildingBlocks/FraudCell.BuildingBlocks/Security/AuthorizationDeniedAuditMiddleware.cs)),
  böylece kayıt yolda kaybolmaz.

## Jüri listesi bir betik oldu

Vaka dokümanı jürinin deneyeceği saldırıları sayıyordu. Hepsini [scripts/security.py](../scripts/security.py)
betiğine yazdım; CI'da her PR'da gerçek sisteme karşı **96 kontrol** çalışır:

| Deneme | Beklenen |
|---|---|
| Token'sız istek | 401 |
| Yanlış rolle istek (rol matrisi) | 403 |
| Başka müşterinin işlemi, başka analistin vakası (IDOR) | 403 ya da 404 |
| İmzası bozulmuş, rolü değiştirilmiş ya da süresi dolmuş JWT | 401 |
| SQL injection girişleri | 400 / 401, veri sızmaz |
| XSS içeren not ve isimler | Kaçışlanmış olarak döner |
| Kaba kuvvet (brute force) | Kilitlenme ve hız sınırı |
| OTP deneme sınırı | Bloklanır |
| Kullanılmış refresh token | Bütün oturumlar kapanır |

## Hız sınırı ve başlıklar

- Gateway, personel girişine ve OTP uçlarına IP ve yol başına dakikada 30 istek sınırı koyar.
- Her cevapta `Content-Security-Policy` (yalnızca `script-src 'self'`), `X-Frame-Options: DENY`, `nosniff` ve
  `Referrer-Policy: no-referrer` vardır. Satır içi script'e izin olmadığı için tema dosyası bile ayrı bir dosyadan yüklenir.

## Hata sözleşmesi

Bütün servisler aynı zarfı döner
([ExceptionHandlingMiddleware.cs](../BACKEND/src/BuildingBlocks/FraudCell.BuildingBlocks/Api/ExceptionHandlingMiddleware.cs)):

```json
{
  "success": false,
  "data": null,
  "error": { "code": "INVALID_CREDENTIALS", "message": "E-posta veya şifre hatalı.", "details": null },
  "meta": { "traceId": "01M6...", "pagination": null, "generatedAt": null }
}
```

Kullanıcı yokluğu ile yanlış şifre aynı cevabı alır; böylece e-posta tahmini yapılamaz. `traceId` loglarla eşleşir.

## Sırlar

- Gerçek sırlar repoda yoktur; `.env.example` dosyaları yalnızca örnek değer taşır.
- RSA anahtarı ilk açılışta Identity içinde üretilir ve bir volume'de kalır.
- Demo kullanıcılarının şifreleri yalnızca yerel `Development` ortamı içindir.

## Bilinen eksikler

| Eksik | Durum |
|---|---|
| OTP sınırı yalnızca IP başına; aynı GSM'e farklı IP'lerden deneme sınırlanmıyor | Sırada |
| Personel oluşturma (kullanıcı + profil + olay) tek bir veritabanı işleminde değil | Sırada |
| HTTPS sonlandırma yok; yerelde HTTP | Bir ters vekil ya da bulut yük dengeleyici gerekir |
| Gerçek SMS gönderimi yok | Vaka kapsamı dışında; OTP ekranda gösterilir |
