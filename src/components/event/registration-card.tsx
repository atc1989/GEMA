import { CheckCircle2, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RegistrationCardProps = {
  title: string;
  description: string;
  primaryAction?: string;
  secondaryAction?: string;
};

export function RegistrationCard({
  title,
  description,
  primaryAction = "Reserve seat",
  secondaryAction = "View details",
}: RegistrationCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-success">
          <Ticket className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="brand">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {primaryAction}
            </Button>
            <Button variant="soft">{secondaryAction}</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
