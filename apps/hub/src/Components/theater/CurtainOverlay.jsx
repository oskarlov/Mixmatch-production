// apps/hub/src/components/theater/CurtainOverlay.jsx
import { motion } from "framer-motion";

/**
 * Velvet curtain effect panels.
 * The parent conductor controls the `open` prop.
 */
export default function CurtainOverlay({ open, cueKey }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden key={cueKey}>
      {/* Valance */}
      <div
        className="absolute top-0 left-0 right-0 h-16 shadow-[0_8px_14px_rgba(0,0,0,.55)]"
        style={{
          background: "linear-gradient(to bottom,#7a0f16,#a3121b 60%,#7a0f16)",
        }}
      />
      {/* Left curtain */}
      <motion.div
        className="absolute top-0 left-0 h-full w-[52%] border-r border-black/30"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgba(0,0,0,.22) 0 2px, rgba(0,0,0,0) 2px 14px), linear-gradient(to bottom,#7a0f16,#a3121b 60%,#7a0f16)",
          boxShadow: "inset 0 0 60px rgba(0,0,0,.6)",
        }}
        initial={{ x: "0%" }}
        animate={{ x: open ? "-105%" : "0%" }}
        transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
      />
      {/* Right curtain */}
      <motion.div
        className="absolute top-0 right-0 h-full w-[52%] border-l border-black/30"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgba(0,0,0,.22) 0 2px, rgba(0,0,0,0) 2px 14px), linear-gradient(to bottom,#7a0f16,#a3121b 60%,#7a0f16)",
          boxShadow: "inset 0 0 60px rgba(0,0,0,.6)",
        }}
        initial={{ x: "0%" }}
        animate={{ x: open ? "105%" : "0%" }}
        transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
      />
    </div>
  );
}
