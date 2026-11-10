import { useEffect, useRef } from 'react';
import type { Modality } from '../../types/api';

export function RetinalModel({ modality }: { modality: Modality }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const name = modality === 'OCT' ? 'Retinal layers' : 'Retinal surface';
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const lifecycle = { cancelled: false, started: false, dispose: undefined as (() => void) | undefined };
    // Keep the two card renderers out of the initial eye journey's startup work.
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || lifecycle.started) return;
      lifecycle.started = true;
      import('./retinalModelScene').then(({ createRetinalModel }) => {
        if (lifecycle.cancelled) return;
        try { lifecycle.dispose = createRetinalModel(host, modality); }
        catch { host.dataset.renderer = 'fallback'; }
      }).catch(() => { if (!lifecycle.cancelled) host.dataset.renderer = 'fallback'; });
    }, { rootMargin: '250px' });
    observer.observe(host);
    return () => { lifecycle.cancelled = true; observer.disconnect(); lifecycle.dispose?.(); };
  }, [modality]);

  return <figure className="pathway-visual pathway-model">
    <div ref={hostRef} className="retinal-model" data-modality={modality} role="img" aria-label={modality === 'OCT' ? 'Illustrative three-dimensional cross-section of retinal tissue, showing layered surfaces and depth.' : 'Illustrative three-dimensional retinal bowl, with curved tissue and branching blood vessels.'}>
      <img className="retinal-model-poster" src={`/images/${modality.toLowerCase()}-model-poster.webp`} alt="" loading="lazy" decoding="async" />
    </div>
    <figcaption>{name}</figcaption>
  </figure>;
}
