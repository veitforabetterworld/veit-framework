/**
 * User-Agent labels for session and device lists. Pure (no Node, no DOM), so the server ('@veit/auth-server') and
 * the browser ('@veit/react-account') use the same parser.
 */

export type VeitBrowserKind =
  | 'firefox'
  | 'edge'
  | 'opera'
  | 'chromium'
  | 'chrome'
  | 'safari'
  | 'brave'
  | 'vivaldi'
  | 'samsung'
  | 'tor'
  | 'ie'
  | 'curl'
  | 'unknown';

export type VeitOsKind = 'windows' | 'macos' | 'ios' | 'ipados' | 'android' | 'chromeos' | 'linux' | 'unknown';

/** Icon slot of a session or device row; `app` is set by the host (e.g. its own device name), never parsed. */
export type VeitClientKind = 'browser' | 'app' | 'android' | 'ios' | 'desktop' | 'unknown';

export type VeitUserAgentInfo = {
  browser: VeitBrowserKind;
  /** "Firefox", "Samsung Internet"; '' when unknown. */
  browserName: string;
  os: VeitOsKind;
  /** "Windows", "iOS"; '' when unknown. */
  osName: string;
};

const BROWSER_NAMES: Record<VeitBrowserKind, string> = {
  firefox: 'Firefox',
  edge: 'Edge',
  opera: 'Opera',
  chromium: 'Chromium',
  chrome: 'Chrome',
  safari: 'Safari',
  brave: 'Brave',
  vivaldi: 'Vivaldi',
  samsung: 'Samsung Internet',
  tor: 'Tor Browser',
  ie: 'Internet Explorer',
  curl: 'curl',
  unknown: '',
};

const OS_NAMES: Record<VeitOsKind, string> = {
  windows: 'Windows',
  macos: 'macOS',
  ios: 'iOS',
  ipados: 'iPadOS',
  android: 'Android',
  chromeos: 'ChromeOS',
  linux: 'Linux',
  unknown: '',
};

/** Display name of a browser kind; '' for unknown. */
export function browserKindName(kind: VeitBrowserKind): string {
  return BROWSER_NAMES[kind];
}

/** Display name of an OS kind; '' for unknown. */
export function osKindName(kind: VeitOsKind): string {
  return OS_NAMES[kind];
}

// Order matters: most Chromium browsers also send "Chrome/" and "Safari/", Edge and Opera too.
function browserOf(ua: string): VeitBrowserKind {
  if (/curl\//i.test(ua)) return 'curl';
  if (/Brave\/| Brave /.test(ua)) return 'brave';
  if (/Vivaldi\//.test(ua)) return 'vivaldi';
  if (/SamsungBrowser\//.test(ua)) return 'samsung';
  if (/Tor Browser|TorBrowser\//.test(ua)) return 'tor';
  if (/Edg\/|EdgA\/|EdgiOS\/|Edge\//.test(ua)) return 'edge';
  if (/OPR\/|OPiOS\/|Opera\//.test(ua)) return 'opera';
  if (/(Firefox|FxiOS)\//.test(ua) && !/Seamonkey/i.test(ua)) return 'firefox';
  if (/Chromium\//.test(ua)) return 'chromium';
  if (/(Chrome|CriOS)\//.test(ua)) return 'chrome';
  if (/MSIE |Trident\//.test(ua)) return 'ie';
  if (/Safari\//.test(ua)) return 'safari';
  return 'unknown';
}

// iOS sends "like Mac OS X", Android sends "Linux": check them first.
function osOf(ua: string): VeitOsKind {
  if (/Windows/.test(ua)) return 'windows';
  if (/Android/.test(ua)) return 'android';
  if (/iPad/.test(ua)) return 'ipados';
  if (/iPhone|iPod/.test(ua)) return 'ios';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macos';
  if (/Linux/.test(ua)) return 'linux';
  return 'unknown';
}

/** Browser and operating system of a User-Agent header. */
export function parseUserAgent(userAgent: string | null | undefined): VeitUserAgentInfo {
  const ua = userAgent ?? '';
  const browser = ua ? browserOf(ua) : 'unknown';
  const os = ua ? osOf(ua) : 'unknown';
  return { browser, browserName: BROWSER_NAMES[browser], os, osName: OS_NAMES[os] };
}

/** A short label for a session list: "Firefox · Windows", "Safari · iOS"; the raw start of an unknown agent. */
export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return '';
  const { browserName, osName } = parseUserAgent(userAgent);
  if (browserName && osName) return `${browserName} · ${osName}`;
  return browserName || osName || userAgent.slice(0, 60);
}

export type VeitClientKindOptions = {
  /** The device name the client sent (e.g. 'Plenivo-App'). */
  deviceName?: string | null;
  /** Device names of the host's own apps; a match gives `app`. */
  appDeviceNames?: readonly string[];
};

/**
 * The icon slot of a session: `app` for the host's own app (by device name), `browser` for a known browser, else by
 * the system (`android`, `ios`, `desktop`), `unknown` without a hint.
 */
export function clientKindFromUserAgent(userAgent: string | null | undefined, options: VeitClientKindOptions = {}): VeitClientKind {
  const deviceName = options.deviceName?.trim();
  if (deviceName && options.appDeviceNames?.includes(deviceName)) return 'app';
  const { browser, os } = parseUserAgent(userAgent);
  if (browser !== 'unknown' && browser !== 'curl') return 'browser';
  if (os === 'android') return 'android';
  if (os === 'ios' || os === 'ipados') return 'ios';
  if (os === 'windows' || os === 'macos' || os === 'linux' || os === 'chromeos') return 'desktop';
  return 'unknown';
}
