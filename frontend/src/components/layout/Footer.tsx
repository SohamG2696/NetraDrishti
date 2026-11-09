import { ArrowUpRight } from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
const currentYear = new Date().getFullYear();
export function Footer() {
  return <footer className="site-footer"><div className="page-container">
    <div className="footer-top"><div><div className="brand footer-brand"><BrandMark /><span>netra<span className="brand-light">drishti</span></span></div><p>A closer look. A clearer perspective.</p></div><div className="footer-links"><a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">Documentation <ArrowUpRight size={14} /></a><span>OCT + FUNDUS · RETINAL IMAGING</span></div></div>
    <div className="footer-bottom"><span>© {currentYear} NetraDrishti</span><p>For research and education only. Not a substitute for professional clinical evaluation.</p><span>DESIGNED WITH VISION <span className="accent-text">↗</span></span></div>
  </div></footer>;
}
