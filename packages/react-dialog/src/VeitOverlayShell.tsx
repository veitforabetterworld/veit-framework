import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useVeitOverlayLayer } from './overlayLayerStack.js';

export type VeitOverlayShellProps = {
  children?: ReactNode;
  className?: string;
  /** Vollflächiger Lade-Spinner ohne Dialog-Chrome. */
  variant?: 'default' | 'loading';
};

/**
 * Fixed full-screen Hülle für Nicht-Dialog-Overlays (Peer-Stacks, Suspense-Fallbacks).
 * Z-Index wird automatisch über den globalen Overlay-Stack vergeben.
 */
export function VeitOverlayShell({
  children,
  className = '',
  variant = 'default',
}: VeitOverlayShellProps) {
  const zIndexBase = useVeitOverlayLayer(true);
  const zLayer = zIndexBase + 5;

  if (variant === 'loading') {
    return (
      <div
        className={`fixed inset-0 flex items-center justify-center bg-background/45 ${className}`.trim()}
        style={{ zIndex: zLayer }}
        aria-busy="true"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 ${className}`.trim()} style={{ zIndex: zLayer }}>
      {children}
    </div>
  );
}
