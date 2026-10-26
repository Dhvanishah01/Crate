import type { Metadata } from "next";
import OwnerForm from "@/components/OwnerForm";

export const metadata: Metadata = { title: "Crate · Owner", robots: { index: false, follow: false } };

export default function OwnerPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <h1 className="text-[13px] font-medium uppercase tracking-[0.3em] text-ink-muted">Crate · Owner</h1>
      <OwnerForm />
    </main>
  );
}
