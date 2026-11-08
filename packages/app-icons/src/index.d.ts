export type VeitWebManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose: 'any' | 'maskable';
};

/** Icons for the web manifest as `veit-app-icons` writes them into the web root. */
export declare const webManifestIcons: readonly VeitWebManifestIcon[];

/** Generates every icon branding/app-icons.json names; returns the written files. */
export declare function generateAppIcons(configPath: string, options?: { only?: 'web' | 'android' }): string[];
