import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addTissueDetail } from '../background/eyeMaterials';

// The layers converge at the foveal pit instead of repeating one stamped profile.
export function tissueHeight(x: number, z: number, offset: number) {
  const pit = Math.exp(-((x / .53) ** 2 + (z / .62) ** 2));
  return offset - .31 * pit * Math.max(.12, (offset + .22) / .72)
    - .065 * (x / 1.8) ** 2 + .016 * Math.sin(x * 3 + z * 4)
    + .009 * Math.sin(x * 7 + z * 5 + offset * 22)
    + .004 * Math.sin(x * 33 + z * 19 + offset * 17);
}

/** Closed tissue volume with softly rounded margins and continuous cut faces. */
export function tissueRibbon(top: number, bottom: number) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const nx = 64, nz = 28;
  const point = (i: number, j: number, offset: number) => {
    const u = i / nx * 2 - 1, v = j / nz * 2 - 1;
    const x = u * 1.8 * (1 - .055 * v ** 10);
    const z = v * .82 * (1 - .07 * u ** 10) + .012 * Math.sin(x * 6) * v ** 8;
    return [x, tissueHeight(x, z, offset), z];
  };
  for (const [surface, offset] of [top, bottom].entries()) {
    const base = positions.length / 3;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { positions.push(...point(i, j, offset)); uvs.push(i / nx, j / nz); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = base + j * (nx + 1) + i, b = a + nx + 1;
      if (surface === 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const edge = (count: number, at: (i: number, offset: number) => number[]) => {
    const base = positions.length / 3;
    for (let i = 0; i <= count; i++) { positions.push(...at(i, top), ...at(i, bottom)); uvs.push(i / count, 1, i / count, 0); }
    for (let i = 0; i < count; i++) { const a = base + i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  edge(nx, (i, offset) => point(i, nz, offset)); edge(nx, (i, offset) => point(nx - i, 0, offset));
  edge(nz, (j, offset) => point(0, j, offset)); edge(nz, (j, offset) => point(nx, nz - j, offset));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function cellularMaterial(color: number, layer: number) {
  const material = addTissueDetail(new THREE.MeshPhysicalMaterial({
    color, roughness: .55, metalness: 0, clearcoat: .14, clearcoatRoughness: .42,
    specularIntensity: .24, side: THREE.DoubleSide,
  }), 'retina');
  const compile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.uniforms.uCellDarken = { value: layer === 2 || layer === 4 ? .24 : .09 };
    shader.uniforms.uCellUseColumns = { value: layer === 6 ? 1.0 : 0.0 };
    shader.fragmentShader = `uniform float uCellDarken;\nuniform float uCellUseColumns;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float cellularGrain=tissueNoise(vTissuePoint*vec3(145.0,210.0,145.0));
      float nuclei=smoothstep(.47,.78,cellularGrain);
      float columns=tissueNoise(vTissuePoint*vec3(180.0,9.0,180.0));
      diffuseColor.rgb*=1.0-nuclei*uCellDarken;
      diffuseColor.rgb*=mix(.85,1.1,mix(cellularGrain,columns,uCellUseColumns));
    `);
  };
  material.customProgramCacheKey = () => 'retinal-cellular-v2';
  return material;
}

export function retinaPoint(x: number, y: number, offset = 0) {
  const fovea = Math.exp(-(((x - .35) / .16) ** 2 + ((y + .08) / .18) ** 2));
  const cup = Math.exp(-(((x + .55) / .065) ** 2 + ((y - .08) / .085) ** 2));
  const z = -Math.sqrt(Math.max(.05, 1.64 ** 2 - x * x - y * y));
  return new THREE.Vector3(x, y, z - .024 * fovea - .018 * cup + offset);
}

/** Posterior eye cup, with a continuous cut edge connecting the two surfaces. */
export function retinalCup(outer = false) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const rings = 48, sides = 112;
  for (let r = 0; r <= rings; r++) for (let s = 0; s <= sides; s++) {
    const a = s / sides * Math.PI * 2;
    const radius = r / rings * (outer ? 1.455 : 1.395) * (1 + .004 * Math.sin(a * 7) + .002 * Math.sin(a * 19));
    const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
    const p = retinaPoint(x, y, outer ? -.09 : 0);
    positions.push(p.x, p.y, p.z); uvs.push(x / 2.9 + .5, y / 2.9 + .5);
    if (r < rings && s < sides) {
      const i = r * (sides + 1) + s, j = i + sides + 1;
      indices.push(i, j, i + 1, i + 1, j, j + 1);
    }
  }
  if (outer) {
    const edge = positions.length / 3;
    for (let s = 0; s <= sides; s++) {
      const a = s / sides * Math.PI * 2;
      const radius = 1.395 * (1 + .004 * Math.sin(a * 7) + .002 * Math.sin(a * 19));
      const p = retinaPoint(Math.cos(a) * radius, Math.sin(a) * radius);
      positions.push(p.x, p.y, p.z); uvs.push(p.x / 2.9 + .5, p.y / 2.9 + .5);
      if (s < sides) {
        const i = rings * (sides + 1) + s, j = edge + s;
        indices.push(i, j, i + 1, i + 1, j, j + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

/** Optic nerve head and macular pigmentation belong to the tissue, not floating discs. */
export function integrateRetinalLandmarks(material: THREE.MeshPhysicalMaterial) {
  const compile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      vec2 p=vTissuePoint.xy;
      float macula=exp(-dot((p-vec2(.35,-.08))/vec2(.32,.29),(p-vec2(.35,-.08))/vec2(.32,.29)));
      diffuseColor.rgb*=mix(vec3(1.0),vec3(.42,.24,.23),macula*.85);
      float discRadius=length((p-vec2(-.55,.08))/vec2(.12,.145));
      float disc=1.0-smoothstep(.78,1.12,discRadius+tissueNoise(vTissuePoint*85.0)*.09);
      float cup=1.0-smoothstep(.05,.58,discRadius);
      vec3 discColor=mix(vec3(.65,.34,.13),vec3(.81,.59,.34),cup);
      discColor*=.92+.13*tissueNoise(vTissuePoint*155.0);
      diffuseColor.rgb=mix(diffuseColor.rgb,discColor,disc*.94);
    `);
  };
  material.customProgramCacheKey = () => 'retinal-landmarks-v2';
  return material;
}

const arcades = [
  [[-.55,.08],[-.48,.29],[-.25,.54],[.12,.77],[.57,.87],[1.04,.70]],
  [[-.55,.08],[-.39,.19],[-.06,.32],[.40,.39],[.88,.28],[1.27,.12]],
  [[-.55,.08],[-.46,-.23],[-.18,-.53],[.24,-.77],[.70,-.84],[1.10,-.63]],
  [[-.55,.08],[-.35,-.09],[-.06,-.26],[.38,-.35],[.85,-.23],[1.27,-.10]],
  [[-.55,.08],[-.72,.29],[-.85,.63],[-.81,1.08]],
  [[-.55,.08],[-.81,.13],[-1.04,.34],[-1.25,.48]],
  [[-.55,.08],[-.71,-.24],[-.92,-.57],[-.95,-.93]],
  [[-.55,.08],[-.83,-.08],[-1.09,-.27],[-1.28,-.41]],
];

/** Project every tube sample onto the curved tissue, then batch the vascular tree. */
export function vascularTrees(project: (x: number, y: number) => THREE.Vector3, scale = 1) {
  const batches: THREE.BufferGeometry[][] = [[], []];
  const add = (points: number[][], radius: number, batch: number, segments = 50) => {
    const planar = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)));
    class SurfaceCurve extends THREE.Curve<THREE.Vector3> {
      constructor() { super(); }
      getPoint(t: number, target = new THREE.Vector3()) {
        const p = planar.getPoint(t);
        return target.copy(project(p.x, p.y));
      }
    }
    const surface = new SurfaceCurve();
    const geometry = new THREE.TubeGeometry(surface, segments, radius * scale, 6, false);
    const vertices = geometry.attributes.position, p = new THREE.Vector3(), centre = new THREE.Vector3();
    for (let ring = 0; ring <= segments; ring++) {
      surface.getPointAt(ring / segments, centre);
      for (let side = 0; side <= 6; side++) {
        const i = ring * 7 + side;
        p.fromBufferAttribute(vertices, i).sub(centre).multiplyScalar(1 - .90 * ring / segments).add(centre);
        vertices.setXYZ(i, p.x, p.y, p.z);
      }
    }
    geometry.computeVertexNormals(); batches[batch].push(geometry);
  };
  for (const [n, path] of arcades.entries()) {
    add(path, n < 4 ? .018 : .013, n % 2);
    for (let j = 1; j < path.length - 1; j++) {
      const [x, y] = path[j], [px, py] = path[j - 1];
      for (const sign of [-1, 1]) {
        const angle = Math.atan2(y - py, x - px) + sign * (.65 + j * .07);
        const length = .19 + .13 * Math.abs(Math.sin(n * 7 + j * 3));
        const points = Array.from({ length: 7 }, (_, i) => {
          const t = i / 6, a = angle + .18 * Math.sin(t * 4 + n);
          return [x + Math.cos(a) * length * t, y + Math.sin(a) * length * t];
        }).filter(([a, b]) => a * a + b * b < 1.83 && ((a - .35) ** 2 + (b + .08) ** 2 > .035));
        if (points.length < 3) continue;
        add(points, .0055, n % 2, 24);
        const [tx, ty] = points[Math.floor(points.length / 2)];
        const a = angle + sign * .65;
        const twig = [[tx, ty], [tx + Math.cos(a) * .065, ty + Math.sin(a) * .065], [tx + Math.cos(a + .2) * .13, ty + Math.sin(a + .2) * .13]];
        if (twig.every(([a, b]) => a * a + b * b < 1.84)) add(twig, .0026, n % 2, 12);
      }
    }
  }
  return batches.map(batch => { const geometry = mergeGeometries(batch)!; batch.forEach(part => part.dispose()); return geometry; });
}
