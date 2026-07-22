import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { HOME_BY_ROLE } from '@/app/router/guards';
import type {
  RequestOtpChallengeBody,
  StaffLoginBody,
  VerifyOtpChallengeBody,
} from '@/shared/api/contract';
import { authApi } from './api';
import { fromOtpVerification, fromStaffLogin, startSession } from './session';

/**
 * Kimlik mutation'ları.
 *
 * Giriş başarılı olduğunda oturum başlatılır ve kullanıcı ROLÜNE GÖRE kendi
 * ana sayfasına yollanır. Yönlendirmeyi ekranlar değil bu hook yapar; aksi
 * hâlde her giriş ekranı aynı rol→yol eşlemesini tekrar yazardı.
 */

/** OTP gönderimi. Dönen `challengeId` sonraki adımda kullanılır. */
export function useRequestOtp() {
  return useMutation({
    mutationFn: (body: RequestOtpChallengeBody) => authApi.requestOtp(body),
  });
}

export function useVerifyOtp() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: VerifyOtpChallengeBody) => authApi.verifyOtp(body),
    onSuccess: (result) => {
      startSession(result.accessToken, fromOtpVerification(result.user));
      void navigate({ to: HOME_BY_ROLE[result.user.role] });
    },
  });
}

export function useStaffLogin() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: StaffLoginBody) => authApi.loginStaff(body),
    onSuccess: (result, variables) => {
      // Backend yanıtında e-posta yok; girilen değeri profilde göstermek için
      // taşıyoruz.
      startSession(result.accessToken, fromStaffLogin(result.user, variables.email));
      void navigate({ to: HOME_BY_ROLE[result.user.role] });
    },
  });
}
