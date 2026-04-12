export type VeitPersonRef = {
  id: number;
  /** Roher Anzeigename aus der API (darf leer sein). */
  displayName: string | null | undefined;
  /** Öffentliche Bild-URL oder `null`. */
  profileImageSrc?: string | null;
  subline?: string | null;
  /** Wenn `displayName` leer: sichtbarer Ersatz (z. B. `#42`). */
  labelHint?: string | null;
};

export type VeitAuthGroupModeOption = {
  value: string;
  label: string;
};
