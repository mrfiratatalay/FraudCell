# Edge Gateway

YARP reverse proxy, JWT doğrulama, security headers, rate limiting, correlation id ile
sistemin tek dış giriş noktasıdır. Kalıcı
domain verisi tutmaz.

Route'lar: `/api/v1/auth|staff|reference|audit-logs` → Identity,
`/api/v1/transactions|cases|customer/verifications` → Transaction,
`/api/v1/game` → Gamification, `/api/v1/ai` → AI, `/api/v1/events` → Notification (SSE),
diğer her yol → web (nginx SPA). `/health/live` ve
`/health/ready` gateway sağlığını verir;

Başlıca ayarlar: `ReverseProxy__Clusters__*__Address`, `Jwt__*`,
`ASPNETCORE_ENVIRONMENT`. Docker Compose yalnızca `127.0.0.1:8080` portunu açar.
