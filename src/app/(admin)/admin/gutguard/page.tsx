import { GutGuardAdminOperations } from "@/features/gutguard-daily/components/gutguard-pages";
import { loadGutGuardAdminOverview } from "@/features/gutguard-daily/services/load-gutguard-page-data";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminGutGuardPage() {
  await requireAdmin();
  const overview = await loadGutGuardAdminOverview();

  return <GutGuardAdminOperations overview={overview} />;
}
