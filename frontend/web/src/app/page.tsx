export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F4F4F0] font-sans text-black">
      {/* Brutalist Grid Pattern */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-10" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 0)", backgroundSize: "32px 32px" }}></div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-5">
        <div className="border-2 border-black bg-white px-8 py-4 brutalist-shadow">
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-black">
            ARENA90: READY FOR SECTIONS
          </h1>
          <p className="mt-2 font-mono text-sm text-zinc-600">
            Global layout and Anti-Slop tokens initialized.
          </p>
        </div>
      </div>
    </main>
  );
}