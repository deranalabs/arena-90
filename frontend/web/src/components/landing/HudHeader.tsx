export function HudHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-6 font-mono text-xs uppercase tracking-widest text-arena-muted">
      <div className="flex items-center gap-4">
        <div className="font-display text-2xl leading-none tracking-normal text-arena-text">
          ARENA90
        </div>
        <div className="hidden h-px w-12 bg-arena-muted/30 sm:block" />
        <span className="hidden sm:inline-block">V1.0.0 / Protocol_Engaged</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex h-2 w-2 rounded-full bg-system-success animate-pulse" />
        SYSTEM_ONLINE
      </div>
    </header>
  );
}
