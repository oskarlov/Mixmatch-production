import { AnimatePresence, motion } from "framer-motion";

/**
 * SpotlightOverlay (circle, seamless)
 * - One continuous animation: flicker keyframes that settle exactly at holdOpacity.
 * - Optional flicker (set flicker={false} to just fade in steady).
 * - Fades out smoothly when active becomes false.
 */
export default function SpotlightOverlay({
  active,
  onSettled,
  flicker = true,        // first time true; later stages false
  duration = 1.05,       // total flicker duration
  holdOpacity = 0.6,     // steady intensity (0..1)
  center = [0.5, 0.5],   // dead center by default
  r = "45%",             // BIGGER circle by default (try 36–40% if you want more)
  tint = "255,238,200",  // warm white (r,g,b)
  exitDuration = 0.6,    // fade-out when turning off
}) {
  // Circle beam (use equal ellipse radii for robust cross-browser behavior)
  const beam = `radial-gradient(ellipse ${r} ${r} at ${center[0] * 100}% ${center[1] * 100}%,
    rgba(${tint},0.80) 0%,
    rgba(${tint},0.35) 45%,
    rgba(${tint},0.00) 70%)`;

  // Keyframes that *end at holdOpacity* so there's no visible seam
  const flickerKeys = [0, 1, 0.18, 1, 0.42, 0.92, 0.28, holdOpacity];
  const flickerTimes = [0, 0.18, 0.30, 0.48, 0.62, 0.78, 0.88, 1];

  // Simple steady fade when flicker is disabled
  const steadyKeys = [0, holdOpacity];
  const steadyTimes = [0, 1];

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="spot"
          className="pointer-events-none absolute inset-0 z-[5]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, exit: { duration: exitDuration, ease: "easeOut" } }}
        >
          {/* Main beam — single animation that lands on the steady value */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: flicker ? flickerKeys : steadyKeys }}
            transition={{
              duration: flicker ? duration : 0.35,
              times: flicker ? flickerTimes : steadyTimes,
              ease: "easeInOut",
            }}
            onAnimationComplete={flicker ? onSettled : undefined}
            style={{ background: beam, mixBlendMode: "screen", willChange: "opacity" }}
          />

          {/* Soft bloom that tracks the main beam, at lower intensity */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: flicker ? flickerKeys.map(v => v * 0.28) : steadyKeys.map(v => v * 0.28) }}
            transition={{
              duration: flicker ? duration : 0.35,
              times: flicker ? flickerTimes : steadyTimes,
              ease: "easeInOut",
            }}
            style={{
              background: `radial-gradient(ellipse ${r} ${r} at ${center[0] * 100}% ${center[1] * 100}%,
                rgba(255,255,255,0.18) 0%,
                rgba(255,255,255,0.06) 38%,
                rgba(255,255,255,0.00) 70%)`,
              mixBlendMode: "screen",
              filter: "blur(1px)",
              willChange: "opacity",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
