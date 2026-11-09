import { VeitButton } from '@veit/react-controls';
import {
  VEIT_EXPORT_FORMATS,
  downloadExport,
  type VeitExportDocument,
  type VeitExportFormat,
} from '@veit/map/export';
import { useState } from 'react';

export type VeitExportButtonsProps = {
  /** Sichtbare Beschriftung und Name der Gruppe, z. B. „Verlauf herunterladen“. */
  label: string;
  /** Baut das Dokument erst beim Klick (darf Daten nachladen). */
  build: () => VeitExportDocument | Promise<VeitExportDocument>;
  /** Titel für den Dateinamen; Standard ist der Name des Dokuments. */
  fileTitle?: string;
  /** Angebotene Formate; Standard: alle (KML, GPX, GeoJSON). */
  formats?: readonly VeitExportFormat[];
  disabled?: boolean;
  /** Fehler beim Bauen (z. B. Netzwerk); der Host zeigt ihn an. */
  onError?: (error: unknown) => void;
};

/**
 * Download von Kartendaten in gängigen Formaten: ein Knopf je Format. Die Daten liefert der Host als neutrales
 * Exportdokument (@veit/map/export); Dateiname und MIME-Typ kommen vom Format.
 */
export function VeitExportButtons({ label, build, fileTitle, formats, disabled, onError }: VeitExportButtonsProps) {
  const [busy, setBusy] = useState<VeitExportFormat | null>(null);
  const offered = VEIT_EXPORT_FORMATS.filter((f) => !formats || formats.includes(f.format));

  const run = async (format: VeitExportFormat) => {
    setBusy(format);
    try {
      const doc = await build();
      downloadExport(doc, format, fileTitle ?? doc.name);
    } catch (error) {
      onError?.(error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {offered.map((f) => (
        <VeitButton
          key={f.format}
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || busy !== null}
          aria-busy={busy === f.format}
          onClick={() => void run(f.format)}
        >
          {f.label}
        </VeitButton>
      ))}
    </div>
  );
}
