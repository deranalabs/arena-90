type ResetCanvasProps = {
  label?: string;
};

export function ResetCanvas({ label = "Arena90" }: ResetCanvasProps) {
  return (
    <main className="reset-canvas" aria-label={label}>
      <p className="reset-canvas__mark">Arena90</p>
    </main>
  );
}
