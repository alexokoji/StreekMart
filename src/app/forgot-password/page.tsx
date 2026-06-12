import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Forgot password | StreekMart" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto mt-10 max-w-md card p-8">
      <h1 className="text-2xl font-bold">Forgot your password?</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter your account email and we&apos;ll send you a link to choose a new one.
        The link expires in 60 minutes.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}