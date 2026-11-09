import { Eye, Layers } from 'lucide-react';
import type { Modality } from '../../types/api';
interface ModalitySelectorProps { selectedModality: Modality; onSelectModality: (modality: Modality) => void; disabled?: boolean; }
export function ModalitySelector({ selectedModality, onSelectModality, disabled = false }: ModalitySelectorProps) {
  return <div>
    <div className="modality-selector" role="group" aria-label="Select imaging modality">
      <button type="button" className={`modality-choice ${selectedModality === 'OCT' ? 'is-selected' : ''}`} aria-pressed={selectedModality === 'OCT'} disabled={disabled} onClick={() => onSelectModality('OCT')}><Layers /><span><strong>OCT tomography</strong><small>A VIEW OF THE RETINAL LAYERS</small></span><i className="modality-radio" /></button>
      <button type="button" className={`modality-choice ${selectedModality === 'Fundus' ? 'is-selected' : ''}`} aria-pressed={selectedModality === 'Fundus'} disabled={disabled} onClick={() => onSelectModality('Fundus')}><Eye /><span><strong>Fundus photography</strong><small>A VIEW OF THE RETINAL SURFACE</small></span><i className="modality-radio" /></button>
    </div>
  </div>;
}
