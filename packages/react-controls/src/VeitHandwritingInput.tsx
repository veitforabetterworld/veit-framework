import { useEffect, useId, useMemo, useRef, useState, type PointerEvent, type TextareaHTMLAttributes } from 'react';
import { Keyboard, PenLine } from 'lucide-react';

export type VeitHandwritingPoint = {
  x: number;
  y: number;
  t: number;
  pressure: number;
};

export type VeitHandwritingStroke = VeitHandwritingPoint[];

export type VeitHandwritingRecognitionMode = 'web-first' | 'backend-only';

export type VeitHandwritingFallbackPolicy = 'never' | 'on-unavailable' | 'on-low-confidence' | 'always';

export type VeitHandwritingRecognizeRequest = {
  strokes: VeitHandwritingStroke[];
  imageDataUrl: string;
  languageHint?: string;
};

export type VeitHandwritingRecognitionResult = {
  text: string;
  confidence?: number;
  detectedLanguage?: string;
  engine: 'web' | 'backend';
};

export type VeitHandwritingRecognizer = {
  isAvailable: () => boolean;
  recognize: (req: VeitHandwritingRecognizeRequest) => Promise<VeitHandwritingRecognitionResult | null>;
};

export type VeitBackendHandwritingTransport = (req: {
  imageDataUrl: string;
  languageHint?: string;
}) => Promise<
  | {
      text?: string | null;
      confidence?: number | null;
      detectedLanguage?: string | null;
      detected_language?: string | null;
    }
  | null
>;

export function createVeitBackendHandwritingRecognizer(
  transport: VeitBackendHandwritingTransport,
): (
  req: Pick<VeitHandwritingRecognizeRequest, 'imageDataUrl' | 'languageHint'>,
) => Promise<VeitHandwritingRecognitionResult | null> {
  return async ({ imageDataUrl, languageHint }) => {
    const payload = await transport({ imageDataUrl, languageHint });
    const text = (payload?.text ?? '').trim();
    if (!text) return null;
    return {
      text,
      confidence: payload?.confidence ?? undefined,
      detectedLanguage: payload?.detectedLanguage ?? payload?.detected_language ?? undefined,
      engine: 'backend',
    };
  };
}

type BrowserRecognizer = {
  isAvailable?: () => boolean;
  recognizeHandwriting?: (
    req: VeitHandwritingRecognizeRequest,
  ) => Promise<{ text?: string; confidence?: number; detectedLanguage?: string } | null>;
};

function browserRecognizer(): BrowserRecognizer | null {
  if (typeof window === 'undefined') return null;
  const maybe = (window as Window & { __veitHandwritingRecognizer?: BrowserRecognizer }).__veitHandwritingRecognizer;
  if (!maybe || typeof maybe.recognizeHandwriting !== 'function') return null;
  return maybe;
}

export const veitBrowserHandwritingRecognizer: VeitHandwritingRecognizer = {
  isAvailable() {
    const provider = browserRecognizer();
    if (!provider) return false;
    if (typeof provider.isAvailable === 'function') return provider.isAvailable() === true;
    return true;
  },
  async recognize(req) {
    const provider = browserRecognizer();
    if (!provider?.recognizeHandwriting) return null;
    const out = await provider.recognizeHandwriting(req);
    if (!out?.text || !out.text.trim()) return null;
    return {
      text: out.text,
      confidence: out.confidence,
      detectedLanguage: out.detectedLanguage,
      engine: 'web',
    };
  },
};

type SharedProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  languageHint?: string;
  recognitionMode?: VeitHandwritingRecognitionMode;
  fallbackPolicy?: VeitHandwritingFallbackPolicy;
  onRecognitionMeta?: (meta: VeitHandwritingRecognitionResult) => void;
  recognizer?: VeitHandwritingRecognizer;
  onBackendRecognize?: (
    req: Pick<VeitHandwritingRecognizeRequest, 'imageDataUrl' | 'languageHint'>,
  ) => Promise<VeitHandwritingRecognitionResult | null>;
  enableHandwriting?: boolean;
  handwritingToggleLabel?: string;
  convertActionLabel?: string;
  clearLabel?: string;
};

type VeitHandwritingTextareaProps = SharedProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'className' | 'disabled'>;

type VeitSmartTextareaProps = Omit<VeitHandwritingTextareaProps, 'enableHandwriting'> & {
  featureEnabled?: boolean;
  featureEnvVar?: string;
  featureStorageKey?: string;
};

type DrawState = 'idle' | 'writing' | 'recognizing' | 'applied' | 'fallback';

function shouldAllowFallback(policy: VeitHandwritingFallbackPolicy, reason: 'unavailable' | 'low-confidence'): boolean {
  if (policy === 'always') return true;
  if (policy === 'never') return false;
  if (policy === 'on-unavailable') return reason === 'unavailable';
  return reason === 'low-confidence' || reason === 'unavailable';
}

