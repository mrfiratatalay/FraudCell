"""Deterministik aciklama katmani (dokuman `00-START-HERE.md` §12 "Aciklama katmani").

Risk skoru ML modelinden gelir; operasyonel aciklamalar burada, engineered
feature'lara uygulanan kural degerlendirmesinden uretilir. Bu, model
aciklamasi (SHAP vb.) DEGILDIR ve oyle sunulmaz.
"""

from __future__ import annotations


def generate_reason_codes(features: dict[str, float]) -> list[dict[str, str]]:
    codes: list[dict[str, str]] = []

    if features["is_new_device"] >= 1.0:
        codes.append({"code": "NEW_DEVICE", "label": "İlk kez görülen cihaz", "impact": "HIGH"})

    if features["amount_deviation_ratio"] >= 3.0:
        ratio = features["amount_deviation_ratio"]
        codes.append({
            "code": "AMOUNT_DEVIATION",
            "label": f"Normal tutarın {ratio:.1f} katı",
            "impact": "HIGH" if ratio >= 5.0 else "MEDIUM",
        })

    if features["is_foreign_country"] >= 1.0:
        codes.append({"code": "UNUSUAL_LOCATION", "label": "Alışılmadık işlem konumu", "impact": "HIGH"})

    if features["is_night"] >= 1.0:
        codes.append({"code": "NIGHT_TRANSACTION", "label": "Gece saatinde gerçekleştirilen işlem", "impact": "MEDIUM"})

    if features["is_new_recipient"] >= 1.0:
        codes.append({"code": "NEW_RECIPIENT", "label": "İlk kez görülen alıcı", "impact": "MEDIUM"})

    if features["transactions_last_10_minutes"] >= 3:
        codes.append({"code": "VELOCITY_10MIN", "label": "Kısa sürede tekrarlanan işlemler", "impact": "HIGH"})
    elif features["transactions_last_24_hours"] >= 8:
        codes.append({"code": "VELOCITY_24H", "label": "Son 24 saatte yüksek işlem sıklığı", "impact": "MEDIUM"})

    if not codes:
        codes.append({"code": "NOMINAL_PATTERN", "label": "Belirgin bir risk sinyali tespit edilmedi", "impact": "LOW"})

    return codes
