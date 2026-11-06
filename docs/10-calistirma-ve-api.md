# 10. Çalıştırma ve API

## Tek komutla kurulum

Gereken tek şey Docker (Desktop ya da Engine) ve Compose v2. .NET, Python ya da Node kurmak gerekmez; AI modeli de image
derlenirken eğitilir.

```bash
git clone https://github.com/mrfiratatalay/FraudCell.git
cd FraudCell
make up        # macOS / Linux
# Windows: scripts\start-fraudcell.bat
```

Make olmadan:

```bash
cd BACKEND
cp .env.example .env
docker compose up -d --build
```

İlk açılış image'ları derlediği için birkaç dakika sürer. Servisler sağlıklı olunca `demo-seed` demo personelini açar.

- Uygulama: http://127.0.0.1:8080
- Sağlık: http://127.0.0.1:8080/health/ready

| Komut | Ne yapar |
|---|---|
| `make demo` | Zorunlu demo akışını uçtan uca doğrular |
| `make demo-ai-down` | AI'ı durdurur, işlemlerin yine kaydedildiğini doğrular |
| `make resilience` | Her container'ı sırayla durdurup sistemin toparlandığını doğrular |
| `make security` | Jürinin deneyeceği saldırıları dener (sonraki 1 dakika girişler kısılır) |
| `make down` / `make reset` | Durdurur / bütün verileri siler |

## Demo kullanıcıları (yalnızca yerel)

| Rol | Giriş | Şifre |
|---|---|---|
| Yönetici | `admin@fraudcell.local` | `ChangeMe123!` |
| Süpervizör | `supervisor@fraudcell.local` | `Demo1234!` |
| Analist (Çalıntı Kart) | `analyst.kart@fraudcell.local` | `Demo1234!` |
| Analist (Hesap Ele Geçirme) | `analyst.hesap@fraudcell.local` | `Demo1234!` |
| Analist (Para Aklama) | `analyst.aklama@fraudcell.local` | `Demo1234!` |
| Analist (Şüpheli Davranış) | `analyst.davranis@fraudcell.local` | `Demo1234!` |
| Müşteri | Herhangi bir `5xxxxxxxxx` numarası | OTP `1234` |

## Ortam değişkenleri

Hepsi [BACKEND/.env.example](../BACKEND/.env.example) içinde, açıklamalarıyla:

| Değişken | Ne için |
|---|---|
| `*_DB_PASSWORD`, `POSTGRES_ADMIN_PASSWORD` | Dört veritabanının rol şifreleri |
| `RABBITMQ_USER`, `RABBITMQ_PASSWORD` | Mesaj kuyruğu |
| `AI_INTERNAL_API_TOKEN` | AI'ın iç bakım uçları |
| `GEMINI_API_KEY` | İsteğe bağlı; boşsa açıklama şablonla üretilir |
| `SEED_ADMIN_*`, `DEMO_STAFF_PASSWORD` | Yerel demo hesapları |
| `CASE_CLOSURE_DELAY` | Karardan sonra kapanma süresi (varsayılan 48 saat) |

## API

- Bütün uçlar `/api/v1` altında ve gateway üzerinden: `http://127.0.0.1:8080/api/v1/...`.
- OpenAPI dosyaları: [BACKEND/contracts/openapi](../BACKEND/contracts/openapi/). Frontend tipleri bunlardan üretilir ve
  CI farkı kontrol eder.
- Olaylar: [EVENTS.md](../BACKEND/EVENTS.md).

### Personel girişi

```bash
curl -s -X POST http://127.0.0.1:8080/api/v1/auth/staff/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"supervisor@fraudcell.local","password":"Demo1234!"}'
# {"success":true,"data":{"accessToken":"eyJ...","accessTokenExpiresAt":"...","user":{...}},...}
TOKEN=eyJ...
```

### Vakaları listele

```bash
curl -s "http://127.0.0.1:8080/api/v1/cases?status=ATANDI&limit=5" -H "Authorization: Bearer $TOKEN"
```

### Vaka ata (ETag ile)

```bash
curl -si http://127.0.0.1:8080/api/v1/cases/$CASE_ID -H "Authorization: Bearer $TOKEN" | grep -i etag
# ETag: "4"
curl -s -X PUT http://127.0.0.1:8080/api/v1/cases/$CASE_ID/assignment \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'If-Match: "4"' \
  -d '{"analystId":"'$ANALYST_ID'","reason":"Uzmanlık eşleşmesi"}'
```

Aynı istek eski sürümle tekrar gönderilirse 412 döner:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RESOURCE_VERSION_MISMATCH",
    "message": "Kaynak başka bir kullanıcı veya işlem tarafından güncellendi.",
    "details": { "expectedVersion": 4, "currentVersion": 5 }
  },
  "meta": { "traceId": "01M6...", "pagination": null, "generatedAt": null }
}
```

### Müşteri işlemi (Idempotency-Key ile)

```bash
curl -s -X POST http://127.0.0.1:8080/api/v1/transactions \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"amount":50000,"currency":"TRY","transactionType":"TRANSFER",
       "recipient":{"reference":"TR330006100519786457841326"},
       "device":{"fingerprint":"new-device"},
       "location":{"city":"New York","countryCode":"US"},
       "occurredAt":"2026-11-06T02:10:00+03:00"}'
```

## Testleri çalıştırmak

| Ne | Komut |
|---|---|
| .NET | `cd BACKEND && dotnet test` (Testcontainers için Docker açık olmalı) |
| AI | `cd BACKEND/src/Ai/fraudcell-ai && uv run pytest -q` |
| Frontend | `cd FRONTEND/app && npm test && npm run typecheck` |
| Tarayıcı | Sistem açıkken `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npx playwright test --project=desktop-chrome` |
| Frontend demo | `cd FRONTEND/app && npm run dev` (varsayılan demo modu) |
