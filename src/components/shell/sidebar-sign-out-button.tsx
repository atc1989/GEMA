"use client";

import { Loader2, LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";

import { signOutAction } from "@/lib/actions/auth";

function SignOutIcon() {
  const { pending } = useFormStatus();
  const Icon = pending ? Loader2 : LogOut;
  return <Icon className={pending ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />;
}

export function SidebarSignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        title="Sign out"
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <SignOutIcon />
      </button>
    </form>
  );
}
