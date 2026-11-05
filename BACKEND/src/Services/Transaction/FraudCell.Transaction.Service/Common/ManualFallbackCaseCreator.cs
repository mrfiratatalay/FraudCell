using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Common;

/// <summary>
/// AI degerlendirmesi zamaninda gelmediginde (timeout) veya acikca basarisiz
/// olduğunda kullanilan ortak fallback (dokuman `05-DOMAIN-AND-STATE-MACHINE.md`
/// §9.3/§13.3, `02-ARCHITECTURE-OVERVIEW.md` §17): risk BELIRSIZ gosterilir,
/// guvenli karar INCELEME kalir, vaka MANUAL_QUEUE'ya duser.
/// </summary>
public sealed class ManualFallbackCaseCreator(TransactionServiceDbContext db, OutboxWriter outboxWriter, CrossCuttingEventPublisher crossCutting)
{
    public async Task CreateAsync(Domain.FraudTransaction fraudTransaction, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var alreadyExists = await db.RiskCases.AnyAsync(c => c.TransactionId == fraudTransaction.Id, cancellationToken);
        if (alreadyExists)
        {
            return;
        }

        var riskCase = new RiskCase
        {
            Id = Ulid.NewUlid().ToString(),
            TransactionId = fraudTransaction.Id,
            CustomerId = fraudTransaction.CustomerId,
            SlaStartedAt = now,
            CreatedAt = now,
            UpdatedAt = now,
        };

        riskCase.StartSla(SlaPriority.YUKSEK, now);
        riskCase.EnqueueForAssignment(manual: true, now);

        db.RiskCases.Add(riskCase);

        outboxWriter.Enqueue(TransactionEventTypes.CaseCreated, riskCase.Id, new
        {
            caseId = riskCase.Id,
            transactionId = fraudTransaction.Id,
            customerId = fraudTransaction.CustomerId,
            riskLevel = (string?)null,
            slaPriority = riskCase.SlaPriority.ToString(),
            slaDeadlineAt = riskCase.SlaDeadlineAt,
            manualReviewReason = fraudTransaction.ManualReviewReason,
            createdAt = now,
        });

        crossCutting.PublishNotification(fraudTransaction.CustomerId, "AI_ASSESSMENT_PENDING_MANUAL_REVIEW",
            "İşlem manuel incelemede", "İşleminiz manuel inceleme kuyruğuna alındı.", "TRANSACTION", fraudTransaction.Id);
    }
}
