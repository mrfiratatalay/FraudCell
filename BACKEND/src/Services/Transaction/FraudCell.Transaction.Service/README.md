# Transaction Service

İşlem kaydı, AI assessment projeksiyonu, risk case state machine'i, atama, müşteri
doğrulaması, SLA, karar, override ve feedback'in sahibidir. AI 5 saniye içinde cevap
vermezse watchdog işlemi `TIMED_OUT` yapıp manuel vaka kuyruğuna taşır. Karar verilen vaka
`CaseClosure__Delay` (varsayılan 48 saat) sonra kapanır.

Endpoint grupları: `/api/v1/transactions*`, `/api/v1/cases*`,
`/api/v1/customer/verifications/*`, `/health/live`, `/health/ready`. Tam sözleşme:
`BACKEND/contracts/openapi/transaction.json`; Development API UI: `/scalar/v1`.

Başlıca ayarlar: `ConnectionStrings__TransactionDb`, `RabbitMq__*`, `Jwt__*`,
`Assessment__DeadlineSeconds`, `Assessment__CustomerVerificationTimeoutMinutes`,
`CaseClosure__Delay`, `CaseClosure__PollInterval`, `Outbox__PollIntervalMilliseconds/BatchSize`,
`ASPNETCORE_ENVIRONMENT`. Kurallar ve tasarım: [docs/05-is-kurallari.md](../../../../../docs/05-is-kurallari.md).
