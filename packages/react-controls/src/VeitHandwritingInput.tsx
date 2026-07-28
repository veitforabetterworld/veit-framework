import { useEffect, useId, useMemo, useRef, useState, type PointerEvent, type TextareaHTMLAttributes } from 'react';
import { Keyboard, PenLine } from 'lucide-react';

export type VeitHandwritingPoint = {
  x: number;
  y: number;
  t: number;
  pressure: number;
};

export type VeitHandwritingStroke = VeitHandwritingPoint[];

export type VeitHandwritingRecognizeRequest = {
  strokes: VeitHandwritingStroke[];
  imageDataUrl: string;
  languageHint?: string;
};

export type VeitHandwritingRecognitionResult = {
  text: string;
  confidence?: number;
  detectedLanguage?: string;
};

export type VeitHandwritingRecognizeTransport = (req: {
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

export function createVeitHandwritingRecognizer(
  transport: VeitHandwritingRecognizeTransport,
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
    };
  };
}

type SharedProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  languageHint?: string;
  onRecognitionMeta?: (meta: VeitHandwritingRecognitionResult) => void;
  onRecognize?: (
    req: Pick<VeitHandwritingRecognizeRequest, 'imageDataUrl' | 'languageHint'>,
  ) => Promise<VeitHandwritingRecognitionResult | null>;
  enableHandwriting?: boolean;
  handwritingToggleLabel?: string;
  clearLabel?: string;
  recognitionErrorLabels?: Record<string, string>;
  recognitionErrorFallback?: string;
};

type VeitHandwritingTextareaProps = SharedProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'className' | 'disabled'>;

type VeitSmartTextareaProps = Omit<VeitHandwritingTextareaProps, 'enableHandwriting'> & {
  featureEnabled?: boolean;
  featureEnvVar?: string;
  featureStorageKey?: string;
};

type DrawState = 'idle' | 'writing' | 'recognizing' | 'applied' | 'error';

function canvasCssSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  return { width: canvas.width / dpr, height: canvas.height / dpr };
}

function syncCanvasSize(canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const dpr = window.devicePixelRatio || 1;
  const nextW = Math.max(1, Math.round(rect.width * dpr));
  const nextH = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width === nextW && canvas.height === nextH) return;
  canvas.width = nextW;
  canvas.height = nextH;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawStrokes(
  canvas: HTMLCanvasElement,
  strokes: VeitHandwritingStroke[],
  activeStroke: VeitHandwritingStroke | null,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvasCssSize(canvas);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgb(255 255 255)';
  ctx.fillRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const all = activeStroke && activeStroke.length > 0 ? [...strokes, activeStroke] : strokes;
  for (const stroke of all) {
    if (stroke.length === 0) continue;
    const first = stroke[0];
    if (!first) continue;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < stroke.length; i++) {
      const p = stroke[i];
      if (!p) continue;
      ctx.lineWidth = Math.max(1.2, 2 + p.pressure * 2.2);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgb(17 24 39)';
    ctx.stroke();
  }
}

