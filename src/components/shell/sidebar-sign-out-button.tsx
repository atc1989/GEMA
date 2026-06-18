import { LogOut } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";

export function SidebarSignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        title="Sign out"
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <LogOut className="size-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}
