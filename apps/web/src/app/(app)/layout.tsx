import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-[264px]">
        <Topbar />
        <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
