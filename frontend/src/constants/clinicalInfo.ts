/**
 * Clinical Knowledge Base for NetraDrishti
 * Provides clinical context and patient-friendly descriptions
 * Note: Purely educational, not for clinical diagnosis.
 */

export interface ConditionInfo {
  code: string;
  name: string;
  fullName: string;
  category: string;
  urgency: 'Low' | 'Moderate' | 'High' | 'Normal';
  shortDescription: string;
  clinicalDescription: string;
  keyFeatures: string[];
}

export const OCT_CONDITIONS: Record<string, ConditionInfo> = {
  CNV: {
    code: 'CNV',
    name: 'Choroidal Neovascularization',
    fullName: 'Choroidal Neovascularization (Wet AMD)',
    category: 'Macular Degeneration',
    urgency: 'High',
    shortDescription: 'Abnormal capillary proliferation beneath the retinal pigment epithelium that may leak fluid or hemorrhage.',
    clinicalDescription: 'CNV represents pathological growth of new blood vessels stemming from the choroid through Bruch’s membrane into the sub-retinal or sub-RPE space. Frequently associated with exudative (wet) age-related macular degeneration (AMD). Prompt clinical evaluation is essential to prevent permanent photoreceptor atrophy.',
    keyFeatures: [
      'Subretinal / sub-RPE fluid accumulation',
      'Hyperreflective subretinal lesions',
      'Disruption of the external limiting membrane and ellipsoid zone',
      'Rapidly progressive central scotoma risk'
    ]
  },
  DME: {
    code: 'DME',
    name: 'Diabetic Macular Edema',
    fullName: 'Diabetic Macular Edema (DME)',
    category: 'Diabetic Retinal Disease',
    urgency: 'High',
    shortDescription: 'Retinal thickening and fluid pooling within the macula resulting from breakdown of the blood-retinal barrier in diabetes.',
    clinicalDescription: 'DME is characterized by microvascular leakage from retinal capillaries compromised by prolonged hyperglycemia. Fluid accumulation in intraretinal layers disrupts neuroretinal transmission in the fovea, remaining the leading cause of moderate vision impairment among working-age adults with diabetes.',
    keyFeatures: [
      'Cystoid macular spaces and diffuse neuroretinal thickening',
      'Hyperreflective intraretinal lipid exudates',
      'Loss of standard foveal depression contour',
      'Correlated with diabetic microvascular permeability'
    ]
  },
  DRUSEN: {
    code: 'DRUSEN',
    name: 'Retinal Drusen Deposits',
    fullName: 'Retinal Drusen (Dry AMD Precursor)',
    category: 'Macular Degeneration',
    urgency: 'Moderate',
    shortDescription: 'Focal extracellular deposits of lipid-rich proteinaceous debris beneath the retinal pigment epithelium.',
    clinicalDescription: 'Drusen are extracellular waste accumulations situated between the basal lamina of the retinal pigment epithelium (RPE) and Bruch’s membrane. They are hallmark biomarkers of early to intermediate dry age-related macular degeneration (non-exudative AMD) requiring routine ophthalmic surveillance.',
    keyFeatures: [
      'Convex dome-shaped elevations of the RPE layer',
      'Variable attenuation of overlying photoreceptor layers',
      'Gradual degeneration of retinal waste metabolic clearance',
      'Predictor of geographic atrophy or neovascular conversion'
    ]
  },
  NORMAL: {
    code: 'NORMAL',
    name: 'Normal Retinal Morphology',
    fullName: 'Unremarkable / Normal Retinal Architecture',
    category: 'Healthy',
    urgency: 'Normal',
    shortDescription: 'Well-preserved anatomical retinal stratification without detectable fluid, exudation, or architectural deformities.',
    clinicalDescription: 'The OCT B-scan displays intact neurosensory retinal layers, a well-contoured foveal pit, continuous external limiting membrane (ELM) and ellipsoid zone (EZ), and a continuous, uniform retinal pigment epithelium (RPE) without subretinal or intraretinal abnormalities.',
    keyFeatures: [
      'Preserved distinct 10-layer retinal stratification',
      'Intact symmetric foveal depression contour',
      'Continuous, uninterrupted RPE/Bruch’s membrane complex',
      'Absence of subretinal fluid or hyperreflective lesions'
    ]
  }
};

