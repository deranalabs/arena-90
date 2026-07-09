import { CenterCircle } from "@/components/landing/CenterCircle";
import { PitchPlane } from "@/components/landing/PitchPlane";

export function FootballPitch() {
  return (
    <div className="absolute inset-x-0 bottom-[-10%] mx-auto h-[30%] w-[88%] max-w-7xl opacity-80 [perspective:1100px]">
      <PitchPlane />
      <CenterCircle />
    </div>
  );
}
