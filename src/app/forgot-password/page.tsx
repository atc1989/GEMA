import Link from "next/link";

import { AuthLayout } from "@/components/auth/auth-layout";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your username or email and we'll send you a reset link."
      footer={
        <Link href="/login" className="font-bold text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
