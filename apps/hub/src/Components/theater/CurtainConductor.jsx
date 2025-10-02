// apps/hub/src/components/theater/CurtainConductor.jsx
import { useEffect, useRef, useState } from "react";
import CurtainOverlay from "./CurtainOverlay.jsx";

/**
 * CurtainConductor
 * - Opens curtain at Question, keeps it open through Reveal and Result.
 * - Closes shortly *before* the next Question (at end of Result using `seconds`).
 * - If `seconds` is unavailable, it will briefly close+open when `questionId` changes.
 */
export default function CurtainConductor({ stage, seconds, questionId }) {
  const [open, setOpen] = useState(false);
  const prevId = useRef(questionId);
  const tRef = useRef();

  const PRE_CLOSE_S = 0.8; // seconds before result ends to close

  // Close near the end of Result to signal end-of-round
  useEffect(() => {
    if (stage === "result" && typeof seconds === "number") {
      if (seconds <= PRE_CLOSE_S && open) {
        setOpen(false);
      }
    }
  }, [stage, seconds, open]);

  // On question change, ensure we (re)open after a brief beat
  useEffect(() => {
    if (questionId !== prevId.current) {
      prevId.current = questionId;
      clearTimeout(tRef.current);
      // If we didn't close during result, make a quick close-then-open
      setOpen(false);
      tRef.current = setTimeout(() => setOpen(true), 450);
    }
  }, [questionId]);

  // On first entry into gameplay stages, open if not already
  useEffect(() => {
    if ((stage === "question" || stage === "reveal" || stage === "result") && !open) {
      clearTimeout(tRef.current);
      tRef.current = setTimeout(() => setOpen(true), 200);
    }
    return () => clearTimeout(tRef.current);
  }, [stage]);

  if (!(stage === "question" || stage === "reveal" || stage === "result")) return null;

  return <CurtainOverlay open={open} cueKey={questionId} />;
}