function drawStrokes(
  canvas: HTMLCanvasElement,
  strokes: VeitHandwritingStroke[],
  activeStroke: VeitHandwritingStroke | null,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgb(255 255 255)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const all = activeStroke && activeStroke.length > 0 ? [...strokes, activeStroke] : strokes;
  for (const stroke of all) {
    if (stroke.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      const p = stroke[i];
      ctx.lineWidth = Math.max(1.2, 2 + p.pressure * 2.2);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgb(17 24 39)';
    ctx.stroke();
  }
}

function useHandwritingPad() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DrawState>('idle');
  const [strokes, setStrokes] = useState<VeitHandwritingStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<VeitHandwritingStroke | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const clear = () => {
    setStrokes([]);
    setActiveStroke(null);
    setStatus('idle');
  };

  const redraw = (nextStrokes: VeitHandwritingStroke[], nextActiveStroke: VeitHandwritingStroke | null) => {
    if (!canvasRef.current) return;
    drawStrokes(canvasRef.current, nextStrokes, nextActiveStroke);
  };

  const toPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
      t: Date.now(),
      pressure: Number.isFinite(e.pressure) ? e.pressure : 0.5,
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== 'pen' && e.pointerType !== 'touch') return;
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const s: VeitHandwritingStroke = [toPoint(e)];
    setActiveStroke(s);
    setStatus('writing');
    redraw(strokes, s);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current == null || pointerIdRef.current !== e.pointerId) return;
    if (!activeStroke) return;
    const next = [...activeStroke, toPoint(e)];
    setActiveStroke(next);
    redraw(strokes, next);
  };

  const finishStroke = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current == null || pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    if (activeStroke && activeStroke.length > 0) {
      const nextStrokes = [...strokes, activeStroke];
      setStrokes(nextStrokes);
      setActiveStroke(null);
      redraw(nextStrokes, null);
    }
  };

  const getImageDataUrl = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.toDataURL('image/png') : null;
  };

  const canRecognize = strokes.length > 0;

  return {
    open,
    setOpen,
    status,
    setStatus,
    strokes,
    clear,
    canvasRef,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishStroke,
    onPointerCancel: finishStroke,
    canRecognize,
    getImageDataUrl,
  };
}

