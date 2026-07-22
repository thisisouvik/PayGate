import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/AppShell/AppSidebar";
import { MobileNav } from "@/components/AppShell/MobileNav";
import { getDeveloperTotalEarnings } from "@/lib/db/calls";
import { ToastProvider } from "@/components/ui/toast-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/login");
  }

  const totalEarnings = await getDeveloperTotalEarnings(session.developerId);

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col md:flex-row bg-zinc-950 text-zinc-50">
        {/* Desktop Sidebar */}
        <div className="hidden md:block md:w-64 border-r border-zinc-800 bg-zinc-900/50">
          <AppSidebar walletAddress={session.stellarWallet} totalEarnings={totalEarnings} />
        </div>

        {/* Mobile Top Nav */}
        <div className="md:hidden border-b border-zinc-800 bg-zinc-900/50">
          <MobileNav walletAddress={session.stellarWallet} totalEarnings={totalEarnings} />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}


