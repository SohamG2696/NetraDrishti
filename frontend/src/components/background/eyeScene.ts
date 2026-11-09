import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { addTissueDetail, addOpticalDetail, createCiliaryGeometry } from './eyeMaterials';
import { anatomyJourney, anatomyStops, journeyFrame, clampProgress } from './anatomyJourney';

interface SceneState { workspace: boolean; chapter: number; }

export function createEyeScene(host: HTMLDivElement, getState: () => SceneState) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 800 ? 1.35 : 1.65));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'eye-webgl-canvas';
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 60);
  camera.position.set(0, 0, 12);
  camera.updateMatrixWorld();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .05);
  scene.environment = environment.texture;
  scene.environmentIntensity = .38;
  room.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xdce7ed, 0x231b18, .55));
  const key = new THREE.DirectionalLight(0xfff1df, 2.6);
  key.position.set(-4, 6, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 35 });
  key.shadow.normalBias = .018;
  key.shadow.bias = -.0001;
  key.shadow.radius = 3;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9d9e2, 1.5);
  rim.position.set(5, 1, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xe1b79f, .4);
  fill.position.set(-4, -2, 2);
  scene.add(fill);

  const eye = new THREE.Group();
  scene.add(eye);
  const layers: { object: THREE.Group; depth: number }[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let disposed = false;
  let materialsReady = false;
  let loadedTextures = 0;
  async function prepareMaterials() {
    if (++loadedTextures !== 2 || disposed) return;
    // Compile the final textured materials before exposing the canvas on a cold refresh.
    try {
      await renderer.compileAsync(scene, camera);
      if (disposed) return;
      materialsReady = true;
      requestRender();
    } catch { if (!disposed) host.dataset.renderer = 'fallback'; }
  }
  function textureFailed() { if (!disposed) host.dataset.renderer = 'fallback'; }

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) {
    geometries.add(geometry);
    materials.add(material);
    const item = new THREE.Mesh(geometry, material);
    item.castShadow = !material.transparent && !(material instanceof THREE.MeshBasicMaterial);
    item.receiveShadow = !material.transparent;
    parent.add(item);
    return item;
  }

  function layer(name: string, depth: number) {
    const object = new THREE.Group();
    object.name = name;
    object.position.z = depth;
    eye.add(object);
    layers.push({ object, depth });
    return object;
  }

  const pearl = addTissueDetail(new THREE.MeshPhysicalMaterial({ color: 0xcac1b5, roughness: .4, metalness: 0, clearcoat: .28, clearcoatRoughness: .3, specularIntensity: .35, side: THREE.DoubleSide }), 'sclera');
  const choroidMat = addTissueDetail(new THREE.MeshPhysicalMaterial({ color: 0x54232a, roughness: .42, clearcoat: .28, clearcoatRoughness: .3, side: THREE.DoubleSide }), 'choroid');
  const retinaMat = addTissueDetail(new THREE.MeshPhysicalMaterial({ color: 0xac6749, roughness: .4, clearcoat: .22, clearcoatRoughness: .25, side: THREE.DoubleSide, emissive: 0x6a300a, emissiveIntensity: .015 }), 'retina');
  const vesselMat = new THREE.MeshBasicMaterial({ color: 0x632f27, transparent: true, opacity: .42, depthWrite: false });
  const nerveMat = addTissueDetail(new THREE.MeshPhysicalMaterial({ color: 0xb29e85, roughness: .55, clearcoat: .1 }), 'nerve');
  const ciliaryMat = addTissueDetail(new THREE.MeshPhysicalMaterial({ color: 0x633b38, roughness: .43, clearcoat: .3, clearcoatRoughness: .3 }), 'ciliary');

  function bowl(parent: THREE.Object3D, radius: number, material: THREE.Material) {
    const shape = new THREE.SphereGeometry(radius, 112, 56, 0, Math.PI * 2, 0, Math.PI / 2);
    shape.rotateX(-Math.PI / 2);
    const positions = shape.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const unevenness = 1 + (Math.sin(x * 17 + y * 13) * Math.sin(z * 19 - x * 11) * .0014 + Math.sin(y * 37 + z * 23) * .0006);
      positions.setXYZ(i, x * unevenness, y * unevenness, z * unevenness);
    }
    shape.computeVertexNormals();
    mesh(shape, material, parent);
    mesh(new THREE.TorusGeometry(radius, .013, 10, 160), material, parent);
  }

  const sclera = layer('sclera', -1.1);
  bowl(sclera, 1.44, pearl);
  const choroid = layer('choroid', -.6);
  bowl(choroid, 1.35, choroidMat);
  const retina = layer('retina', -.06);
  bowl(retina, 1.26, retinaMat);

  const capillaryMat = new THREE.MeshPhysicalMaterial({ color: 0x9c6462, roughness: .52, transparent: true, opacity: .6, depthWrite: false });
  for (let branch = 0; branch < 19; branch++) {
    const startAngle = branch * 2.39996;
    const points = Array.from({ length: 20 }, (_, i) => {
      const r = .38 + i * .053;
      const a = startAngle + Math.sin(i * .32 + branch) * .16 + Math.cos(i * .73) * .025;
      return new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), -Math.sqrt(1.448 ** 2 - r ** 2));
    });
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 36, .003 + branch % 3 * .001, 4, false), capillaryMat, sclera);
  }

  // Curved vascular branches sit on the inside of the retinal hemisphere.
  const retinalPoint = (r: number, angle: number) => new THREE.Vector3(r * Math.cos(angle), r * Math.sin(angle), -Math.sqrt(Math.max(.015, 1.25 ** 2 - r ** 2)) + .006);
  for (let branch = 0; branch < 9; branch++) {
    const angle = branch * 2.399;
    const points = Array.from({ length: 17 }, (_, i) => retinalPoint(.13 + i * .066, angle + Math.sin(i * .27 + branch) * .23));
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 36, .005 + (branch % 3) * .001, 5, false), vesselMat, retina);
    for (let fork = 0; fork < 2; fork++) {
      const r = .5 + fork * .26;
      const a = angle + Math.sin((r - .13) / .066 * .27 + branch) * .23;
      const twig = Array.from({ length: 9 }, (_, i) => retinalPoint(r + i * .039, a + i * .045 * (fork ? -1 : 1)));
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(twig), 16, .0025, 4, false), vesselMat, retina);
    }
  }

  // Optic nerve and its smaller fibres emerge from the posterior sclera.
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * .045;
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 0, -1.4),
      new THREE.Vector3(x + .12, .03, -1.75),
      new THREE.Vector3(x + .22, .2 + i * .018, -2.04),
      new THREE.Vector3(x + .18 + Math.sin(i) * .13, .32 + i * .07, -2.42),
    ]);
    mesh(new THREE.TubeGeometry(path, 24, i === 3 ? .095 : .04, 8, false), nerveMat, sclera);
  }

  const vitreous = layer('vitreous', .55);
  const vitreousMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e7df, roughness: .06, transmission: .98, thickness: .7, ior: 1.336, transparent: true, opacity: .16, depthWrite: false, envMapIntensity: .35 });
  addOpticalDetail(vitreousMat);
  const vitreousBody = mesh(new THREE.SphereGeometry(1.17, 64, 48), vitreousMat, vitreous);
  vitreousBody.scale.z = .7;

  const ciliary = layer('ciliary', 1.18);
  mesh(createCiliaryGeometry(), ciliaryMat, ciliary);

  const lens = layer('lens', 1.72);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xf4f6ec, metalness: 0, roughness: .015, transmission: 1, thickness: .2, ior: 1.42, transparent: true, opacity: .38, clearcoat: .35, clearcoatRoughness: .04, envMapIntensity: .35, depthWrite: false });
  addOpticalDetail(glass);
  const lensBody = mesh(new THREE.SphereGeometry(.78, 80, 40), glass, lens);
  lensBody.scale.z = .25;

  const iris = layer('iris', 2.22);
  const irisGeometry = new THREE.RingGeometry(.32, .96, 192, 20);
  const irisPositions = irisGeometry.attributes.position;
  for (let i = 0; i < irisPositions.count; i++) {
    const x = irisPositions.getX(i), y = irisPositions.getY(i);
    const r = Math.hypot(x, y);
    irisPositions.setZ(i, Math.sin((r - .32) / .64 * Math.PI) * .032 + Math.sin(Math.atan2(y, x) * 73 + r * 25) * .002);
  }
  irisGeometry.computeVertexNormals();
  const irisFace = mesh(irisGeometry, new THREE.MeshStandardMaterial({ color: 0x000000, side: THREE.DoubleSide }), iris);
  const textureLoader = new THREE.TextureLoader();
  host.dataset.irisTexture = 'loading';
  const irisTexture = textureLoader.load('/images/iris-albedo-realistic.webp', texture => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const irisMaterial = new THREE.MeshPhysicalMaterial({ map: texture, color: 0xd1d0c4, roughness: .64, metalness: 0, specularIntensity: .12, clearcoat: 0, bumpMap: texture, bumpScale: .0008, side: THREE.DoubleSide });
    materials.add(irisMaterial);
    irisFace.material = irisMaterial;
    host.dataset.irisTexture = 'ready';
    void prepareMaterials();
  }, undefined, textureFailed);
  textures.add(irisTexture);
  host.dataset.tissueTexture = 'loading';
  const tissueAtlas = textureLoader.load('/images/ocular-tissue-atlas.webp', atlas => {
    if (disposed) { atlas.dispose(); return; }
    atlas.colorSpace = THREE.SRGBColorSpace;
    const swatches = [
      { material: pearl, x: 0, y: .5, tint: 0xe1ded5 },
      { material: choroidMat, x: .5, y: .5, tint: 0x8d706b },
      { material: retinaMat, x: 0, y: 0, tint: 0xbfac9a },
      { material: ciliaryMat, x: .5, y: 0, tint: 0x9c8178 },
    ];
    for (const { material, x, y, tint } of swatches) {
      const map = atlas.clone();
      // Inset each quadrant to avoid texture bleeding at mipmap boundaries.
      map.offset.set(x + .008, y + .008);
      map.repeat.set(.484, .484);
      map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      map.needsUpdate = true;
      textures.add(map);
      material.map = map;
      material.bumpMap = map;
      material.bumpScale = .0015;
      material.color.setHex(tint);
      material.needsUpdate = true;
    }
    host.dataset.tissueTexture = 'ready';
    void prepareMaterials();
  }, undefined, textureFailed);
  textures.add(tissueAtlas);
  mesh(new THREE.TorusGeometry(.96, .012, 12, 160), new THREE.MeshStandardMaterial({ color: 0x19211f, roughness: .58 }), iris);
  const pupil = mesh(new THREE.CircleGeometry(.321, 96), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }), iris);
  pupil.position.z = -.015;

  const cornea = layer('cornea', 2.85);
  const domeGeometry = new THREE.SphereGeometry(1.04, 80, 40, 0, Math.PI * 2, 0, Math.PI / 2);
  domeGeometry.rotateX(Math.PI / 2);
  const corneaMat = glass.clone();
  addOpticalDetail(corneaMat);
  corneaMat.opacity = .22;
  corneaMat.ior = 1.376;
  corneaMat.envMapIntensity = .75;
  corneaMat.thickness = .025;
  corneaMat.clearcoat = .3;
  const dome = mesh(domeGeometry, corneaMat, cornea);
  dome.scale.z = .4;
  mesh(new THREE.TorusGeometry(1.04, .006, 8, 144), new THREE.MeshPhysicalMaterial({ color: 0xb4c3bf, transparent: true, opacity: .22, roughness: .06, metalness: 0, depthWrite: false }), cornea);

  const labelBindings = anatomyStops.filter(stop => stop.id !== 'overview').map(stop => ({
    node: host.querySelector<HTMLDivElement>(`[data-part="${stop.id}"]`)!,
    object: layers.find(part => part.object.name === stop.id)!.object,
    point: new THREE.Vector3(stop.radius + .04, .08, 0),
    id: stop.id,
  }));
  const point = new THREE.Vector3();
  // Eight cached corners per component let us fit the whole chain without reading
  // layout or walking the geometry during scroll frames.
  eye.updateMatrixWorld(true);
  const bounds = layers.map(part => {
    const box = new THREE.Box3().setFromObject(part.object);
    box.translate(part.object.position.clone().negate());
    const corners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
    return { object: part.object, corners, centre: box.getCenter(new THREE.Vector3()) };
  });
  const projected = new THREE.Vector3();
  type ComponentPose = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 };
  const layouts: ComponentPose[][] = [];
  const focusPosition = new THREE.Vector3();
  const pointerRotation = new THREE.Quaternion();
  const pointerEuler = new THREE.Euler();
  let stageRect = { left: 0, top: 0, width: 1, height: 1 };
  let width = 1, height = 1, compact = false;
  let pointerX = 0, pointerY = 0, currentX = 0, currentY = 0;
  let scroll = window.scrollY, currentScroll = scroll, frame = 0, lastTime = 0;
  let currentProgress = anatomyJourney.get();
  let contextLost = false;
  let observedStage: Element | null = null;

  function worldAtPixel(x: number, y: number, z: number) {
    const units = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - z) / height;
    return new THREE.Vector3((x - width / 2) * units, (height / 2 - y) * units, z);
  }

  // Cache every component's pose at every stop. Scroll frames only interpolate
  // positions, rotations and scale; no DOM measurements or geometry fitting.
  function buildLayouts() {
    const overview = anatomyStops[0];
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 15 * 2;
    const viewWidth = viewHeight * camera.aspect;
    const baseScale = width <= 560 ? Math.min(viewWidth / 4.4, viewHeight / 9) : Math.min(viewWidth / 12, viewHeight / 7.5);
    eye.rotation.set(overview.pitch, overview.yaw, overview.roll);
    eye.scale.setScalar(baseScale * 1.08);
    eye.position.set(width <= 560 ? 0 : viewWidth * .25, .18, -3);
    for (const part of layers) {
      part.object.rotation.set(0, 0, 0);
      part.object.scale.setScalar(1);
      const anterior = Math.max(0, part.depth);
      part.object.position.set(-anterior * .11, -anterior * .035, part.depth * 1.08);
    }
    // Opening pose: the complete exploded eye from the supplied reference.
    for (let pass = 0; pass < 3; pass++) {
      eye.updateMatrixWorld(true);
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const bound of bounds) for (const corner of bound.corners) {
        projected.copy(corner).applyMatrix4(bound.object.matrixWorld).project(camera);
        const x = (projected.x * .5 + .5) * width, y = (-projected.y * .5 + .5) * height;
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      eye.scale.multiplyScalar(Math.min(1, stageRect.width / (right - left), stageRect.height / (bottom - top)));
      const units = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - eye.position.z) / height;
      eye.position.x += (stageRect.left + stageRect.width / 2 - (left + right) / 2) * units;
      eye.position.y -= (stageRect.top + stageRect.height / 2 - (top + bottom) / 2) * units;
    }
    eye.updateMatrixWorld(true);
    layouts[0] = layers.map(({ object }) => ({ position: object.getWorldPosition(new THREE.Vector3()), quaternion: object.getWorldQuaternion(new THREE.Quaternion()), scale: object.getWorldScale(new THREE.Vector3()) }));
    for (let stopIndex = 1; stopIndex < anatomyStops.length; stopIndex++) {
      layouts[stopIndex] = layers.map(({ object }) => {
        const index = anatomyStops.findIndex(stop => stop.id === object.name);
        const stop = anatomyStops[index];
        const active = index === stopIndex;
        const distance = Math.abs(index - stopIndex);
        const ahead = index > stopIndex;
        const z = active ? 2 : -3 - distance * .4;
        // Passed layers recede to the lower left; upcoming layers wait behind
        // the upper right. Only the selected component occupies the centre.
        const x = active ? .5 : ahead ? .79 + distance * .013 : .2 - distance * .012;
        const y = active ? .52 : ahead ? .22 - distance * .012 : .79 + distance * .009;
        const diameter = active ? Math.min(stageRect.width * .67, stageRect.height * .82) : Math.min(stageRect.width * .27, stageRect.height * .32);
        const units = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - z) / height;
        const scale = diameter * units / (stop.radius * 2);
        const rotation = active ? new THREE.Euler(stop.pitch, stop.yaw, stop.roll) : new THREE.Euler(.38, -.76, -.18);
        const quaternion = new THREE.Quaternion().setFromEuler(rotation);
        const position = worldAtPixel(stageRect.left + stageRect.width * x, stageRect.top + stageRect.height * y, z);
        if (active) position.sub(bounds.find(bound => bound.object === object)!.centre.clone().multiplyScalar(scale).applyQuaternion(quaternion));
        return { position, quaternion, scale: new THREE.Vector3(scale, scale, scale) };
      });
    }
    // Component poses are now in world space, with a neutral parent.
    eye.position.set(0, 0, 0);
    eye.rotation.set(0, 0, 0);
    eye.scale.setScalar(1);
  }
  const onResize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    compact = width <= 800;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    const stage = document.querySelector('.eye-stage');
    if (stage !== observedStage) {
      if (observedStage) observer.unobserve(observedStage);
      if (stage) observer.observe(stage);
      observedStage = stage;
    }
    if (stage) {
      const rect = stage.getBoundingClientRect();
      const sticky = document.querySelector('.hero-sticky')!.getBoundingClientRect();
      const header = document.querySelector('header')!.getBoundingClientRect().height;
      stageRect = { left: rect.left + 12, top: rect.top - sticky.top + header + 25, width: rect.width - 24, height: Math.max(120, rect.height - 105) };
    } else {
      stageRect = { left: width * .5, top: height * .18, width: width * .46, height: height * .64 };
    }
    buildLayouts();
    requestRender();
  };
  const onScroll = () => { scroll = window.scrollY; requestRender(); };
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || reduced.matches) return;
    pointerX = event.clientX / width - .5;
    pointerY = event.clientY / height - .5;
    requestRender();
  };

  function draw(time: number) {
    frame = 0;
    if (document.hidden || contextLost || !materialsReady) return;
    // Render during scroll/interaction only. A stationary page has a stationary eye.
    const delta = Math.min(.05, Math.max(.001, (time - lastTime) / 1000));
    lastTime = time;
    const { workspace } = getState();
    const damping = 1 - Math.exp(-24 * delta);
    currentScroll = reduced.matches ? scroll : THREE.MathUtils.lerp(currentScroll, scroll, damping);
    const targetProgress = anatomyJourney.get();
    currentProgress = reduced.matches ? targetProgress : THREE.MathUtils.lerp(currentProgress, targetProgress, damping);
    currentX = THREE.MathUtils.lerp(currentX, pointerX, damping);
    currentY = THREE.MathUtils.lerp(currentY, pointerY, damping);
    const pose = journeyFrame(workspace ? 1 : currentProgress);
    host.dataset.progress = currentProgress.toFixed(5);
    host.dataset.focus = anatomyStops[pose.index].id;
    pointerRotation.setFromEuler(pointerEuler.set(currentY * .012, currentX * .018, 0));
    for (let i = 0; i < layers.length; i++) {
      const object = layers[i].object, from = layouts[pose.from][i], to = layouts[pose.to][i];
      object.position.lerpVectors(from.position, to.position, pose.blend);
      object.quaternion.slerpQuaternions(from.quaternion, to.quaternion, pose.blend).premultiply(pointerRotation);
      object.scale.lerpVectors(from.scale, to.scale, pose.blend);
    }
    const focusObject = layers.find(part => part.object.name === anatomyStops[pose.index].id)?.object;
    if (focusObject) {
      focusPosition.copy(bounds.find(bound => bound.object === focusObject)!.centre).multiply(focusObject.scale).applyQuaternion(focusObject.quaternion).add(focusObject.position);
      host.dataset.focusZ = focusPosition.z.toFixed(4);
      focusPosition.project(camera);
      host.dataset.focusX = ((focusPosition.x * .5 + .5) * width).toFixed(2);
      host.dataset.focusY = ((-focusPosition.y * .5 + .5) * height).toFixed(2);
      host.dataset.roll = focusObject.rotation.z.toFixed(4);
      host.dataset.yaw = focusObject.rotation.y.toFixed(4);
    }
    const prominence = (id: string) => (anatomyStops[pose.from].id === id ? 1 - pose.blend : 0) + (anatomyStops[pose.to].id === id ? pose.blend : 0);
    corneaMat.opacity = .22 + prominence('cornea') * .35;
    corneaMat.envMapIntensity = .75 + prominence('cornea') * .65;
    vitreousMat.opacity = .16 + prominence('vitreous') * .26;
    vitreousMat.envMapIntensity = .35 + prominence('vitreous') * .5;
    retinaMat.emissiveIntensity = .015;
    const beyond = clampProgress((currentScroll - anatomyJourney.end) / (height * .55));
    host.style.setProperty('--scene-opacity', String(workspace ? .28 : 1 - beyond * .44));
    host.style.setProperty('--scene-label-opacity', String(workspace || compact ? 0 : 1 - beyond));
    renderer.render(scene, camera);
    host.dataset.renderer = 'webgl';
    eye.updateMatrixWorld();
    for (const label of labelBindings) {
      point.copy(label.point);
      label.object.localToWorld(point).project(camera);
      let labelX = (point.x * .5 + .5) * width;
      let labelY = (-point.y * .5 + .5) * height;
      if (pose.index > 0 && label.object === focusObject) {
        let right = -Infinity;
        for (const corner of bounds.find(bound => bound.object === focusObject)!.corners) {
          point.copy(corner).applyMatrix4(focusObject.matrixWorld).project(camera);
          right = Math.max(right, (point.x * .5 + .5) * width);
        }
        labelX = Math.min(width - 105, right + 12);
        labelY = Number(host.dataset.focusY);
      }
      label.node.style.transform = `translate(${labelX}px, ${labelY}px)`;
      label.node.style.visibility = label.id === anatomyStops[pose.index].id || (pose.index === 0 && label.id === 'retina') ? 'visible' : 'hidden';
    }
    const moving = Math.abs(targetProgress - currentProgress) > .00002 || Math.abs(scroll - currentScroll) > .12 || Math.abs(pointerX - currentX) > .001 || Math.abs(pointerY - currentY) > .001;
    if (!reduced.matches && moving) requestRender();
  }
  function requestRender() {
    if (!disposed && !frame && !document.hidden && !contextLost) frame = requestAnimationFrame(draw);
  }
  const onVisibility = () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else requestRender();
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    host.dataset.renderer = 'fallback';
  };
  const onContextRestored = () => { contextLost = false; requestRender(); };
  const onPreference = () => { pointerX = 0; pointerY = 0; onResize(); };
  const observer = new ResizeObserver(onResize);
  observer.observe(host);
  // Only view changes remeasure layout. Progress never resets the canvas buffer.
  const stateObserver = new MutationObserver(() => { onResize(); });
  stateObserver.observe(host, { attributes: true, attributeFilter: ['data-view'] });
  const unsubscribeJourney = anatomyJourney.subscribe(requestRender);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onPreference);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
  onResize();

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    stateObserver.disconnect();
    unsubscribeJourney();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    reduced.removeEventListener('change', onPreference);
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    key.shadow.dispose();
    environment.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