function VeitHandwritingPad({
  value,
  onApply,
  languageHint,
  recognitionMode = 'web-first',
  fallbackPolicy = 'on-unavailable',
  recognizer = veitBrowserHandwritingRecognizer,
  onRecognitionMeta,
  onBackendRecognize,
  disabled,
}: {
  value: string;
  onApply: (next: string) => void;
  languageHint?: string;
  recognitionMode?: VeitHandwritingRecognitionMode;
  fallbackPolicy?: VeitHandwritingFallbackPolicy;
  recognizer?: VeitHandwritingRecognizer;
  onRecognitionMeta?: (meta: VeitHandwritingRecognitionResult) => void;
  onBackendRecognize?: (
    req: Pick<VeitHandwritingRecognizeRequest, 'imageDataUrl' | 'languageHint'>,
  ) => Promise<VeitHandwritingRecognitionResult | null>;
  disabled?: boolean;
}) {
  const id = useId();
  const {
    status,
    setStatus,
    strokes,
    clear,
    canvasRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    canRecognize,
    getImageDataUrl,
  } = useHandwritingPad();
  const autoRecognizeTimerRef = useRef<number | null>(null);

  const statusText = useMemo(() => {
    if (status === 'writing') return 'Schreiben...';
    if (status === 'recognizing') return 'Erkenne...';
    if (status === 'applied') return 'Uebernommen';
    if (status === 'fallback') return 'Fallback aktiv';
    return 'Bereit';
  }, [status]);

  const runRecognition = async () => {
    if (!canRecognize || disabled) return;
    const imageDataUrl = getImageDataUrl();
    if (!imageDataUrl) return;
    setStatus('recognizing');

    const runBackend = async () => {
      if (!onBackendRecognize) return null;
      return onBackendRecognize({ imageDataUrl, languageHint });
    };

    let result: VeitHandwritingRecognitionResult | null = null;
    const webAvailable = recognizer.isAvailable();

    if (recognitionMode === 'backend-only') {
      result = await runBackend();
      if (result) setStatus('fallback');
    } else {
      if (webAvailable) {
        result = await recognizer.recognize({ strokes, imageDataUrl, languageHint });
      }
      const lowConfidence = result != null && typeof result.confidence === 'number' && result.confidence < 0.55;
      const needsUnavailableFallback = result == null && shouldAllowFallback(fallbackPolicy, 'unavailable');
      const needsLowConfidenceFallback = lowConfidence && shouldAllowFallback(fallbackPolicy, 'low-confidence');
      if (needsUnavailableFallback || needsLowConfidenceFallback) {
        const fallback = await runBackend();
        if (fallback) {
          result = fallback;
          setStatus('fallback');
        }
      }
    }

    if (!result?.text?.trim()) {
      setStatus('idle');
      return;
    }

    const spacer = value.trim().length > 0 ? ' ' : '';
    onApply(`${value}${spacer}${result.text.trim()}`);
    onRecognitionMeta?.(result);
    clear();
    setStatus('applied');
  };

  const scheduleAutoRecognition = () => {
    if (autoRecognizeTimerRef.current !== null) {
      window.clearTimeout(autoRecognizeTimerRef.current);
      autoRecognizeTimerRef.current = null;
    }
    autoRecognizeTimerRef.current = window.setTimeout(() => {
      void runRecognition();
    }, 260);
  };

  useEffect(() => {
    return () => {
      if (autoRecognizeTimerRef.current !== null) {
        window.clearTimeout(autoRecognizeTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      <div id={`veit-hw-pad-${id}`} className="space-y-2 rounded-xl border border-border/70 bg-muted/10 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">{statusText}</span>
        </div>
        {value.trim() ? (
          <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
            {value}
          </div>
        ) : null}
          <canvas
            ref={canvasRef}
            width={820}
            height={220}
            className="h-[220px] w-full touch-none rounded-lg border border-border/70 bg-white"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => {
              onPointerUp(e);
              scheduleAutoRecognition();
            }}
            onPointerCancel={(e) => {
              onPointerCancel(e);
              scheduleAutoRecognition();
            }}
          />
      </div>
    </div>
  );
}

function ToggleInField({
  pressed,
  label,
  disabled,
  onClick,
}: {
  pressed: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`absolute right-2 top-2 z-10 inline-flex h-9 min-h-9 min-w-9 items-center justify-center rounded-lg border shadow-sm backdrop-blur-sm transition disabled:pointer-events-none disabled:opacity-50 ${
        pressed
          ? 'border-primary/55 bg-primary/12 text-primary'
          : 'border-outline-variant/50 bg-surface/90 text-on-surface-variant hover:border-primary/35 hover:bg-surface-container-low hover:text-primary'
      }`.trim()}
    >
      {pressed ? <Keyboard className="h-4 w-4" aria-hidden /> : <PenLine className="h-4 w-4" aria-hidden />}
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function VeitHandwritingTextarea({
  value,
  onChange,
  disabled,
  className,
  languageHint,
  recognitionMode,
  fallbackPolicy,
  onRecognitionMeta,
  recognizer,
  onBackendRecognize,
  enableHandwriting = true,
  handwritingToggleLabel = 'Handschrift',
  ...rest
}: VeitHandwritingTextareaProps) {
  const [open, setOpen] = useState(false);
  const [focusOnTextInput, setFocusOnTextInput] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const areaClass = className ?? '';

  useEffect(() => {
    if (!focusOnTextInput || open) return;
    const frame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    setFocusOnTextInput(false);
    return () => window.cancelAnimationFrame(frame);
  }, [focusOnTextInput, open]);

  if (!enableHandwriting) {
    return (
      <textarea
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={areaClass}
      />
    );
  }
  return (
    <div className="space-y-2">
      {open ? (
        <div className="relative">
          <ToggleInField
            pressed={open}
            label={handwritingToggleLabel}
            disabled={disabled}
            onClick={() => {
              setFocusOnTextInput(true);
              setOpen(false);
            }}
          />
        <VeitHandwritingPad
          value={value}
          onApply={onChange}
          languageHint={languageHint}
          recognitionMode={recognitionMode}
          fallbackPolicy={fallbackPolicy}
          onRecognitionMeta={onRecognitionMeta}
          recognizer={recognizer}
          onBackendRecognize={onBackendRecognize}
          disabled={disabled}
        />
        </div>
      ) : (
        <div className="relative">
          <textarea
            {...rest}
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`${areaClass} pr-12`.trim()}
          />
          <ToggleInField
            pressed={open}
            label={handwritingToggleLabel}
            disabled={disabled}
            onClick={() => setOpen(true)}
          />
        </div>
      )}
    </div>
  );
}

function resolveFeatureEnabled(
  explicitEnabled: boolean | undefined,
  featureEnvVar: string | undefined,
  featureStorageKey: string | undefined,
): boolean {
  if (typeof explicitEnabled === 'boolean') return explicitEnabled;
  const envValue = String(featureEnvVar ?? '').toLowerCase();
  const envEnabled =
    envValue === ''
      ? true
      : envValue === '1' || envValue === 'true' || envValue === 'yes' || envValue === 'on';
  if (typeof window === 'undefined' || !featureStorageKey) return envEnabled;
  const raw = window.localStorage.getItem(featureStorageKey);
  if (!raw) return envEnabled;
  const normalized = raw.toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function VeitSmartHandwritingTextarea({
  featureEnabled,
  featureEnvVar,
  featureStorageKey = 'plenivo.feature.handwriting',
  ...props
}: VeitSmartTextareaProps) {
  const enabled = resolveFeatureEnabled(featureEnabled, featureEnvVar, featureStorageKey);
  return <VeitHandwritingTextarea {...props} enableHandwriting={enabled} />;
}
