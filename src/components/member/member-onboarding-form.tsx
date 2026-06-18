"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { UserPlus } from "lucide-react";

import { onboardMember, type FieldErrors } from "@/lib/actions/membership";
import { onboardMemberSchema, type OnboardMemberInput } from "@/lib/schemas/member";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function MemberOnboardingForm({ defaultSponsorRef }: { defaultSponsorRef?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<OnboardMemberInput>({
    resolver: zodResolver(onboardMemberSchema),
    defaultValues: { username: "", sponsorRef: defaultSponsorRef ?? "" },
  });

  const applyFieldErrors = (fieldErrors?: FieldErrors) => {
    if (!fieldErrors) return;
    for (const [name, messages] of Object.entries(fieldErrors)) {
      if (messages?.length) {
        setError(name as keyof OnboardMemberInput, { message: messages[0] });
      }
    }
  };

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await onboardMember(values);
      if (!result.ok) {
        applyFieldErrors(result.fieldErrors);
        setError("root", { message: result.error });
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Card className="grid gap-4 p-5">
        <Field
          label="Username"
          htmlFor="username"
          required
          error={errors.username?.message}
          hint="Letters, numbers, and underscores. This identifies you in referrals."
        >
          <Input id="username" autoComplete="username" {...register("username")} />
        </Field>
        <Field
          label="Sponsor (optional)"
          htmlFor="sponsorRef"
          error={errors.sponsorRef?.message}
          hint="A sponsor's referral code or username, if you have one."
        >
          <Input id="sponsorRef" {...register("sponsorRef")} />
        </Field>
      </Card>

      {errors.root?.message ? (
        <p className="text-sm font-semibold text-destructive">{errors.root.message}</p>
      ) : null}

      <Button type="submit" variant="brand" size="lg" disabled={pending}>
        <UserPlus aria-hidden="true" />
        {pending ? "Setting up…" : "Activate membership"}
      </Button>
    </form>
  );
}
