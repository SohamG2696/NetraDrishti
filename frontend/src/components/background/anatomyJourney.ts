/** One continuous track shared by the copy, navigation and 3D camera. */
export const anatomyStops = [
  { id: 'overview', name: 'Full eye', short: 'Eye', title: 'An extraordinary world within.', detail: 'Every layer, part of a remarkable whole.', radius: 0, pitch: .48, yaw: -.93, roll: -.16 },
  { id: 'iris', name: 'Iris', short: 'Iris', title: 'A world in every detail.', detail: 'Colour and intricate fibres surrounding the pupil.', radius: .97, pitch: .06, yaw: -.08, roll: -.08 },
  { id: 'cornea', name: 'Cornea', short: 'Cornea', title: 'The first light.', detail: 'The clear, curved surface at the front of the eye.', radius: 1.05, pitch: .16, yaw: -.4, roll: -.12 },
  { id: 'lens', name: 'Lens', short: 'Lens', title: 'A change in focus.', detail: 'A transparent lens that helps focus incoming light.', radius: .79, pitch: .12, yaw: -.42, roll: -.1 },
  { id: 'ciliary', name: 'Ciliary body', short: 'Ciliary', title: 'The structure around focus.', detail: 'A delicate ring of tissue surrounding the lens.', radius: 1.2, pitch: .12, yaw: -.2, roll: -.06 },
  { id: 'vitreous', name: 'Vitreous', short: 'Vitreous', title: 'Through the clear interior.', detail: 'The clear interior between the lens and retina.', radius: 1.18, pitch: .08, yaw: -.18, roll: .02 },
  { id: 'retina', name: 'Retina', short: 'Retina', title: 'Where light becomes sight.', detail: 'The light-sensitive layer at the heart of retinal imaging.', radius: 1.28, pitch: .12, yaw: -.17, roll: .08 },
  { id: 'choroid', name: 'Choroid', short: 'Choroid', title: 'A layer of support.', detail: 'A network of blood vessels beneath the retina.', radius: 1.37, pitch: .18, yaw: -.3, roll: .12 },
  { id: 'sclera', name: 'Sclera', short: 'Sclera', title: 'The outer perspective.', detail: 'The protective outer layer of the eye.', radius: 1.55, pitch: .24, yaw: -1.75, roll: .2 },
] as const;

export const clampProgress = (value: number) => Math.max(0, Math.min(1, value));

export function journeyFrame(progress: number) {
  // Reserve the final interval for the sclera to return to the opening layout.
  const position = clampProgress(progress) * anatomyStops.length;
  const index = Math.min(anatomyStops.length - 1, Math.floor(position));
  const t = position - index;
  // Quintic easing has continuous velocity and acceleration at each focus point.
  const blend = t * t * t * (t * (t * 6 - 15) + 10);
  return { from: index, to: (index + 1) % anatomyStops.length, blend, index: Math.round(position) % anatomyStops.length };
}

let progress = 0;
const listeners = new Set<() => void>();
export const anatomyJourney = {
  end: Infinity,
  get: () => progress,
  set(value: number) {
    const next = clampProgress(value);
    if (Math.abs(next - progress) < .000001) return;
    progress = next;
    listeners.forEach(listener => listener());
  },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
