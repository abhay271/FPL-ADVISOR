import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

/**
 * Portal-based tooltip that escapes any overflow:hidden containers.
 * Clamps horizontally so it never overflows the viewport on the right.
 * The caret always points to the anchor element, not to the tooltip center.
 */
export function Tooltip({ text, children }) {
  const [state, setState] = useState(null); // { tx, ty, arrowShift }
  const ref = useRef(null);

  const show = useCallback(() => {
    if (!text || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const anchorX = rect.left + rect.width / 2;
    const anchorY = rect.top;

    // Clamp tooltip center so it stays inside the viewport (assuming ~200px max width)
    const halfW = 100;
    const clampedX = Math.max(halfW + 8, Math.min(anchorX, window.innerWidth - halfW - 8));
    // Arrow shift: how far the caret must move from tooltip center to point at anchor
    const arrowShift = anchorX - clampedX;

    setState({ tx: clampedX, ty: anchorY, arrowShift });
  }, [text]);

  const hide = useCallback(() => setState(null), []);

  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={hide} className="inline-flex items-center gap-0.5">
      {children}
      {state && text && createPortal(
        <div
          style={{
            position:  "fixed",
            left:      state.tx,
            top:       state.ty,
            transform: "translate(-50%, calc(-100% - 10px))",
            zIndex:    9999,
            pointerEvents: "none",
          }}
        >
          {/* Tooltip box */}
          <div className="px-2.5 py-1.5 rounded-lg bg-dark-500 border border-dark-400 shadow-2xl text-xs text-slate-100 whitespace-nowrap">
            {text}
          </div>

          {/* Caret — outer border color */}
          <div
            style={{
              position:    "absolute",
              top:         "100%",
              left:        `calc(50% + ${state.arrowShift}px)`,
              transform:   "translateX(-50%)",
              width:       0,
              height:      0,
              borderLeft:  "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop:   "5px solid #3a3a54", // dark-400
            }}
          />
          {/* Caret — inner fill color */}
          <div
            style={{
              position:    "absolute",
              top:         "calc(100% - 1px)",
              left:        `calc(50% + ${state.arrowShift}px)`,
              transform:   "translateX(-50%)",
              width:       0,
              height:      0,
              borderLeft:  "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop:   "4px solid #2a2a42", // dark-500
            }}
          />
        </div>,
        document.body
      )}
    </span>
  );
}
