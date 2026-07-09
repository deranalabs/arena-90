import { GlobalArenaLayout } from "@/components/layout/GlobalArenaLayout";

export default function LandingPage() {
  return (
    <GlobalArenaLayout>
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="border-2 border-black bg-white px-8 py-4 brutalist-shadow">
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-black">
            ARENA90: READY FOR SECTIONS
          </h1>
          <p className="mt-2 font-mono text-sm text-zinc-600">
            Global layout and Anti-Slop tokens initialized.
          </p>
        </div>
      </div>
    </GlobalArenaLayout>
  );
}