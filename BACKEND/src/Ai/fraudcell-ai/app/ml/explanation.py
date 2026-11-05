"""Gemini tabanli aciklama anlatisi katmani.

ONEMLI: Bu katman risk skorunu veya karari URETMEZ. Skor, risk seviyesi, fraud
tipi ve reason_codes zaten ML modeli + deterministik kural katmani tarafindan
uretilmistir. Burada yalnizca bu HAZIR ciktilar analiste yonelik akici bir Turkce
gerekce metnine cevrilir. Gemini erisilemezse (api_key yok, timeout, hata) None
doner ve cagiran taraf `build_deterministic_summary` fallback'ine geri duser;
fraud karari asla Gemini'ye bagimli degildir.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any

from app.config import settings

if TYPE_CHECKING:
    from app.models.ai import Prediction

logger = logging.getLogger(__name__)

_FRAUD_TYPE_LABELS: dict[str, str] = {
    "CALINTI_KART": "Çalıntı kart kullanımı",
    "HESAP_ELE_GECIRME": "Hesap ele gecirme",
    "PARA_AKLAMA": "Para aklama",
    "SUPHELI_DAVRANIS": "Şüpheli davranış",
    "TEMIZ": "Temiz / risk sinyali yok",
}

_SYSTEM_INSTRUCTION = (
    "Sen bir dolandırıcılık (fraud) analistine yardımcı olan bir asistansın. "
    "Sana bir işlem değerlendirmesinin HAZIR sonuçları verilir: risk seviyesi, "
    "karar, fraud tipi ve tespit edilen sinyaller (reason codes). Gorevin bu "
    "sinyalleri analiste yönelik akıcı, profesyonel Türkçe bir gerekçe metnine "
    "çevirmek. Kurallar: (1) Yalnızca sana verilen sinyalleri ve alanları kullan; "
    "yeni sayi, oran veya olgu UYDURMA. (2) Risk skorunu yeniden hesaplama veya "
    "sorgulama; verilen kararı veri olarak kabul et. (3) 2-4 cümle, madde imi yok, "
    "başlık yok, doğrudan gerekçe. (4) Sinyal yoksa işlemin neden nominal göründüğünü "
    "kisaca acikla."
)

# Lazy singleton: import ve client kurulumu yalnizca ozellik aktifse yapilir.
_client: Any | None = None
_client_ready = False


def _get_client() -> Any | None:
    global _client, _client_ready
    if _client_ready:
        return _client

    _client_ready = True
    if not settings.gemini.is_active:
        _client = None
        return None

    try:
        from google import genai

        _client = genai.Client(api_key=settings.gemini.api_key)
    except Exception:  # pragma: no cover - kurulum/ithal hatasi fallback'e duser
        logger.exception("Gemini istemcisi kurulamadi; aciklama katmani devre disi.")
        _client = None

    return _client


def _build_prompt(prediction: Prediction) -> str:
    reason_lines = []
    for code in prediction.reason_codes or []:
        label = code.get("label", code.get("code", ""))
        impact = code.get("impact", "")
        reason_lines.append(f"- {label} (etki: {impact})")
    reasons = "\n".join(reason_lines) if reason_lines else "- Belirgin bir risk sinyali yok"

    fraud_label = _FRAUD_TYPE_LABELS.get(prediction.fraud_type, prediction.fraud_type)

    return (
        f"Risk seviyesi: {prediction.risk_level}\n"
        f"Karar: {prediction.decision}\n"
        f"Fraud tipi: {fraud_label}\n"
        f"Tespit edilen sinyaller:\n{reasons}\n\n"
        "Bu degerlendirmeyi analiste acikla."
    )


async def generate_explanation(prediction: Prediction) -> str | None:
    """Prediction icin Gemini anlatisi uretir; erisilemezse None doner (fallback sinyali)."""
    client = _get_client()
    if client is None:
        return None

    try:
        from google.genai import types

        config = types.GenerateContentConfig(system_instruction=_SYSTEM_INSTRUCTION)
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=settings.gemini.model,
                contents=_build_prompt(prediction),
                config=config,
            ),
            timeout=settings.gemini.timeout_seconds,
        )
        text = (response.text or "").strip()
        return text or None
    except Exception:  # timeout dahil her hata; deterministik yedege dusulur
        logger.warning("Gemini aciklamasi uretilemedi; deterministik ozete dusuluyor.", exc_info=True)
        return None


def build_deterministic_summary(prediction: Prediction) -> str:
    """LLM'siz calisan yedek ozet: reason_codes etiketlerinden kisa bir metin kurar."""
    fraud_label = _FRAUD_TYPE_LABELS.get(prediction.fraud_type, prediction.fraud_type)
    codes = prediction.reason_codes or []
    labels = [c.get("label", c.get("code", "")) for c in codes if c.get("code") != "NOMINAL_PATTERN"]

    if not labels:
        return (
            f"Risk seviyesi {prediction.risk_level}, karar {prediction.decision}. "
            "Belirgin bir risk sinyali tespit edilmedi; işlem nominal görünüyor."
        )

    signal_text = ", ".join(labels)
    return (
        f"Risk seviyesi {prediction.risk_level} ({fraud_label}), karar {prediction.decision}. "
        f"Öne çıkan sinyaller: {signal_text}."
    )
