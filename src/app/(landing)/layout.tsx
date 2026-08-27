import { Anton, Fraunces, Inter_Tight } from "next/font/google";

import "@/components/landing/ginhawa-landing.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter-tight",
  display: "swap",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

/** Public landings — no AppShell. Fonts shared; each template scopes its own surface. */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${interTight.variable} ${anton.variable}`}>
      {children}
    </div>
  );
}
