import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Eski ilovadagi chiziqli (stroke) ikonkalar
export type IconName =
  | 'back' | 'moon' | 'sun' | 'lock' | 'shield' | 'plus' | 'home' | 'clock' | 'scissors'
  | 'receipt' | 'chevron' | 'users' | 'logout' | 'key' | 'search' | 'edit' | 'trash' | 'download' | 'upload';

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
      {name === 'key' && (<><Circle cx="7.5" cy="15.5" r="4.5" {...p} /><Path d="M10.7 12.3 21 2M17 6l3 3M14 9l2 2" {...p} /></>)}
    </Svg>
  );
}
