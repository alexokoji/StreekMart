import Link from "next/link";
import { Band, PageCanvas } from "@/components/storefront/Band";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string; error?: string };
}) {
  const user = await getCurrentUser();

  if (user) {
    return (
      <PageCanvas><Band tone="raised"><div className="mx-auto max-w-md card p-8">
        <h1 className="text-2xl font-bold">You&apos;re already signed in</h1>
        <p className="mt-1 text-sm text-gray-600">
          Signed in as <span className="font-medium">{user.name}</span> ({user.email}).
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/" className="btn-primary">
            Go to home
          </Link>
          <LogoutButton
            label="Sign out & switch account"
            className="btn-secondary"
          />
        </div>
      </div></Band></PageCanvas>
    );
  }

  return (
    <PageCanvas><Band tone="raised"><div className="mx-auto max-w-md card p-8">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-gray-600">Log in to your StreekMart account.</p>
      <LoginForm
        redirectTo={searchParams.redirect}
        oauthError={searchParams.error}
      />
    </div></Band></PageCanvas>
  );
}
