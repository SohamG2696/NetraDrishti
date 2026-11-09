import { ArrowUpRight, ChartNoAxesCombined, ScanLine, Upload, ShieldCheck, ChevronDown } from 'lucide-react';
import { Reveal } from '../common/Reveal';

const steps = [
  { icon: Upload, title: 'Add your image.', text: 'Choose OCT or fundus. Upload a scan or try a sample.', number: '01' },
  { icon: ScanLine, title: 'Take a closer look.', text: 'Start the analysis when your image is ready.', number: '02' },
  { icon: ChartNoAxesCombined, title: 'Explore your results.', text: 'See the findings and learn more about each result.', number: '03' },
];

export function TechnologyStack() {
  return <>
    <section id="how-it-works" className="workflow-section section-spacing" aria-labelledby="workflow-title"><div className="page-container">
      <Reveal className="section-heading"><div><p className="eyebrow"><span className="section-number">02 /</span> A CLEAR PATH FORWARD</p><h2 id="workflow-title">From image to <span className="serif-accent">understanding.</span></h2></div><span className="section-side-note">THREE STEPS. A CLOSER LOOK.</span></Reveal>
      <div className="workflow-grid">{steps.map(({ icon: Icon, title, text, number }, index) => <Reveal key={number} className="workflow-step" delay={index * .08}><div className="workflow-step-top"><Icon size={23} strokeWidth={1.3} /><span>{number}</span></div><h3>{title}</h3><p>{text}</p></Reveal>)}</div>
    </div></section>
    <section id="research" className="research-section section-spacing page-container" aria-labelledby="research-title">
      <Reveal className="research-intro"><p className="eyebrow"><span className="section-number">03 /</span> MADE FOR EXPLORATION</p><h2 id="research-title">A little clarity.<br /><span className="serif-accent">Before you begin.</span></h2><p>A simple space to explore retinal images and understand the findings.</p><a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="button-text">Documentation <ArrowUpRight size={16} /></a><div className="research-note"><ShieldCheck size={20} /><span>For research and learning.<small>Results need review by an eye-care professional.</small></span></div></Reveal>
      <Reveal className="research-details" delay={.1}>
        <details open><summary><span>Which image should I choose?</span><ChevronDown size={19} /></summary><div className="research-detail-body"><p>Use OCT for a view of the retinal layers, or fundus photography for the retinal surface. Samples are available for both.</p></div></details>
        <details><summary><span>What do the results mean?</span><ChevronDown size={19} /></summary><div className="research-detail-body"><p>Results highlight patterns for research and learning. They are not a diagnosis or a replacement for a professional eye examination.</p></div></details>
        <details><summary><span>Are my images saved?</span><ChevronDown size={19} /></summary><div className="research-detail-body"><p>Uploaded scans are used for the analysis and are not saved to disk.</p></div></details>
      </Reveal>
    </section>
  </>;
}
