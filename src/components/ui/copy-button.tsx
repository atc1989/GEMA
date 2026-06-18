"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: "brand" | "outline" | "soft" | "secondary" | "ghost";
  size?: "sm" | "default";
  className?: string;
};

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  variant = "soft",
  size = "sm",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context); ignore silently.
    }
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={onCopy} className={className}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
