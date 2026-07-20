import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { AppNavigation } from "@/components/app-navigation";
import { BrandMark } from "@/components/brand-mark";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = !!profile?.is_admin;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <header className="sticky top-0 z-40 border-b bg-background/90 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <nav aria-label="Primary navigation" className="mx-auto flex h-16 w-full max-w-7xl items-center gap-1 px-2 sm:gap-3 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            aria-label="NoteHut dashboard"
            className="shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <BrandMark iconClassName="size-8 sm:size-9" wordmarkClassName="hidden xl:inline" />
          </Link>
          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <AppNavigation isAdmin={isAdmin} />
          </div>
          <LogoutButton />
        </nav>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
