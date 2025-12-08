// frontend/app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // Always send root to /login
  redirect("/login");
}
