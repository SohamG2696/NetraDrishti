import { useState } from 'react';
import { ArrowUpRight, Menu, RefreshCw, X } from 'lucide-react';
import { motion, useScroll } from 'framer-motion';
import type { HealthResponse } from '../../types/api';
import { BrandMark } from '../common/BrandMark';
interface HeaderProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  onRefreshHealth: () => void;
  activeView: 'landing' | 'workspace';
  onSelectView: (view: 'landing' | 'workspace') => void;
  onNavigateSection: (section: string) => void;
}
export function Header({ health, healthLoading, onRefreshHealth, activeView, onSelectView, onNavigateSection }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const isHealthy = health?.models_ready && health?.status === 'healthy';
  const selectView = (view: 'landing' | 'workspace') => { onSelectView(view); setMenuOpen(false); };
  const selectSection = (section: string) => { onNavigateSection(section); setMenuOpen(false); };
  return <header className="site-header">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="header-inner page-container">
      <button className="brand" onClick={() => selectView('landing')} aria-label="NetraDrishti home"><BrandMark /><span>Netra<span className="brand-light">Drishti</span><small>RETINAL INTELLIGENCE</small></span></button>
      <nav className="desktop-nav" aria-label="Main navigation"><button className={activeView === 'landing' ? 'nav-active' : ''} onClick={() => selectView('landing')} aria-current={activeView === 'landing' ? 'page' : undefined}>Overview</button><button onClick={() => selectSection('imaging')}>Imaging</button><button onClick={() => selectSection('how-it-works')}>How it works</button><button onClick={() => selectSection('research')}>Research</button></nav>
      <div className="header-actions">
        <button className={`health-indicator ${isHealthy ? 'is-ready' : ''}`} onClick={onRefreshHealth} disabled={healthLoading} title="Refresh analysis service status" aria-label={`Analysis service ${healthLoading ? 'checking' : isHealthy ? 'ready' : 'offline'}. Refresh status.`}>{healthLoading ? <RefreshCw size={11} className="animate-spin" /> : <span />}<span className="health-label">{healthLoading ? 'Checking' : isHealthy ? `Ready · ${health?.device?.toUpperCase() || 'CPU'}` : 'Service offline'}</span></button>
        <button className="header-cta" onClick={() => selectView('workspace')} aria-current={activeView === 'workspace' ? 'page' : undefined}>Open workspace <ArrowUpRight size={15} /></button>
        <button className="mobile-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-nav">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </div>
    {menuOpen && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation" onKeyDown={event => { if (event.key === 'Escape') setMenuOpen(false); }}><button onClick={() => selectView('landing')}>Overview</button><button onClick={() => selectSection('imaging')}>Imaging</button><button onClick={() => selectSection('how-it-works')}>How it works</button><button onClick={() => selectSection('research')}>Research</button><button onClick={() => selectView('workspace')}>Analysis workspace <ArrowUpRight size={16} /></button></nav>}
    <motion.div className="page-scroll-progress" style={{ scaleX: scrollYProgress }} />
  </header>;
}
