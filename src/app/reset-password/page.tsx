import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset password | StreekMart" };

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";
  if (!token) {
    return (
      <div className="mx-auto mt-10 max-w-md card p-8">
        <h1 className="text-2xl font-bold">Missing reset token</h1>
        <p className="mt-1 text-sm text-gray-600">
          Open the link from your email to reset your password.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto mt-10 max-w-md card p-8">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mt-1 text-sm text-gray-600">
        At least 8 characters. After saving we&rsquo;ll sign you in automatically.
      </p>
      <ResetPasswordForm token={token} />
    </div>
  );
}