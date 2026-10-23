import { redirect } from "next/navigation";

/** `/` → `/dashboard` (Page 1 — the Bento Grid War Room). */
export default function HomePage() {
  redirect("/dashboard");
}
