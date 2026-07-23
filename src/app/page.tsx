import FrameMaker from "@/components/FrameMaker";

export default function Home() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#060c22]">
      {/* Warm gold glow behind the header, like the poster's spotlight */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,164,65,0.18),transparent_55%)]" />
      {/* Faint starfield texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 12% 22%, #fff, transparent), radial-gradient(1px 1px at 78% 14%, #fff, transparent), radial-gradient(1px 1px at 42% 68%, #fff, transparent), radial-gradient(1px 1px at 88% 52%, #fff, transparent), radial-gradient(1px 1px at 24% 82%, #fff, transparent), radial-gradient(1px 1px at 62% 38%, #fff, transparent), radial-gradient(1px 1px at 6% 55%, #fff, transparent)",
        }}
      />
      <FrameMaker />
    </div>
  );
}
