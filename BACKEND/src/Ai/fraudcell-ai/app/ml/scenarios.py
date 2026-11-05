"""Hand-written Turkish transaction scenarios (case §5.1: realistic suspicious and
legitimate examples, at least ~100).

The model is trained on the synthetic generator (synthetic_data.py); these
scenarios are kept OUT of training and used as an independent acceptance set:
train.py scores them and records how many it gets right in metadata.json.
Each template expands into five deterministic variations (amount and hour), so
the set is reproducible without a random seed.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.ml.schema import FEATURE_COLUMNS


@dataclass(frozen=True)
class Scenario:
    description: str
    fraud_type: str
    transaction_type: str  # odeme | transfer | fatura | cekim
    amount: float
    hours: tuple[int, ...]  # Istanbul local hours; one per variation
    foreign: bool
    new_device: bool
    new_recipient: bool
    deviation: float  # amount / the customer's usual amount
    last_10_minutes: int
    last_24_hours: int
    device_age_days: int
    recipient_age_days: int


_NIGHT = (1, 2, 3, 0, 23)

TEMPLATES: list[Scenario] = [
    # --- CALINTI_KART: stolen card, new device, bursts, often at night or abroad ---
    Scenario("Gece yarisi yurt disindan, yeni cihazla art arda yuksek tutarli kart odemeleri",
             "CALINTI_KART", "odeme", 18_000, _NIGHT, True, True, True, 7.0, 5, 9, 0, 0),
    Scenario("Calinan kartla yeni cihazdan kisa surede cok sayida kucuk cekim",
             "CALINTI_KART", "cekim", 2_500, (2, 3, 4, 1, 0), False, True, True, 4.0, 6, 10, 1, 0),
    Scenario("Kart bilgileri ele gecirilmis: yurt disi e-ticaret sitesinden gece toplu alisveris",
             "CALINTI_KART", "odeme", 9_500, (23, 0, 1, 2, 3), True, True, True, 5.5, 4, 7, 0, 1),
    Scenario("Kayip kartla ayni gece farkli sehirlerdeki ATM'lerden nakit cekimi",
             "CALINTI_KART", "cekim", 6_000, _NIGHT, False, True, True, 6.0, 4, 8, 2, 0),
    # --- HESAP_ELE_GECIRME: account takeover; the device is days, not hours, old (synthetic_data.py) ---
    Scenario("Sifresi calinan hesaptan yeni cihazla giris sonrasi tanimadik aliciya yuksek transfer",
             "HESAP_ELE_GECIRME", "transfer", 35_000, (2, 3, 1, 4, 0), False, True, True, 4.0, 2, 5, 6, 4),
    Scenario("SIM kart degisiminden hemen sonra yeni cihazdan hesabi bosaltma girisimi",
             "HESAP_ELE_GECIRME", "transfer", 48_000, (22, 23, 0, 1, 2), False, True, True, 5.0, 3, 6, 8, 3),
    Scenario("Oltalama (phishing) sonrasi yurt disi baglantili yeni cihazdan art arda transferler",
             "HESAP_ELE_GECIRME", "transfer", 15_000, (9, 11, 14, 16, 20), True, True, True, 3.5, 3, 6, 10, 6),
    Scenario("Ele gecirilen hesapta yeni cihazdan her zamankinden farkli bir IBAN'a para gonderimi",
             "HESAP_ELE_GECIRME", "transfer", 12_000, (10, 13, 15, 18, 21), False, True, True, 3.2, 2, 5, 7, 2),
    # --- PARA_AKLAMA: money laundering, known device, new foreign recipients, high volume ---
    Scenario("Yurt disindaki yeni alicilara gun icinde parcali, yuvarlak tutarli transferler",
             "PARA_AKLAMA", "transfer", 45_000, (10, 12, 14, 16, 18), True, False, True, 7.0, 1, 9, 200, 0),
    Scenario("Yeni acilmis alici hesaplarina surekli yuksek tutarli transfer (paravan hesap)",
             "PARA_AKLAMA", "transfer", 80_000, (11, 13, 15, 17, 19), True, False, True, 9.0, 1, 7, 300, 1),
    Scenario("Hesaba gelen paranin ayni gun icinde yurt disina aktarilmasi",
             "PARA_AKLAMA", "transfer", 60_000, (8, 10, 12, 14, 22), True, False, True, 8.0, 2, 8, 150, 2),
    Scenario("Kumar sitesiyle baglantili yurt disi hesaplara gece duzenli transfer",
             "PARA_AKLAMA", "transfer", 30_000, (23, 0, 1, 22, 2), True, False, True, 6.5, 1, 6, 90, 3),
    # --- SUPHELI_DAVRANIS: weaker, mixed signals ---
    Scenario("Gece saatinde kisa surede cok sayida dusuk tutarli deneme odemesi",
             "SUPHELI_DAVRANIS", "odeme", 300, (0, 1, 2, 3, 23), False, True, True, 2.4, 5, 9, 1, 0),
    Scenario("Uzun suredir hareketsiz hesapta aniden yeni cihazdan gece cekimi",
             "SUPHELI_DAVRANIS", "cekim", 7_000, (3, 4, 23, 0, 1), False, True, False, 3.5, 1, 2, 0, 30),
    Scenario("Alisilmisin uc kati tutarda, yeni cihazdan yeni aliciya aksam odemesi",
             "SUPHELI_DAVRANIS", "odeme", 9_000, (19, 20, 21, 22, 18), False, True, True, 3.0, 3, 5, 2, 0),
    # --- TEMIZ: legitimate ---
    Scenario("Her ay tekrarlayan duzenli elektrik faturasi odemesi",
             "TEMIZ", "fatura", 850, (9, 10, 11, 12, 13), False, False, False, 1.0, 0, 1, 400, 365),
    Scenario("Kayitli cihazdan mahalle marketinde alisveris",
             "TEMIZ", "odeme", 650, (10, 12, 17, 18, 19), False, False, False, 0.9, 0, 2, 600, 200),
    Scenario("Maas gununde ev sahibine her ayki kira transferi",
             "TEMIZ", "transfer", 15_000, (9, 10, 11, 12, 13), False, False, False, 1.2, 0, 1, 500, 330),
    Scenario("Aileye her hafta yapilan duzenli para gonderimi",
             "TEMIZ", "transfer", 2_000, (18, 19, 20, 21, 17), False, False, False, 1.0, 0, 1, 700, 400),
    Scenario("Tatildeyken yurt disinda kayitli cihazdan otel odemesi",
             "TEMIZ", "odeme", 6_000, (14, 15, 16, 17, 18), True, False, True, 1.6, 0, 2, 365, 0),
    Scenario("Isyerine yakin ATM'den hafta ici nakit cekimi",
             "TEMIZ", "cekim", 1_500, (12, 13, 8, 9, 17), False, False, False, 1.1, 0, 1, 450, 300),
    Scenario("Telefon faturasinin otomatik odenmesi",
             "TEMIZ", "fatura", 400, (6, 7, 8, 9, 10), False, False, False, 1.0, 0, 1, 800, 700),
    Scenario("Yeni telefona gecen musterinin ilk gun alistigi tutarda market odemesi",
             "TEMIZ", "odeme", 700, (11, 12, 13, 14, 15), False, True, False, 1.0, 0, 2, 0, 250),
    Scenario("Gece vardiyasinda calisan musterinin her zamanki eczane odemesi",
             "TEMIZ", "odeme", 300, (0, 1, 2, 23, 3), False, False, False, 1.0, 0, 1, 500, 200),
]

# Variation i scales the amount (and so the deviation ratio) by this factor.
_AMOUNT_FACTORS = (1.0, 0.8, 1.25, 0.9, 1.1)


def scenario_rows() -> list[dict]:
    """Every template x five variations, with the model's feature columns and labels."""
    rows = []
    for template_index, s in enumerate(TEMPLATES):
        for variation, factor in enumerate(_AMOUNT_FACTORS):
            hour = s.hours[variation]
            features = {
                "amount": round(s.amount * factor, 2),
                "hour_of_day": float(hour),
                "is_night": 1.0 if hour < 6 or hour >= 23 else 0.0,
                "is_foreign_country": float(s.foreign),
                "is_new_device": float(s.new_device),
                "is_new_recipient": float(s.new_recipient),
                "amount_deviation_ratio": round(s.deviation * factor, 3),
                "transactions_last_10_minutes": float(s.last_10_minutes),
                "transactions_last_24_hours": float(s.last_24_hours),
                "device_age_days": float(s.device_age_days),
                "recipient_age_days": float(s.recipient_age_days),
                **{f"transaction_type_{t}": float(s.transaction_type == t) for t in ("odeme", "transfer", "fatura", "cekim")},
            }
            rows.append({
                "scenario_id": f"S{template_index + 1:02d}-{variation + 1}",
                "description": s.description,
                **{column: features[column] for column in FEATURE_COLUMNS},
                "fraud_type": s.fraud_type,
                "is_fraud": int(s.fraud_type != "TEMIZ"),
            })
    return rows


SCENARIO_COLUMNS = ["scenario_id", "description", *FEATURE_COLUMNS, "fraud_type", "is_fraud"]