function useHandwritingPad(active: boolean) {
  const [status, setStatus] = useState<DrawState>('idle');
  const [strokes, setStrokes] = useState<VeitHandwritingStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<VeitHandwritingStroke | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef(strokes);
  const activeStrokeRef = useRef(activeStroke);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    activeStrokeRef.current = activeStroke;
  }, [activeStroke]);

  const clear = () => {
    setStrokes([]);
    setActiveStroke(null);
    setStatus('idle');
  };

  const redraw = (nextStrokes: VeitHandwritingStroke[], nextActiveStroke: VeitHandwritingStroke | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncCanvasSize(canvas);
    drawStrokes(canvas, nextStrokes, nextActiveStroke);
  };

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const refresh = () => redraw(strokesRef.current, activeStrokeRef.current);
    refresh();
    const ro = new ResizeObserver(refresh);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [active]);

  const toPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    syncCanvasSize(canvas);
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
      t: Date.now(),
      pressure: Number.isFinite(e.pressure) && e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== 'pen' && e.pointerType !== 'touch' && e.pointerType !== 'mouse') return;
    e.preventDefault();
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const s: VeitHandwritingStroke = [toPoint(e)];
    setActiveStroke(s);
    setStatus('writing');
    redraw(strokesRef.current, s);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current == null || pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    const current = activeStrokeRef.current;
    if (!current) return;
    const next = [...current, toPoint(e)];
    setActiveStroke(next);
    redraw(strokesRef.current, next);
  };

  const finishStroke = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current == null || pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    const current = activeStrokeRef.current;
    if (current && current.length > 0) {
      const nextStrokes = [...strokesRef.current, current];
      setStrokes(nextStrokes);
      setActiveStroke(null);
      redraw(nextStrokes, null);
    }
  };

  const getImageDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    syncCanvasSize(canvas);
    redraw(strokesRef.current, activeStrokeRef.current);
    return canvas.toDataURL('image/png');
  };

  const canRecognize = strokes.length > 0;

  return {
    status,
    setStatus,
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
  onRecognitionMeta,
  onRecognize,
  disabled,
  recognitionErrorLabels,
  recognitionErrorFallback = 'Erkennung fehlgeschlagen',
}: {
  value: string;
  onApply: (next: string) => void;
  languageHint?: string;
  onRecognitionMeta?: (meta: VeitHandwritingRecognitionResult) => void;
  onRecognize?: (
    req: Pick<VeitHandwritingRecognizeRequest, 'imageDataUrl' | 'languageHint'>,
  ) => Promise<VeitHandwritingRecognitionResult | null>;
  disabled?: boolean;
  recognitionErrorLabels?: Record<string, string>;
  recognitionErrorFallback?: string;
}) {
  const id = useId();
  const {
    status,
    setStatus,
    clear,
    canvasRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    canRecognize,
    getImageDataUrl,
  } = useHandwritingPad(true);
  const autoRecognizeTimerRef = useRef<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusText = useMemo(() => {
    if (status === 'error') return errorMessage ?? recognitionErrorFallback;
    if (status === 'writing') return 'Schreiben...';
    if (status === 'recognizing') return 'Erkenne...';
    if (status === 'applied') return 'Uebernommen';
    return 'Bereit';
  }, [errorMessage, recognitionErrorFallback, status]);

  const resolveRecognitionError = (err: unknown): string => {
    if (err instanceof Error && err.message) {
      const mapped = recognitionErrorLabels?.[err.message];
      if (mapped) return mapped;
      if (err.message.startsWith('handwriting.')) return recognitionErrorFallback;
    }
    return recognitionErrorFallback;
  };

  const runRecognition = async () => {
    if (!canRecognize || disabled) return;
    if (!onRecognize) {
      setErrorMessage(recognitionErrorFallback);
      setStatus('error');
      return;
    }
    const imageDataUrl = getImageDataUrl();
    if (!imageDataUrl) return;
    setStatus('recognizing');
    setErrorMessage(null);

    try {
      const result = await onRecognize({ imageDataUrl, languageHint });
      if (!result?.text?.trim()) {
        setStatus('idle');
        return;
      }

      onApply(result.text.trim());
      onRecognitionMeta?.(result);
      clear();
      setStatus('applied');
    } catch (err) {
      setErrorMessage(resolveRecognitionError(err));
      setStatus('error');
    }
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
          <span
            className={`text-[11px] ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
            role={status === 'error' ? 'alert' : undefined}
          >
            {statusText}
          </span>
        </div>
        {value.trim() ? (
          <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
            {value}
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
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

function insertRecognizedText(value: string, recognized: string, selection: { start: number; end: number } | null): string {
  const text = recognized.trim();
  if (!text) return value;
  if (!selection) {
    const spacer = value.trim().length > 0 ? ' ' : '';
    return `${value}${spacer}${text}`;
  }
  const before = value.slice(0, selection.start);
  const after = value.slice(selection.end);
  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
  const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
  const prefix = needsSpaceBefore ? ' ' : '';
  const suffix = needsSpaceAfter ? ' ' : '';
  return `${before}${prefix}${text}${suffix}${after}`;
}

export function VeitHandwritingTextarea({
  value,
  onChange,
  disabled,
  className,
  languageHint,
  onRecognitionMeta,
  onRecognize,
  enableHandwriting = true,
  handwritingToggleLabel = 'Handschrift',
  recognitionErrorLabels,
  recognitionErrorFallback,
  ...rest
}: VeitHandwritingTextareaProps) {
  const [open, setOpen] = useState(false);
  const [focusOnTextInput, setFocusOnTextInput] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const areaClass = className ?? '';

  useEffect(() => {
    if (!focusOnTextInput || open) return;
    const frame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    setFocusOnTextInput(false);
    return () => window.cancelAnimationFrame(frame);
  }, [focusOnTextInput, open]);

  const captureSelection = () => {
    const ta = textareaRef.current;
    if (!ta) {
      selectionRef.current = null;
      return;
    }
    selectionRef.current = { start: ta.selectionStart, end: ta.selectionEnd };
  };

  const applyRecognized = (recognized: string) => {
    onChange(insertRecognizedText(value, recognized, selectionRef.current));
  };

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
            onApply={applyRecognized}
            languageHint={languageHint}
            onRecognitionMeta={onRecognitionMeta}
            onRecognize={onRecognize}
            disabled={disabled}
            recognitionErrorLabels={recognitionErrorLabels}
            recognitionErrorFallback={recognitionErrorFallback}
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
            onClick={() => {
              captureSelection();
              setOpen(true);
            }}
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
