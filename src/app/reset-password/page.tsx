import Link from "next/link";

import { AuthLayout } from "@/components/auth/auth-layout";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; email?: string }>;
}) {
  const { code, email } = await searchParams;

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Choose a new password for your Gutguard account."
      footer={
        <Link href="/login" className="font-bold text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ResetPasswordForm code={code} email={email} />
    </AuthLayout>
  );
}
