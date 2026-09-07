import { redirect } from "next/navigation";

/**
 * `gema.gutguard.ph` is a public address, so its root belongs to prospects.
 *
 * This route used to render "GEMA UI Foundation" — a scaffolding page listing
 * route groups and component counts, left over from the prototype conversion.
 * It was never a product page, and it is what a member saw when they followed
 * the Events link from Lifestyle.
 *
 * `/discover` is the prospect surface that already exists: the science, the
 * proof, how it works, and the ways in. Redirecting rather than copying it
 * keeps one page to maintain.
 */
export default function Home() {
  redirect("/discover");
}
