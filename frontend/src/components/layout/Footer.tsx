import { ArrowUpRight } from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { getApiDocsUrl } from '../../services/api';
const currentYear = new Date().getFullYear();
export function Footer() {
  const docsUrl = getApiDocsUrl();
  return <footer className="site-footer"><div className="page-container">
    <div className="footer-top"><div><div className="brand footer-brand"><BrandMark /><span>Netra<span className="brand-light">Drishti</span></span></div><p>A closer look. A clearer perspective.</p></div><div className="footer-links">{docsUrl && <a href={docsUrl} target="_blank" rel="noreferrer">Documentation <ArrowUpRight size={14} /></a>}<span>OCT + FUNDUS · RETINAL IMAGING</span></div></div>
    <div className="footer-bottom"><span>© {currentYear} NetraDrishti</span><p>For research and education only. Not a substitute for professional clinical evaluation.</p><span>DESIGNED WITH VISION <span className="accent-text">↗</span></span></div>
  </div></footer>;
}
