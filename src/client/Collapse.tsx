import { useEffect, useState, type ReactNode } from 'react';

interface CollapseProps {
  open: boolean;
  children: ReactNode;
  durationMs?: number;
  className?: string;
}

// Animated open/close using the CSS grid-template-rows 0fr→1fr trick,
// which interpolates between 0 and the content's natural height without
// measuring. Children remain mounted while the close transition runs,
// then unmount so the DOM stays clean in the collapsed state (matches
// the SSR behavior the Results tests assert on).
export function Collapse({ open, children, durationMs = 260, className }: CollapseProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two rAFs: first commits the 0fr starting frame, second flips to
      // 1fr so the transition actually runs.
      let raf2: number | null = null;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2 !== null) cancelAnimationFrame(raf2);
      };
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [open, durationMs]);

  if (!mounted) return null;

  return (
    <div
      className={['grid motion-reduce:transition-none', className].filter(Boolean).join(' ')}
      style={{
        gridTemplateRows: visible ? '1fr' : '0fr',
        transitionProperty: 'grid-template-rows',
        transitionDuration: `${durationMs}ms`,
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }}
      aria-hidden={!visible}
    >
      <div className="overflow-hidden min-h-0">
        <div
          className="motion-reduce:transition-none"
          style={{
            opacity: visible ? 1 : 0,
            transitionProperty: 'opacity',
            transitionDuration: `${durationMs}ms`,
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
