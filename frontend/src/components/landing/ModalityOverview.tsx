import { ArrowUpRight, Layers, ScanEye } from 'lucide-react';
import type { Modality } from '../../types/api';
import { Reveal } from '../common/Reveal';

const pathways = [
  { modality: 'OCT' as Modality, number: '01', title: 'Beneath the surface.', subtitle: 'OCT IMAGING', description: 'A closer look at the layers within the retina.', image: '/images/oct-preview.webp', alt: 'Sample OCT scan showing a cross-section of the retinal layers', action: 'Explore OCT analysis' },
  { modality: 'Fundus' as Modality, number: '02', title: 'The wider picture.', subtitle: 'FUNDUS PHOTOGRAPHY', description: 'A detailed view of the retinal surface.', image: '/images/fundus-preview.webp', alt: 'Sample fundus photograph showing the retinal surface and branching blood vessels', action: 'Explore fundus screening' },
];

export function ModalityOverview({ onSelectModality }: { onSelectModality: (modality: Modality) => void }) {
  return <>
    <div className="capability-strip page-container">
      <div><span className="stat-value">02</span><span>Ways to look deeper<br /><small>OCT and fundus imaging</small></span></div>
      <div><ScanEye className="capability-icon" /><span>A clearer perspective<br /><small>Images, insights and context</small></span></div>
      <div><span className="stat-symbol">◎</span><span>Your images stay private<br /><small>Uploaded scans are not saved</small></span></div>
    </div>
    <section id="imaging" className="imaging-section page-container section-spacing" aria-labelledby="imaging-title">
      <Reveal className="section-heading"><div><p className="eyebrow"><span className="section-number">01 /</span> TWO WAYS TO SEE MORE</p><h2 id="imaging-title">A different lens.<br />The same <span className="serif-accent">attention to detail.</span></h2></div><p>Choose the perspective that matches your image.<br />Each pathway is built for its own kind of insight.</p></Reveal>
      <div className="pathway-grid">{pathways.map((path, index) => <Reveal className="pathway-card" delay={index * .1} key={path.modality}>
        <div className="pathway-card-top"><span>{path.modality === 'OCT' ? <Layers size={18} /> : <ScanEye size={18} />}{path.subtitle}</span><span>{path.number}</span></div>
        <figure className={`pathway-visual pathway-scan pathway-scan-${path.modality.toLowerCase()}`}><img src={path.image} alt={path.alt} width={path.modality === 'OCT' ? 1024 : 960} height={path.modality === 'OCT' ? 496 : 638} loading="lazy" decoding="async" /><figcaption>Sample {path.modality === 'OCT' ? 'OCT scan' : 'fundus image'}</figcaption></figure>
        <div className="pathway-content"><h3>{path.title}</h3><p>{path.description}</p></div>
        <button className="pathway-action" onClick={() => onSelectModality(path.modality)}>{path.action}<ArrowUpRight size={16} /></button>
      </Reveal>)}</div>
    </section>
  </>;
}
