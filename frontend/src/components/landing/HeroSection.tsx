import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { ArrowDown, ArrowRight, ArrowUpRight, MoveDown } from 'lucide-react';
import { anatomyJourney, anatomyStops, clampProgress, journeyFrame } from '../background/anatomyJourney';
import type { Modality } from '../../types/api';

interface HeroSectionProps {
  onStartAnalysis: (modality?: Modality) => void;
  onChapterChange: (chapter: number) => void;
}

const motionQuery = '(prefers-reduced-motion: reduce)';
const getReducedMotion = () => window.matchMedia(motionQuery).matches;
const subscribeReducedMotion = (listener: () => void) => {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};

export function HeroSection({ onStartAnalysis, onChapterChange }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
  const [chapter, setChapter] = useState(0);
  const progress = useMotionValue(0);
  const introOpacity = useMotionValue(1);
  const detailOpacity = useMotionValue(0);
  const metrics = useRef({ start: 0, distance: 1 });

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const timing = { frame: 0, selected: -1 };
    const update = () => {
      timing.frame = 0;
      const value = reducedMotion ? anatomyJourney.get() : clampProgress((window.scrollY - metrics.current.start) / metrics.current.distance);
      anatomyJourney.set(value);
      progress.set(clampProgress(value * anatomyStops.length / (anatomyStops.length - 1)));
      const returning = clampProgress((value - .94) / .06);
      const intro = Math.max(1 - clampProgress(value / .095), returning * returning * (3 - 2 * returning));
      introOpacity.set(intro);
      detailOpacity.set(1 - intro);
      section.dataset.exploring = intro < .5 ? 'true' : 'false';
      const next = journeyFrame(value).index;
      if (next !== timing.selected) { timing.selected = next; setChapter(next); onChapterChange(next); }
    };
    const onScroll = () => { if (!timing.frame) timing.frame = requestAnimationFrame(update); };
    const measure = () => {
      const header = document.querySelector('header')?.getBoundingClientRect().height || 0;
      metrics.current = {
        start: section.getBoundingClientRect().top + window.scrollY - header,
        distance: Math.max(1, section.offsetHeight - window.innerHeight + header),
      };
      anatomyJourney.end = metrics.current.start + metrics.current.distance;
      update();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    measure();
    return () => { cancelAnimationFrame(timing.frame); observer.disconnect(); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', measure); };
  }, [reducedMotion, progress, introOpacity, detailOpacity, onChapterChange]);

  const goToChapter = (index: number) => {
    const value = index / anatomyStops.length;
    if (reducedMotion) {
      anatomyJourney.set(value); progress.set(index / (anatomyStops.length - 1)); setChapter(index); onChapterChange(index);
      return;
    }
    window.scrollTo({ top: metrics.current.start + metrics.current.distance * value, behavior: 'smooth' });
  };
  const part = anatomyStops[chapter];

  return <section ref={sectionRef} className="hero-scroll" aria-labelledby="hero-title">
    <div className="hero-sticky">
      <div className="hero-grid page-container">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot" /> A NEW PERSPECTIVE ON RETINAL HEALTH</div>
          <div className="hero-narrative">
            <motion.div className="hero-intro" style={{ opacity: introOpacity }}>
              <h1 id="hero-title" tabIndex={-1}>Look deeper.<br />See <span className="serif-accent">beyond.</span></h1>
              <p className="hero-description">An extraordinary organ.<br className="desktop-break" /> A more considered way to understand it.</p>
              <p className="hero-support">Explore AI-powered retinal analysis through OCT and fundus imaging. Built for discovery, designed for clarity.</p>
            </motion.div>
            <motion.div className="hero-anatomy-detail" style={{ opacity: detailOpacity }} aria-hidden="true">
              <span className="anatomy-kicker">FOLLOW THE ANATOMY / 0{chapter}</span>
              <p className={`anatomy-name serif-accent${part.id === 'ciliary' ? ' anatomy-name-long' : ''}`}>{part.name}<span>.</span></p>
              <p className="anatomy-heading">{part.title}</p>
              <p className="anatomy-body">{part.detail}</p>
            </motion.div>
          </div>
          <div className="hero-actions">
            <button className="button-primary" onClick={() => onStartAnalysis('OCT')}>Start analysis <ArrowUpRight size={18} /></button>
            <a className="button-text" href="#imaging">Explore the platform <ArrowDown size={15} /></a>
          </div>
          <div className="hero-footnote"><span className="tiny-cross">+</span> FOR RESEARCH. WITH VISION.</div>
        </div>
        <div className="eye-stage" role="img" aria-label={chapter === 0 ? 'Complete three-dimensional exploded eye. Scroll to bring each part into the centre and foreground.' : `The ${part.name.toLowerCase()} is moving into the centre and foreground. Continue scrolling to explore the next structure.`}>
          <div className="figure-index"><span>THE ANATOMY OF SIGHT</span><span>SCROLL TO EXPLORE</span></div>
          <div className="anatomy-caption"><span className="caption-number">0{chapter}</span><div><span className="eyebrow">{part.name}</span><p>{part.title}</p></div><span className="anatomy-caption-end">ANATOMICAL STUDY</span></div>
        </div>
      </div>
      <div className="hero-bottom page-container">
        <div className="scroll-invitation"><MoveDown size={17} /><span>ONE EYE.<br />A CONTINUOUS JOURNEY.</span></div>
        <nav className="anatomy-track" aria-label="Explore eye anatomy">
          <div className="anatomy-track-line"><motion.div style={{ scaleX: progress }} /></div>
          {anatomyStops.map((stop, index) => <button key={stop.id} className={chapter === index ? 'is-active' : ''} onClick={() => goToChapter(index)} aria-current={chapter === index ? 'step' : undefined} aria-label={`Explore ${stop.name}`}><i /><span>{stop.short}</span></button>)}
        </nav>
        <button className="hero-fundus-link" onClick={() => onStartAnalysis('Fundus')}>Fundus screening <ArrowRight size={14} /></button>
      </div>
      <div className="chapter-description page-container"><span className="sr-only" aria-live="polite">{part.name}. {part.detail}</span></div>
    </div>
  </section>;
}
