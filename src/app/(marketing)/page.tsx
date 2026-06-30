import { redirect } from "next/navigation";

// Root "/" redirects straight to login.
// Authenticated users are bounced to /dashboard by the login page itself.
export default function RootPage() {
  redirect("/login");
}
