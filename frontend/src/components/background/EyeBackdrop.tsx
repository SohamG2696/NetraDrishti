import { useEffect, useRef, useState } from 'react';
import { anatomyStops } from './anatomyJourney';

interface EyeBackdropProps { workspace: boolean; chapter: number; }

/** Load and display the single interactive 3D WebGL eye directly on startup. */
export function EyeBackdrop({ workspace, chapter }: EyeBackdropProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const lifecycle = {
      cancelled: false,
      rafId: 0,
      dispose: undefined as (() => void) | undefined,
    };
    const triggerFallback = () => {
      if (lifecycle.cancelled) return;
      host.dataset.renderer = 'fallback';
      setFallback(true);
    };
    host.dataset.renderer = 'loading';
        // Start importing the 3D scene immediately while yielding one paint frame for hero copy.
        const modulePromise = import('./eyeScene');
        lifecycle.rafId = requestAnimationFrame(() => {
          modulePromise.then(({ createEyeScene }) => {
            if (lifecycle.cancelled) return;
                  try {
                    lifecycle.dispose = createEyeScene(
                      host,
                      () => ({
                        workspace: host.dataset.view === 'workspace',
                        chapter: Number(host.dataset.chapter || 0),
              }),
              triggerFallback,
          );
        } catch {
          triggerFallback();
        }
    }).catch(triggerFallback);
});
return () => {
  lifecycle.cancelled = true;
  cancelAnimationFrame(lifecycle.rafId);
  lifecycle.dispose?.();
};
  }, []);

return <div ref={hostRef} className="eye-backdrop" data-view={workspace ? 'workspace' : 'landing'} data-chapter={chapter} aria-hidden="true">
  {fallback && <div className="eye-poster"><img src="/images/eye-initial.webp" alt="" decoding="async" /></div>}
  <div className="eye-scene-vignette" />
  {anatomyStops.filter(part => part.id !== 'overview').map(part => <div className="eye-scene-label" data-part={part.id} key={part.id}><i />{part.name}</div>)}
</div>;
}
