// apps/hub/src/components/theater/SpotlightOverlay.jsx
import { motion } from "framer-motion";

/**
 * Full-page sweeping spotlight (SVG version) with adjustable intensity.
 */
export default function SpotlightOverlay() {
  // ↓ Lower = dimmer beam. Try 0.25–0.5
  const INTENSITY = 0.35;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[60] hidden lg:block overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.svg
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: "-14vh",
          width: "120vw",
          height: "150vh",
          willChange: "transform",
        }}
        viewBox="0 0 100 150"
        preserveAspectRatio="xMidYMin slice"
        initial={{ x: "0vw", rotate: 0 }}
        animate={{
          x: ["0vw", "42vw", "0vw", "-42vw", "0vw"],
          rotate: [0, 8, 0, -8, 0],
        }}
        transition={{
          duration: 10,
          ease: "easeInOut",
          repeat: Infinity,
          times: [0, 0.25, 0.5, 0.75, 1],
        }}
      >
        <defs>
          {/* softer vertical fade; use stopOpacity instead of rgba for clean control */}
          <linearGradient id="beamGradient" x1="50" y1="0" x2="50" y2="150" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="#FFF5B4" stopOpacity={INTENSITY} />
            <stop offset="70%" stopColor="#FFF5B4" stopOpacity={0} />
          </linearGradient>
          {/* slightly gentler blur so edges aren’t as bright */}
          <filter id="soften" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        {/* global beam opacity also scaled by INTENSITY */}
        <polygon
          points="50,0 85,150 15,150"
          fill="url(#beamGradient)"
          filter="url(#soften)"
          opacity={INTENSITY + 0.1 /* small bump so the gradient still reads */}
        />
      </motion.svg>
    </motion.div>
  );
}
