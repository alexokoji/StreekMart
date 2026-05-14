"use client";

import { useRouter } from "next/navigation";

// Logout always returns the user to the home page. Centralised here so every
// caller stays consistent — there is no `redirectTo` escape hatch.
export function LogoutButton({
  className = "text-sm text-gray-500 hover:text-red-600",
  label = "Log out",
}: {
  className?: string;
  label?: string;
} = {}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
