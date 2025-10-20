// apps/hub/src/components/TheaterBackground.jsx
// apps/hub/src/components/TheaterBackground.jsx
export default function TheaterBackground({ bgUrl, children }) {
  return (
    // Root is the only positioned element; creates the full-screen stacking context
    <div
      className="relative min-h-dvh w-full bg-black overflow-hidden"
      style={{ isolation: "isolate" }}
    >
      <img
        src={bgUrl}
        alt="Theater background"
        className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
      />

      {/* global vignette so it stays dark */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(65% 65% at 50% 55%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.85) 100%), linear-gradient(90deg, rgba(0,0,0,0.6), transparent 22%, transparent 78%, rgba(0,0,0,0.6))",
        }}
      />

      {children}
    </div>
  );
}
