import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export type VeitScrollAreaProps = {
  children: ReactNode;
  className?: string;
};

/** Scrollport whose thumb is drawn by us. The platform bar stays hidden. */
export function VeitScrollArea({ children, className = '' }: VeitScrollAreaProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setThumb(null);
      return;
    }
    const height = Math.max(32, (clientHeight / scrollHeight) * clientHeight);
    const maxTop = Math.max(0, clientHeight - height);
    const top = scrollHeight === clientHeight ? 0 : (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    setThumb({ top, height });
  }, []);

  useEffect(() => {
    update();
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [update, children]);

  return (
    <div className={`relative min-h-0 flex-1 ${className}`.trim()}>
      <div ref={scroller} className="veit-scroll h-full overflow-y-auto" onScroll={update}>
        {children}
      </div>
      {thumb && (
        <div
          className="pointer-events-none absolute right-1 w-1.5 rounded-full bg-muted-foreground/50"
          style={{ top: thumb.top, height: thumb.height }}
        />
      )}
    </div>
  );
}
