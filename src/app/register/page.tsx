import Link from "next/link";
import { Band, PageCanvas } from "@/components/storefront/Band";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const user = await getCurrentUser();

  if (user) {
    return (
      <PageCanvas><Band tone="raised"><div className="mx-auto max-w-md card p-8">
        <h1 className="text-2xl font-bold">You&apos;re already signed in</h1>
        <p className="mt-1 text-sm text-gray-600">
          Signed in as <span className="font-medium">{user.name}</span> ({user.email}).
          Sign out first to create a new account.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/" className="btn-primary">
            Go to home
          </Link>
          <LogoutButton
            label="Sign out & create new account"
            className="btn-secondary"
          />
        </div>
      </div></Band></PageCanvas>
    );
  }

  return (
    <PageCanvas><Band tone="raised"><div className="mx-auto max-w-md card p-8">
      <h1 className="text-2xl font-bold">Join StreekMart</h1>
      <p className="mt-1 text-sm text-gray-600">Pick your role and get started in seconds.</p>
      <RegisterForm />
    </div></Band></PageCanvas>
  );
}
