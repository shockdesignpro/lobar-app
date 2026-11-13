import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Eski ilovadagi chiziqli (stroke) ikonkalar
export type IconName =
  | 'back' | 'moon' | 'sun' | 'lock' | 'shield' | 'plus' | 'home' | 'clock' | 'scissors'
  | 'receipt' | 'chevron' | 'users' | 'logout' | 'key' | 'search' | 'edit' | 'trash' | 'download' | 'upload'
  | 'user' | 'layout' | 'door' | 'window' | 'close' | 'box' | 'wrench' | 'file' | 'arrowRight' | 'check' | 'share' | 'inbox' | 'image' | 'camera' | 'bell' | 'calendar' | 'cloud' | 'menu' | 'zap' | 'wallet' | 'undo' | 'pen' | 'flip';

export function Icon({ name, size = 20, color, strokeWidth = 1.8 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'back' && (<><Path d="M19 12H5" {...p} /><Path d="M12 19l-7-7 7-7" {...p} /></>)}
      {name === 'moon' && <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" {...p} />}
      {name === 'sun' && (<><Circle cx="12" cy="12" r="4" {...p} /><Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" {...p} /></>)}
      {name === 'lock' && (<><Rect x="4" y="10" width="16" height="11" rx="2" {...p} /><Path d="M7 10V7a5 5 0 0 1 10 0v3" {...p} /></>)}
      {name === 'shield' && <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...p} />}
      {name === 'plus' && (<><Path d="M12 5v14" {...p} /><Path d="M5 12h14" {...p} /></>)}
      {name === 'home' && (<><Path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" {...p} /><Path d="M3 8l9 5 9-5" {...p} /><Path d="M12 13v8" {...p} /></>)}
      {name === 'clock' && (<><Circle cx="12" cy="12" r="9" {...p} /><Path d="M12 7v5l3 2" {...p} /></>)}
      {name === 'scissors' && (<><Circle cx="6" cy="6" r="2.5" {...p} /><Circle cx="6" cy="18" r="2.5" {...p} /><Path d="M8.5 7.5 20 19" {...p} /><Path d="M8.5 16.5 20 5" {...p} /></>)}
      {name === 'receipt' && (<><Rect x="5" y="3" width="14" height="18" rx="2" {...p} /><Path d="M9 7h6M9 11h6M9 15h3" {...p} /></>)}
      {name === 'chevron' && <Path d="M9 6l6 6-6 6" {...p} />}
      {name === 'users' && (<><Circle cx="9" cy="8" r="4" {...p} /><Path d="M2 21c0-4 3-7 7-7s7 3 7 7" {...p} /><Path d="M16 3.5a4 4 0 0 1 0 8M22 21c0-3-1.7-5.5-4-6.5" {...p} /></>)}
      {name === 'logout' && (<><Path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" {...p} /><Path d="M10 17l-5-5 5-5" {...p} /><Path d="M5 12h12" {...p} /></>)}
      {name === 'search' && (<><Circle cx="11" cy="11" r="7" {...p} /><Path d="M21 21l-4.35-4.35" {...p} /></>)}
      {name === 'edit' && (<><Path d="M12 20h9" {...p} /><Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" {...p} /></>)}
      {name === 'trash' && (<><Path d="M3 6h18" {...p} /><Path d="M8 6V4h8v2" {...p} /><Path d="M19 6l-1 14H6L5 6" {...p} /><Path d="M10 11v6M14 11v6" {...p} /></>)}
      {name === 'download' && (<><Path d="M12 3v12" {...p} /><Path d="M7 10l5 5 5-5" {...p} /><Path d="M5 21h14" {...p} /></>)}
      {name === 'upload' && (<><Path d="M12 15V3" {...p} /><Path d="M7 8l5-5 5 5" {...p} /><Path d="M5 21h14" {...p} /></>)}
      {name === 'user' && (<><Circle cx="12" cy="8" r="4" {...p} /><Path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" {...p} /></>)}
      {name === 'layout' && (<><Rect x="3" y="4" width="18" height="16" rx="2" {...p} /><Path d="M3 10h18M9 10v10" {...p} /></>)}
      {name === 'door' && (<><Path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" {...p} /><Path d="M4 21h16" {...p} /><Path d="M14 12h.01" {...p} strokeWidth={2.6} /></>)}
      {name === 'window' && (<><Rect x="4" y="3" width="16" height="18" rx="1.5" {...p} /><Path d="M12 3v18M4 12h16" {...p} /></>)}
      {name === 'close' && <Path d="M18 6 6 18M6 6l12 12" {...p} />}
      {name === 'box' && (<><Path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" {...p} /><Path d="M3 8l9 5 9-5" {...p} /><Path d="M12 13v8" {...p} /></>)}
      {name === 'wrench' && <Path d="M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3a4 4 0 0 0-5-5L4 12l2.7-2.7a4 4 0 0 0 5-5z" {...p} />}
      {name === 'file' && (<><Path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" {...p} /><Path d="M14 3v6h6M8 13h8M8 17h5" {...p} /></>)}
      {name === 'arrowRight' && (<><Path d="M5 12h14" {...p} /><Path d="M12 5l7 7-7 7" {...p} /></>)}
      {name === 'check' && <Path d="M20 6 9 17l-5-5" {...p} />}
      {name === 'share' && (<><Circle cx="18" cy="5" r="3" {...p} /><Circle cx="6" cy="12" r="3" {...p} /><Circle cx="18" cy="19" r="3" {...p} /><Path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" {...p} /></>)}
      {name === 'image' && (<><Rect x="3" y="3" width="18" height="18" rx="2" {...p} /><Circle cx="8.5" cy="8.5" r="1.5" {...p} /><Path d="M21 15l-5-5L5 21" {...p} /></>)}
      {name === 'flip' && (<><Path d="M21 2v6h-6" {...p} /><Path d="M3 12a9 9 0 0 1 15-6.7L21 8" {...p} /><Path d="M3 22v-6h6" {...p} /><Path d="M21 12a9 9 0 0 1-15 6.7L3 16" {...p} /></>)}
      {name === 'camera' && (<><Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" {...p} /><Circle cx="12" cy="13" r="4" {...p} /></>)}
      {name === 'bell' && (<><Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...p} /><Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" {...p} /></>)}
      {name === 'calendar' && (<><Rect x="3" y="4" width="18" height="18" rx="2" {...p} /><Path d="M16 2v4M8 2v4M3 10h18" {...p} /></>)}
      {name === 'cloud' && (<><Path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z" {...p} /><Path d="M12 12v6M9 15l3-3 3 3" {...p} /></>)}
      {name === 'undo' && (<><Path d="M9 14 4 9l5-5" {...p} /><Path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" {...p} /></>)}
      {name === 'pen' && (<><Path d="M12 20h9" {...p} /><Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" {...p} /></>)}
      {name === 'wallet' && (<><Path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2.5" {...p} /><Path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" {...p} /></>)}
      {name === 'zap' && <Path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" {...p} />}
      {name === 'menu' && <Path d="M4 7h16M4 12h16M4 17h16" {...p} />}
      {name === 'inbox' && (<><Path d="M22 12h-6l-2 3h-4l-2-3H2" {...p} /><Path d="M5.5 5h13l3.5 7v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7Z" {...p} /></>)}
      {name === 'key' && (<><Circle cx="7.5" cy="15.5" r="4.5" {...p} /><Path d="M10.7 12.3 21 2M17 6l3 3M14 9l2 2" {...p} /></>)}
    </Svg>
  );
}