export const FUNDUS_DISEASES: Record<string, ConditionInfo> = {
  DR: {
    code: 'DR',
    name: 'Diabetic Retinopathy',
    fullName: 'Diabetic Retinopathy',
    category: 'Vascular Disease',
    urgency: 'High',
    shortDescription: 'Progressive microvascular damage to the retina induced by chronic hyperglycemia.',
    clinicalDescription: 'Characterized by microaneurysms, dot-and-blot retinal hemorrhages, hard exudates (lipid deposits), cotton-wool spots (nerve fiber layer infarcts), and in advanced stages, neovascularization (PDR).',
    keyFeatures: ['Microaneurysms', 'Intraretinal hemorrhages', 'Hard exudates', 'Cotton-wool spots']
  },
  MH: {
    code: 'MH',
    name: 'Media Haze',
    fullName: 'Media Haze / Optical Opacity',
    category: 'Optical Transmission',
    urgency: 'Moderate',
    shortDescription: 'Clouding or turbidity in the optical pathways (cornea, lens, or vitreous) obscuring retinal visualization.',
    clinicalDescription: 'A reduction in retinal image clarity caused by opacification of anterior or posterior ocular media, frequently caused by nuclear sclerotic cataracts, corneal scars, or vitreous hemorrhage.',
    keyFeatures: ['Diffuse attenuation of retinal contrast', 'Obscuration of optic nerve and vascular details', 'Non-focal image blur']
  },
  ODC: {
    code: 'ODC',
    name: 'Optic Disc Cupping',
    fullName: 'Optic Disc Cupping (Glaucoma Suspect)',
    category: 'Neuro-Ophthalmic',
    urgency: 'High',
    shortDescription: 'Enlargement of the optic cup-to-disc ratio indicating potential retinal nerve fiber layer loss.',
    clinicalDescription: 'Deepening and horizontal/vertical expansion of the optic disc cup relative to the overall neuroretinal rim. A cardinal structural sign of primary open-angle glaucoma or other optic neuropathies.',
    keyFeatures: ['Elevated cup-to-disc ratio (CDR > 0.5)', 'Neuroretinal rim thinning', 'Baring of circumlinear vessels', 'ISNT rule violation']
  },
  TSLN: {
    code: 'TSLN',
    name: 'Tessellated Fundus',
    fullName: 'Tessellated / Tigroid Fundus',
    category: 'Structural Variant',
    urgency: 'Low',
    shortDescription: 'Prominent, stripe-like visualization of large choroidal vessels due to thin retinal pigmentation.',
    clinicalDescription: 'A physiological or myopic variant where the choroidal vasculature becomes distinctly visible through a lightly pigmented or thinned retinal pigment epithelium (RPE), common in high myopia.',
    keyFeatures: ['Pronounced choroidal vascular pattern', 'Polygonal intervascular pigmentation', 'Thinned RPE layer']
  },
  DN: {
    code: 'DN',
    name: 'Drusen',
    fullName: 'Drusen Deposits on Fundus',
    category: 'Degenerative',
    urgency: 'Moderate',
    shortDescription: 'Discrete yellowish-white subretinal deposits concentrated in the posterior pole and macular zone.',
    clinicalDescription: 'Extracellular accumulations composed of lipids, vitronectin, and amyloid proteins positioned beneath the RPE. Primary structural sign of dry age-related macular degeneration.',
    keyFeatures: ['Discrete round yellow nodules', 'Confluent soft drusen clusters', 'Macular predilection']
  },
  MYA: {
    code: 'MYA',
    name: 'Pathological Myopia',
    fullName: 'Pathological Myopia / High Myopia',
    category: 'Structural Degenerative',
    urgency: 'Moderate',
    shortDescription: 'Excessive axial elongation of the eyeball causing progressive chorioretinal stretching and degeneration.',
    clinicalDescription: 'High refractive myopia (> -6.00D or axial length > 26.5mm) accompanied by degenerative structural changes such as posterior staphyloma, peripapillary atrophy (PPA), and lacquer cracks.',
    keyFeatures: ['Peripapillary chorioretinal atrophy', 'Tilted optic disc', 'Fuchs spot risk', 'Posterior staphyloma']
  },
  ARMD: {
    code: 'ARMD',
    name: 'Age-Related Macular Degeneration',
    fullName: 'Age-Related Macular Degeneration (AMD)',
    category: 'Degenerative',
    urgency: 'High',
    shortDescription: 'Degenerative disorder of the central macula affecting fine-detail vision in older individuals.',
    clinicalDescription: 'Progressive macular degeneration featuring soft confluent drusen, geographic atrophy of the RPE, and potential choroidal neovascular membrane complications resulting in irreversible central vision loss.',
    keyFeatures: ['Confluent soft macular drusen', 'RPE hyperpigmentation and hypopigmentation', 'Geographic atrophy margins']
  },
  BRVO: {
    code: 'BRVO',
    name: 'Branch Retinal Vein Occlusion',
    fullName: 'Branch Retinal Vein Occlusion',
    category: 'Vascular Occlusion',
    urgency: 'High',
    shortDescription: 'Thrombotic blockage of a branch retinal vein producing localized sector-shaped retinal hemorrhages.',
    clinicalDescription: 'Arteriovenous crossing compression leading to thrombosis of a branch retinal vein. Results in a characteristic wedge-shaped or quadrant-restricted distribution of flame hemorrhages, macular edema, and ischemia.',
    keyFeatures: ['Sector-shaped superficial flame hemorrhages', 'Dilated tortuous venous segment', 'Cotton-wool spots along occluded tributary', 'Macular edema']
  }
};

export const CLINICAL_DISCLAIMER =
  "NetraDrishti is an artificial intelligence research and educational screening platform. Predictions, confidence scores, and detection flags are algorithmic estimates and MUST NOT be interpreted as clinical diagnoses or replace evaluation by a licensed ophthalmologist or optometrist.";

