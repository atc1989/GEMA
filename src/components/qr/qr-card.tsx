import { QrCode, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";

type QRCardProps = {
  code: string;
  title: string;
  description?: string;
};

export function QRCard({ code, title, description }: QRCardProps) {
  return (
    <Card className="p-4 text-center">
      <div className="mx-auto flex size-36 items-center justify-center rounded-2xl border border-border bg-white text-brand">
        <QrCode className="size-24" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-sm font-black tracking-tight">{title}</h2>
      <div className="mt-1 font-mono text-xs font-bold text-muted-foreground">
        {code}
      </div>
      {description ? (
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold text-success">
        <ShieldCheck className="size-4" aria-hidden="true" />
        Ready for QR check-in
      </div>
    </Card>
  );
}
