import Link from "next/link";
import { LayoutDashboard, LogIn, UserPlus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { hubRegisterUrl } from "@/lib/hub-link";
import { cn } from "@/lib/utils";

/**
 * The way in, on a public page.
 *
 * A signed-in member gets one link to their dashboard — showing them "Sign in"
 * on a marketing page is the confusion this whole surface exists to remove.
 *
 * A visitor gets Sign in, and Register **on the hub**: D13 puts account
 * creation on Lifestyle only, so GEMA links there with a `returnTo` and never
 * grows a sign-up form of its own. When the hub origin is unconfigured the
 * register link is omitted rather than rendered dead.
 */
export function AccountCta({
  signedIn,
  returnToPath = "/discover",
}: {
  signedIn: boolean;
  returnToPath?: string;
}) {
  if (signedIn) {
    return (
      <Link href="/dashboard" className={cn(buttonVariants({ variant: "brand" }))}>
        <LayoutDashboard aria-hidden="true" />
        Go to my dashboard
      </Link>
    );
  }

  const register = hubRegisterUrl(returnToPath);

  return (
    <>
      <Link href="/login" className={cn(buttonVariants({ variant: "brand" }))}>
        <LogIn aria-hidden="true" />
        Sign in
      </Link>
      {register ? (
        // Another origin, so a plain anchor: a router prefetch would be a
        // cross-origin request for nothing. Same tab — one system.
        <a href={register} className={cn(buttonVariants({ variant: "outline" }))}>
          <UserPlus aria-hidden="true" />
          Create an account
        </a>
      ) : null}
    </>
  );
}
