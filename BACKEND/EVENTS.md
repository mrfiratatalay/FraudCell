# FraudCell Event Kataloğu

Tüm domain event'leri RabbitMQ `fraudcell.events` topic exchange'i üzerinden
`<event-type>.v1` routing key'iyle yayınlanır. Ortak envelope alanları:
`eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `subjectId`,
`correlationId`, `causationId`, `payload`. Domain producer'ları transactional outbox,
consumer'lar idempotent inbox kullanır. DB tutmayan gateway'in 403 audit producer'ı
publisher-confirm ile doğrudan yayınlar ve broker hatasını güvenlik loguna yazar.
Akış diyagramları ve tasarım kararları [docs/03-mimari.md](../docs/03-mimari.md) dosyasındadır.

| Producer | Event'ler | Temel payload |
|---|---|---|
| Identity | `identity.customer.registered`, `identity.staff.created`, `identity.staff.profile.updated`, `identity.account.locked`, `identity.account.unlocked`, `identity.token.reuse.detected` | ilgili kullanıcı/personel id, profil sürümü ve olay zamanı |
| Transaction | `transaction.created`, `transaction.assessment.timed_out`, `transaction.temporarily.blocked`, `transaction.approved` | transaction id/no, müşteri, tutar, cihaz/konum veya kontrol zamanı |
| Transaction | `case.created`, `case.assigned`, `case.assignment.queued`, `case.review.started`, `case.customer_verification.requested`, `customer.verification.responded`, `case.decision.made`, `case.fraud_type.overridden`, `case.risk_level.overridden`, `case.sla.breached`, `case.closed`, `customer.feedback.submitted` | case/transaction/analyst id, risk, karar, SLA ve olay zamanı |
| AI | `ai.assessment.completed`, `ai.assessment.failed` | assessment/transaction id, risk skoru, fraud türü, model sürümü, reason codes ve analyst candidates |
| Gamification | `gamification.points.awarded`, `gamification.points.deducted`, `badge.earned`, `analyst.level.changed`, `leaderboard.updated`, `analyst.performance.updated` | analyst id, delta/total, badge/level/period ve source event |
| Ortak | `audit.entry.requested`, `user.notification.requested` | actor/action/result/resource veya recipient/title/body/reference |

Event şeması değişirse `eventVersion` artırılır; eski consumer sözleşmesi kırılmaz.
