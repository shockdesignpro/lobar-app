// Ranglar eski ilovadan (curtain-app/css/style.css va mobile.css) ko'chirilgan.
// Dizayn o'zgarishi faqat egasining tasdig'i bilan qilinadi.
// Tasdiqlangan qoidalar: shtrix (uzuq) chiziq yo'q; ekranlar responsive, eniga aylantirish yo'q.

export const light = {
  teal: '#0d7a5f',
  tealLight: '#e6f5f1',
  tealMid: '#1a9e7a',
  tealDark: '#095c47',
  amber: '#9a6510',
  amberLight: '#fef6e6',
  purple: '#5a4fd0',
  purpleLight: '#f0eeff',
  red: '#c43535',
  redLight: '#fdeaea',
  blue: '#1a6fb5',
  blueLight: '#e8f2fc',
  grey: '#5f7369',
  greyLight: '#eef1f0',
  bg: '#f4f6f5',
  card: '#ffffff',
  input: '#f4f6f5',
  text: '#1a2420',
  muted: '#5f7369',
  border: '#dde8e4',
  divider: '#edf2f0',
  topbar: '#ffffff',
  primaryButton: '#0d7a5f',
  primaryButtonText: '#ffffff',
  switchOff: '#cfd9d5',
  loginBg: ['#0b6a52', '#0d7a5f', '#1a9e7a'] as readonly [string, string, string],
};

// Tungi rejim: mobile.css dagi #mobile-shell qiymatlari
export const dark: typeof light = {
  teal: '#90b9a7',
  tealLight: '#20382e',
  tealMid: '#254c3d',
  tealDark: '#b5d6c8',
  amber: '#f0b23e',
  amberLight: '#3a2f12',
  purple: '#a396ff',
  purpleLight: '#241f3a',
  red: '#ef6b6b',
  redLight: '#3a1717',
  blue: '#5aa8ea',
  blueLight: '#122a3d',
  grey: '#8ba296',
  greyLight: '#222a24',
  bg: '#111613',
  card: '#1a2119',
  input: '#141a16',
  text: '#eef4f0',
  muted: '#8ba296',
  border: '#2a332c',
  divider: '#232b25',
  topbar: '#19372c',
  primaryButton: '#284e3e',
  primaryButtonText: '#eef4f0',
  switchOff: '#3a453d',
  loginBg: ['#0f2a21', '#19372c', '#254c3d'] as readonly [string, string, string],
};

export type Theme = typeof light;

export const radius = { card: 15, small: 8, button: 12 };

/** Kontent eng ko'pi bilan shu kenglikda, katta ekranda o'rtada turadi. */
export const CONTENT_MAX_WIDTH = 640;
