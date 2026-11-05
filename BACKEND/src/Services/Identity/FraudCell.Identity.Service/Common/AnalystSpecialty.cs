namespace FraudCell.Identity.Service.Common;

/// <summary>
/// Analistin uzmanlik alanlari. Fraud-type enum'iyla ayni degerleri paylasir,
/// ancak "TEMIZ" bir uzmanlik alani olamayacagi icin buraya
/// dahil edilmez.
/// </summary>
public enum AnalystSpecialty
{
    CALINTI_KART,
    HESAP_ELE_GECIRME,
    PARA_AKLAMA,
    SUPHELI_DAVRANIS,
}

/// <summary>
/// FraudCell operasyon bolgeleri. PDF bolge bazli atamayi zorunlu kildigi icin
/// somut bir enum olarak sabitlenir; Turkiye'nin cografi
/// bolgeleridir.
/// </summary>
public enum OperationRegion
{
    MARMARA,
    EGE,
    AKDENIZ,
    IC_ANADOLU,
    KARADENIZ,
    DOGU_ANADOLU,
    GUNEYDOGU_ANADOLU,
    YURT_DISI,
}
