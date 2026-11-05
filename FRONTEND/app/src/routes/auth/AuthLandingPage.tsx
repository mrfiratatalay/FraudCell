import { CustomerOtpPage } from './CustomerOtpPage';

/** `/auth` opens straight on customer sign-in; staff is one tab away. */
export function AuthLandingPage({ redirectTo }: { redirectTo?: string }) {
  return <CustomerOtpPage mode="login" redirectTo={redirectTo} />;
}
