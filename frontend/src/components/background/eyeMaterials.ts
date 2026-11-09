import * as THREE from 'three';

type Tissue = 'sclera' | 'choroid' | 'retina' | 'ciliary' | 'nerve';

/** Preserve clear centres and grazing-angle reflections when isolating optical tissue. */
export function addOpticalDetail(material: THREE.MeshPhysicalMaterial) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      #include <opaque_fragment>
      float opticalEdge=pow(1.0-abs(dot(normal,geometryViewDir)),3.0);
      float opticalHighlight=clamp(max(max(totalSpecular.r,totalSpecular.g),totalSpecular.b)*3.0,0.0,1.0);
      gl_FragColor.a*=clamp(.045+opticalEdge*.9+opticalHighlight*.55,0.0,1.0);
    `);
  };
  material.customProgramCacheKey = () => 'ocular-optical-surface-v1';
  return material;
}

const tissueNoise = `
  varying vec3 vTissuePoint;
  float tissueHash(vec3 p) {
    p=fract(p*.3183099+vec3(.1,.2,.3));
    p*=17.0;
    return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
  }
  float tissueNoise(vec3 p) {
    vec3 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(mix(tissueHash(i),tissueHash(i+vec3(1,0,0)),f.x),
                   mix(tissueHash(i+vec3(0,1,0)),tissueHash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(tissueHash(i+vec3(0,0,1)),tissueHash(i+vec3(1,0,1)),f.x),
                   mix(tissueHash(i+vec3(0,1,1)),tissueHash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float tissueFbm(vec3 p) {
    return tissueNoise(p)*.55+tissueNoise(p*2.07)*.28+tissueNoise(p*4.19)*.17;
  }
`;

/** Object-space material detail keeps tissue grain continuous across UV seams. */
export function addTissueDetail(material: THREE.MeshPhysicalMaterial, tissue: Tissue) {
  const settings: Record<Tissue, { variation: number; relief: number; tint: string }> = {
    sclera: { variation: .15, relief: .0012, tint: 'vec3(1.0,.78,.72)' },
    choroid: { variation: .42, relief: .0025, tint: 'vec3(.82,.57,.55)' },
    retina: { variation: .28, relief: .0009, tint: 'vec3(1.0,.71,.57)' },
    ciliary: { variation: .38, relief: .0023, tint: 'vec3(.9,.58,.55)' },
    nerve: { variation: .15, relief: .0014, tint: 'vec3(1.0,.87,.72)' },
  };
  const setting = settings[tissue];
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vTissuePoint;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTissuePoint = position;');
    shader.fragmentShader = tissueNoise + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float tissueBroad=tissueFbm(vTissuePoint*6.0);
      float tissueGrain=tissueFbm(vTissuePoint*115.0);
      float tissueFibres=tissueNoise(vTissuePoint*vec3(170.0,34.0,140.0));
      diffuseColor.rgb*=mix(1.0-${setting.variation.toFixed(3)},1.12,tissueBroad);
      diffuseColor.rgb*=mix(vec3(1.0),${setting.tint},smoothstep(.38,.77,tissueBroad)*.3);
      diffuseColor.rgb*=.97+tissueGrain*.06;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+(tissueGrain-.5)*.035,.14,.85);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      float tissueHeight=(tissueGrain*.7+tissueFibres*.3)*${setting.relief.toFixed(4)};
      vec3 tissueQ0=dFdx(-vViewPosition), tissueQ1=dFdy(-vViewPosition);
      vec3 tissueR1=cross(tissueQ1,normal), tissueR2=cross(normal,tissueQ0);
      float tissueDet=dot(tissueQ0,tissueR1);
      vec3 tissueGradient=sign(tissueDet)*(dFdx(tissueHeight)*tissueR1+dFdy(tissueHeight)*tissueR2);
      normal=normalize(abs(tissueDet)*normal-tissueGradient);
    `);
  };
  material.customProgramCacheKey = () => `ocular-tissue-v1-${tissue}`;
  return material;
}

/** A continuous folded tissue surface, rather than repeated mechanical-looking pieces. */
export function createCiliaryGeometry() {
  const radialSteps = 512;
  const tubeSteps = 24;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let u = 0; u <= radialSteps; u++) {
    const a = u / radialSteps * Math.PI * 2;
    const folds = Math.pow(.5 + .5 * Math.sin(a * 76 + Math.sin(a * 13) * .4), 3);
    const irregularity = Math.sin(a * 11) * .009 + Math.cos(a * 23) * .005;
    for (let v = 0; v <= tubeSteps; v++) {
      const b = v / tubeSteps * Math.PI * 2;
      const width = .164 + folds * .012 + irregularity;
      const radius = 1.01 + Math.cos(b) * width;
      const height = .052 + folds * .037;
      positions.push(Math.cos(a) * radius, Math.sin(a) * radius, Math.sin(b) * height + irregularity);
      uvs.push(u / radialSteps, v / tubeSteps);
      if (u < radialSteps && v < tubeSteps) {
        const current = u * (tubeSteps + 1) + v;
        const next = current + tubeSteps + 1;
        indices.push(current, next, current + 1, next, next + 1, current + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
