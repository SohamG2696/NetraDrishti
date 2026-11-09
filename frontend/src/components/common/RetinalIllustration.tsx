import { useId } from 'react';
export function RetinalIllustration({ variant }: { variant: 'OCT' | 'Fundus' }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 460 220" fill="none" className="retinal-illustration" aria-hidden="true">
    <defs><linearGradient id={`${id}-line`} x1="0" y1="0" x2="460" y2="220" gradientUnits="userSpaceOnUse"><stop stopColor="#d9b77c" /><stop offset="1" stopColor="#6c5a3b" /></linearGradient><radialGradient id={`${id}-fill`}><stop stopColor="#bd7d3d" stopOpacity=".25" /><stop offset="1" stopColor="#bd7d3d" stopOpacity="0" /></radialGradient></defs>
    <path d="M20 20h18M20 20v18M440 20h-18M440 20v18M20 200h18M20 200v-18M440 200h-18M440 200v-18" stroke="#625a4b" />
    {variant === 'OCT' ? <>
      {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M48 ${58 + i * 7} C110 ${33 + i * 7}, 155 ${50 + i * 7}, 188 ${69 + i * 5.7} S225 ${102 + i * 3.9}, 252 ${73 + i * 5.4} S330 ${38 + i * 7}, 412 ${55 + i * 7}`} stroke={`url(#${id}-line)`} strokeOpacity={0.25 + i * .045} strokeWidth={i === 12 ? 2.5 : 1} />)}
      <path d="M230 30v161" stroke="#d9b77c" strokeOpacity=".35" strokeDasharray="3 5" /><circle cx="230" cy="89" r="4" fill="#d9b77c" /><circle cx="230" cy="89" r="11" stroke="#d9b77c" strokeOpacity=".5" />
    </> : <>
      <circle cx="230" cy="110" r="97" fill={`url(#${id}-fill)`} /><circle cx="230" cy="110" r="83" stroke="#d9b77c" strokeOpacity=".25" /><circle cx="230" cy="110" r="92" stroke="#d9b77c" strokeOpacity=".3" strokeDasharray="2 6" />
      <g stroke={`url(#${id}-line)`} strokeLinecap="round"><path d="M201 116C220 89 233 79 255 74s35-17 39-30M202 115c23-2 40 14 53 33s29 23 36 30M201 113c-19-17-18-37-12-59M202 118c-17 15-23 28-22 48" strokeWidth="2.6" /><path d="M228 88c-3-16 2-29 11-42m10 29c14 5 27 1 40-7m-14-4 1-19m-43 83c9-6 25-7 41-2m-23 18c-2 12 3 25 9 33m-17-27c-8 6-13 19-11 30m-41-94-23-16m20 3 10-24m-12 91-16-7m14 19 9 22" strokeWidth="1.2" /></g>
      <ellipse cx="201" cy="116" rx="9" ry="12" fill="#d9b77c" fillOpacity=".3" stroke="#d9b77c" /><circle cx="250" cy="112" r="12" stroke="#d9b77c" strokeOpacity=".35" strokeDasharray="2 3" />
    </>}
    <text x="36" y="188" fill="#8a847b" fontSize="8" fontFamily="monospace" letterSpacing="2">{variant === 'OCT' ? 'CROSS-SECTION / SCHEMATIC' : 'RETINAL SURFACE / SCHEMATIC'}</text>
  </svg>;
}
