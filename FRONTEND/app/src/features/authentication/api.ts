import { api } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import type {
  RequestOtpChallengeBody,
  RequestOtpChallengeResponse,
  StaffLoginBody,
  StaffLoginResponse,
  VerifyOtpChallengeBody,
  VerifyOtpChallengeResponse,
} from '@/shared/api/contract';

/**
 * Kimlik uçlarının çağrı katmanı.
 *
 * Ekranlar `api.post(...)` yazmaz; yol ve gövde şekli burada tek yerde durur.
 */

export const authApi = {
  /** OTP gönderir. `purpose` doğrulama davranışını belirler — aşağıdaki nota bak. */
  requestOtp: (body: RequestOtpChallengeBody) =>
    api
      .post<RequestOtpChallengeResponse>(endpoints.auth.otpChallenges, {
        body,
        skipAuthRefresh: true,
      })
      .then((r) => r.data),

  /**
   * OTP doğrular ve oturum açar.
   *
   * Davranış `challenge.purpose`a göre değişir:
   *   CustomerLogin    → numara kayıtlı değilse OTP_CODE_INVALID döner.
   *                      Numaranın kayıtlı olmadığı KASITLI olarak sızdırılmaz;
   *                      aksi hâlde kayıtlı numaralar tek tek denenerek
   *                      çıkarılabilirdi.
   *   CustomerRegister → `customer` alanı ZORUNLU; numara zaten kayıtlıysa
   *                      GSM_NUMBER_ALREADY_REGISTERED (409) döner.
   */
  verifyOtp: (body: VerifyOtpChallengeBody) =>
    api
      .post<VerifyOtpChallengeResponse>(endpoints.auth.otpVerifications, {
        body,
        skipAuthRefresh: true,
      })
      .then((r) => r.data),

  /** Personel girişi. 5 başarısız denemede hesap kilitlenir (ACCOUNT_LOCKED). */
  loginStaff: (body: StaffLoginBody) =>
    api
      .post<StaffLoginResponse>(endpoints.auth.staffLogin, { body, skipAuthRefresh: true })
      .then((r) => r.data),
};
