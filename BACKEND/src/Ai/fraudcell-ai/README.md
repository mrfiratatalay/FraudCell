# AI Service

Scikit-learn tabanlı risk skoru ve fraud-type sınıflandırması üretir; uzmanlık,
kapasite ve performansa göre analist adaylarını sıralar. `transaction.created`
event'ini tüketip `ai.assessment.completed|failed` yayınlar. Harici LLM yalnızca
opsiyonel açıklama metni içindir; skoru etkilemez.

Endpointler: `/api/v1/ai/models/*`, `/api/v1/ai/metrics/*`,
`/api/v1/ai/predictions/*`, `/internal/v1/assessments/score`, health endpoint'leri.
OpenAPI: `/openapi.json` ve `BACKEND/contracts/openapi/ai.json`; Swagger UI: `/docs`.

Başlıca ayarlar: `AI_DB_*`, `RABBITMQ_*`, `AI_MODEL_ARTIFACT_DIR`,
`INTERNAL_API_TOKEN`, opsiyonel `GEMINI_API_KEY/MODEL/TIMEOUT_SECONDS/ENABLED`.

```powershell
uv sync --all-groups
uv run python train.py
uv run ruff check .
uv run mypy app
uv run pytest -q
```

Eğitim verisi, leakage önlemleri, kalibrasyon ve metrikler için
[MODEL_CARD.md](MODEL_CARD.md) ve `models/metadata.json` esas alınır.
