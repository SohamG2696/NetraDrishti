import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { addTissueDetail } from '../background/eyeMaterials';
import type { Modality } from '../../types/api';

import { tissueRibbon, tissueHeight, cellularMaterial, retinalCup, retinaPoint, integrateRetinalLandmarks, vascularTrees } from './retinalCardGeometry';

export function createRetinalModel(host: HTMLDivElement, modality: Modality) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.debug.checkShaderErrors = window.location.search.includes('debugShaders');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.domElement.className = 'retinal-model-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 40);
  camera.position.z = 8; camera.updateMatrixWorld();
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .06);
  scene.environment = environment.texture; scene.environmentIntensity = .28;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffede1, 0x29202a, .85));
  const key = new THREE.DirectionalLight(0xfff5e8, 2.1); key.position.set(-3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd3e8ff, 1.6); rim.position.set(4, 1, -2); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xf4c4a4, .5); fill.position.set(1, -3, 4); scene.add(fill);
  const model = new THREE.Group(); scene.add(model);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const silhouettes: { object: THREE.Mesh; points: THREE.Vector3[] }[] = [];
  const swatches: { material: THREE.MeshPhysicalMaterial; x: number; y: number }[] = [];
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    geometries.add(geometry); materials.add(material);
    const object = new THREE.Mesh(geometry, material); model.add(object);
    const vertices = geometry.attributes.position, points: THREE.Vector3[] = [];
    for (let i = 0; i < vertices.count; i += Math.max(1, Math.floor(vertices.count / 400))) points.push(new THREE.Vector3().fromBufferAttribute(vertices, i));
    silhouettes.push({ object, points });
    return object;
  };
  const tissue = (color: number, variant: 'retina' | 'sclera' | 'choroid', x: number, y: number) => {
    const material = addTissueDetail(new THREE.MeshPhysicalMaterial({ color, roughness: .48, metalness: 0, clearcoat: .16, clearcoatRoughness: .3, specularIntensity: .3, side: THREE.DoubleSide }), variant);
    swatches.push({ material, x, y }); return material;
  };

  const veinMaterial = new THREE.MeshPhysicalMaterial({ color: 0x642323, roughness: .82, specularIntensity: 0, envMapIntensity: 0 });
  const arteryMaterial = new THREE.MeshPhysicalMaterial({ color: 0x963d2c, roughness: .82, specularIntensity: 0, envMapIntensity: 0 });
  if (modality === 'OCT') {
    const layers = [
      { thickness: .028, color: 0xb7a5a0 }, { thickness: .045, color: 0xbba7a3 },
      { thickness: .052, color: 0x927f87 }, { thickness: .036, color: 0xc5aaa4 },
      { thickness: .067, color: 0x9c838f }, { thickness: .035, color: 0xc7aca3 },
      { thickness: .075, color: 0xad8b82 }, { thickness: .018, color: 0x493733 },
      { thickness: .09, color: 0x85514b }, { thickness: .065, color: 0xbdb1a8 },
    ];
    let top = .5;
    for (const [index, layer] of layers.entries()) {
      const material = index === 8 ? tissue(layer.color, 'choroid', .5, .5)
        : index === 9 ? tissue(layer.color, 'sclera', 0, .5) : cellularMaterial(layer.color, index);
      mesh(tissueRibbon(top, top - layer.thickness), material);
      top -= layer.thickness;
    }
    const vessels = vascularTrees((x, y) => {
      const px = x * 1.16, z = y * .57;
      return new THREE.Vector3(px, tissueHeight(px, z, .5) + .010, z);
    }, .62);
    vessels.forEach((geometry, index) => mesh(geometry, index ? arteryMaterial : veinMaterial));
  } else {
    mesh(retinalCup(true), tissue(0xe0d3c3, 'sclera', 0, .5));
    const retinalMaterial = integrateRetinalLandmarks(tissue(0xd1b6a7, 'retina', 0, 0));
    retinalMaterial.roughness = .62; retinalMaterial.clearcoat = .1;
    retinalMaterial.specularIntensity = .18; retinalMaterial.clearcoatRoughness = .48;
    mesh(retinalCup(), retinalMaterial);
    const vessels = vascularTrees((x, y) => retinaPoint(x, y, .007));
    vessels.forEach((geometry, index) => mesh(geometry, index ? arteryMaterial : veinMaterial));
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const base = modality === 'OCT' ? new THREE.Euler(.37, -.32, -.035) : new THREE.Euler(.16, -.38, -.08);
  let width = 1, height = 1, visible = false, disposed = false, ready = false, contextLost = false;
  let frame = 0, lastTime = 0, targetX = 0, targetY = 0, currentX = 0, currentY = 0, scrollTilt = 0, currentTilt = 0, documentTop = 0;
  const projected = new THREE.Vector3();
  function fit() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    documentTop = host.getBoundingClientRect().top + window.scrollY;
    renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
    model.rotation.copy(base); model.scale.setScalar(1); model.position.set(0, 0, 0); model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), centre = box.getCenter(new THREE.Vector3());
    model.position.sub(centre);
    for (let pass = 0; pass < 3; pass++) {
      model.updateMatrixWorld(true);
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const silhouette of silhouettes) for (const point of silhouette.points) {
        projected.copy(point).applyMatrix4(silhouette.object.matrixWorld).project(camera);
        const px = (projected.x * .5 + .5) * width, py = (-projected.y * .5 + .5) * height;
        left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py);
      }
      const scale = Math.min(width * .88 / (right - left), height * .85 / (bottom - top));
      model.scale.multiplyScalar(scale);
      const units = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 8 / height;
      model.position.x += (width / 2 - (left + right) / 2) * units;
      model.position.y += ((top + bottom) / 2 - height / 2) * units;
    }
    requestRender();
  }
  function draw(time: number) {
    frame = 0;
    if (!ready || !visible || contextLost || document.hidden || disposed) return;
    const delta = Math.min(.05, Math.max(.001, (time - lastTime) / 1000)); lastTime = time;
    const damping = 1 - Math.exp(-20 * delta);
    currentX = reduced.matches ? 0 : THREE.MathUtils.lerp(currentX, targetX, damping);
    currentY = reduced.matches ? 0 : THREE.MathUtils.lerp(currentY, targetY, damping);
    currentTilt = reduced.matches ? 0 : THREE.MathUtils.lerp(currentTilt, scrollTilt, damping);
    model.rotation.set(base.x + currentY * .13 + currentTilt, base.y + currentX * .2, base.z);
    renderer.render(scene, camera);
    host.dataset.renderer = 'webgl';
    host.dataset.yaw = model.rotation.y.toFixed(5);
    host.dataset.pitch = model.rotation.x.toFixed(5);
    if (!reduced.matches && (Math.abs(targetX - currentX) > .001 || Math.abs(targetY - currentY) > .001 || Math.abs(scrollTilt - currentTilt) > .0001)) requestRender();
  }
  function requestRender() { if (!frame && !disposed && visible && !contextLost && !document.hidden) frame = requestAnimationFrame(draw); }
  const onPointer = (event: PointerEvent) => {
    if (reduced.matches || event.pointerType !== 'mouse') return;
    const rect = host.getBoundingClientRect(); targetX = (event.clientX - rect.left) / width - .5; targetY = (event.clientY - rect.top) / height - .5; requestRender();
  };
  const onLeave = () => { targetX = 0; targetY = 0; requestRender(); };
  const onScroll = () => { if (!visible || reduced.matches) return; scrollTilt = THREE.MathUtils.clamp((window.scrollY + window.innerHeight / 2 - documentTop - height / 2) / window.innerHeight, -1, 1) * .09; requestRender(); };
  const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else requestRender(); };
  const onPreference = () => { targetX = 0; targetY = 0; scrollTilt = 0; requestRender(); };
  const onContextLost = (event: Event) => { event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); frame = 0; host.dataset.renderer = 'fallback'; };
  const onContextRestored = () => { contextLost = false; requestRender(); };
  const resizeObserver = new ResizeObserver(fit); resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    host.dataset.visible = String(visible);
    if (visible) { fit(); onScroll(); requestRender(); } else { cancelAnimationFrame(frame); frame = 0; }
  });
  intersectionObserver.observe(host);
  host.addEventListener('pointermove', onPointer, { passive: true }); host.addEventListener('pointerleave', onLeave);
  window.addEventListener('scroll', onScroll, { passive: true }); document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onPreference);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost); renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
  fit();
  const atlas = new THREE.TextureLoader().load('/images/ocular-tissue-atlas.webp', async texture => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    for (const swatch of swatches) {
      const map = texture.clone(); map.offset.set(swatch.x + .008, swatch.y + .008); map.repeat.set(.484, .484);
      map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); map.needsUpdate = true; textures.add(map);
      swatch.material.map = map; swatch.material.bumpMap = map; swatch.material.bumpScale = .002; swatch.material.needsUpdate = true;
    }
    try { await renderer.compileAsync(scene, camera); if (!disposed) { ready = true; requestRender(); } }
    catch { if (!disposed) host.dataset.renderer = 'fallback'; }
  }, undefined, () => { if (!disposed) host.dataset.renderer = 'fallback'; });
  textures.add(atlas);
  return () => {
    disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); intersectionObserver.disconnect();
    host.removeEventListener('pointermove', onPointer); host.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', onVisibility); reduced.removeEventListener('change', onPreference);
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost); renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
    environment.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
}
