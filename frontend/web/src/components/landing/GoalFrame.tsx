import { cn } from "@/lib/utils";

type GoalFrameProps = {
  side: "left" | "right";
};

export function GoalFrame({ side }: GoalFrameProps) {
  const isLeft = side === "left";

  return (
    <div
      className={cn(
        "absolute top-[39%] h-[22%] w-[4%] opacity-85",
        isLeft
          ? "left-[2.6%] border-y-2 border-l-2 border-agent-isagi/60"
          : "right-[2.6%] border-y-2 border-r-2 border-agent-aiku/60",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-1 w-full bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.1)_0_1px,transparent_1px_8px),repeating-linear-gradient(90deg,rgba(255,255,255,0.08)_0_1px,transparent_1px_8px)] opacity-35",
          isLeft ? "left-0" : "right-0",
        )}
      />
      <div
        className={cn(
          "absolute top-[-2px] h-2 w-[145%] border-t border-white/18",
          isLeft ? "left-0 skew-y-[-18deg]" : "right-0 skew-y-[18deg]",
        )}
      />
    </div>
  );
}
