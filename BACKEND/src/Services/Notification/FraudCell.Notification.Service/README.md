# Notification Service

Servislerin `user.notification.requested` olaylarını RabbitMQ'dan dinler ve ilgili kullanıcının tarayıcısına
Server-Sent Events (SSE) ile iletir. Veritabanı tutmaz; bağlantılar bellektedir.

- `POST /api/v1/events/tickets`: Oturum açmış kullanıcıya kısa ömürlü, tek kullanımlık bir bilet verir.
- `GET /api/v1/events?ticket=...`: Bilet ile SSE akışını açar. Access token URL'e yazılmaz; böylece loglara ve tarayıcı
  geçmişine sızmaz.
- `/health/live`, `/health/ready`.

Başlıca ayarlar: `RabbitMq__*`, `Jwt__*` (token'lar Identity'nin JWKS'iyle doğrulanır), `ASPNETCORE_ENVIRONMENT`.
Neden ayrı bir servis olduğu: [docs/11-cozdugum-problemler.md](../../../../../docs/11-cozdugum-problemler.md#7-gerçek-zamanlı-bildirim-gatewayin-içindeydi).
