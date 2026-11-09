import { useEffect, useRef } from 'react';
import { anatomyStops } from './anatomyJourney';

interface EyeBackdropProps { workspace: boolean; chapter: number; }

/** The photographic first frame stays visible until every 3D material is ready. */
export function EyeBackdrop({ workspace, chapter }: EyeBackdropProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const lifecycle = { cancelled: false, dispose: undefined as (() => void) | undefined };
    host.dataset.renderer = 'loading';
    import('./eyeScene').then(({ createEyeScene }) => {
      if (lifecycle.cancelled) return;
      try {
        lifecycle.dispose = createEyeScene(host, () => ({
          workspace: host.dataset.view === 'workspace',
          chapter: Number(host.dataset.chapter || 0),
        }));
      } catch { host.dataset.renderer = 'fallback'; }
    }).catch(() => { if (!lifecycle.cancelled) host.dataset.renderer = 'fallback'; });
    return () => { lifecycle.cancelled = true; lifecycle.dispose?.(); };
  }, []);

  return <div ref={hostRef} className="eye-backdrop" data-view={workspace ? 'workspace' : 'landing'} data-chapter={chapter} aria-hidden="true">
    <div className="eye-poster"><img src="/images/eye-initial.webp" alt="" fetchPriority="high" decoding="async" /></div>
    <div className="eye-scene-vignette" />
    {anatomyStops.filter(part => part.id !== 'overview').map(part => <div className="eye-scene-label" data-part={part.id} key={part.id}><i />{part.name}</div>)}
  </div>;
}
