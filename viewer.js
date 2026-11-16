import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ModelLibrary } from './model-library.js';

const passports = {
  us: { title: '美国护照', country: 'UNITED STATES OF AMERICA', description: '深蓝封皮 · 金色压印 · 分层纸页', url: './us_passport.glb', filename: 'us_passport.glb', rotationX: 0, credit: '封面：Siirski / FireDragonValo', source: 'https://commons.wikimedia.org/wiki/File:United_States_Passport.svg' },
  taiwan: { title: '台湾护照', country: 'TAIWAN', description: '墨绿封皮 · 金色烫印 · 分层纸页', url: './taiwan_passport.glb', filename: 'taiwan_passport.glb', rotationX: Math.PI / 2, credit: '封面参考：领事事务局', source: 'https://www.boca.gov.tw/cp-296-5848-c6720-1.html' },
  'hong-kong': { title: '香港护照', country: 'HONG KONG SPECIAL ADMINISTRATIVE REGION', description: '深蓝封皮 · 金色烫印 · 分层纸页', url: './hong_kong_passport.glb', filename: 'hong_kong_passport.glb', rotationX: Math.PI / 2, credit: '封面：Chatsven · CC BY-SA 4.0', source: 'https://github.com/oi789113/passport/blob/main/ASSET_LICENSES.md#香港护照' },
  macau: { title: '澳门护照', country: 'MACAO SPECIAL ADMINISTRATIVE REGION', description: '深绿封皮 · 金色烫印 · 分层纸页', url: './macau_passport.glb', filename: 'macau_passport.glb', rotationX: Math.PI / 2, credit: '封面：Chatsven · 公共领域', source: 'https://commons.wikimedia.org/wiki/File:Macao-PASSPORT.svg' },
};
const $ = selector => document.querySelector(selector);
const buttons = [...document.querySelectorAll('[data-passport]')];
const loading = $('#loading'), loadingText = $('#loading-text'), progress = $('#loading-progress');
const retry = $('#retry'), status = $('#status');
const toolbar = [...document.querySelectorAll('.toolbar button')];
const validId = id => Object.hasOwn(passports, id) ? id : 'us';
const fromUrl = () => validId(new URL(location.href).searchParams.get('passport'));
let requestedId = fromUrl();

function initialize() {
  const container = $('#canvas');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .001, 20);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  container.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '拖动旋转护照，滚轮或双指缩放，R 重置视角。');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  scene.environment = pmrem.fromScene(environment, .04).texture;
  scene.environmentIntensity = .45;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xcbd9ff, 0x44311e, .8));
  function light(color, intensity, x, y, z) {
    const source = new THREE.DirectionalLight(color, intensity);
    source.position.set(x, y, z); scene.add(source);
  }
  light(0xffe7bd, 2, -.12, .18, .2);
  light(0x9ec6ff, .7, .15, -.05, .12);
  light(0xffffff, 1, -.1, -.1, -.02);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .065;
  controls.enablePan = false;
  controls.autoRotateSpeed = .7;
  controls.rotateSpeed = .65;
  controls.zoomSpeed = .75;
  let dirty = true, model = null, activeId = null, bounds = null;
  let fitDistance = .26;
  const home = new THREE.Vector3(.115, -.085, .245);
  const homeDirection = home.clone().normalize();
  controls.addEventListener('change', () => { dirty = true; });

  function reset(direction = 'home') {
    const center = bounds ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    const distance = Math.max(direction === 'home' ? home.length() : .26, fitDistance);
    const view = direction === 'front' ? new THREE.Vector3(0, 0, 1) : direction === 'back' ? new THREE.Vector3(0, 0, -1) : homeDirection;
    camera.up.set(0, 1, 0);
    camera.position.copy(view).multiplyScalar(distance).add(center);
    controls.target.copy(center);
    controls.update();
    dirty = true;
  }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    const previousFit = fitDistance;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.fov = width < 600 ? 39 : 32;
    camera.updateProjectionMatrix();
    const size = bounds ? bounds.getSize(new THREE.Vector3()) : new THREE.Vector3(.088, .125, .005);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    fitDistance = Math.max(.26, size.y * .6 / tanHalf, size.x * .6 / (tanHalf * camera.aspect));
    controls.minDistance = .11;
    controls.maxDistance = Math.max(.6, fitDistance * 1.8);
    if (camera.position.lengthSq()) {
      camera.position.sub(controls.target).multiplyScalar(fitDistance / previousFit).add(controls.target);
    }
    controls.update(); dirty = true;
  }
  reset();
  new ResizeObserver(resize).observe(container); resize();

  const loader = new GLTFLoader();
  const library = new ModelLibrary({
    loadModel(id) {
      return new Promise((resolve, reject) => loader.load(passports[id].url, gltf => resolve(gltf.scene), event => {
        if (requestedId === id && event.total) progress.textContent = `${Math.round(event.loaded / event.total * 100)}%`;
      }, reject));
    },
    prepareModel(object, id) {
      // All files use metres. The new book models face +Y in glTF; rotate them to +Z.
      object.rotation.x = passports[id].rotationX;
      const anisotropy = renderer.capabilities.getMaxAnisotropy();
      object.traverse(mesh => {
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) for (const key of ['map', 'normalMap', 'metalnessMap', 'roughnessMap']) {
          if (material[key]) material[key].anisotropy = anisotropy;
        }
      });
      object.updateMatrixWorld(true);
      return object;
    },
    pending(id) {
      requestedId = id;
      for (const button of buttons) {
        const selected = button.dataset.passport === id;
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-busy', String(selected));
      }
      toolbar.forEach(button => { button.disabled = true; });
      retry.hidden = true;
      progress.textContent = '';
      loadingText.textContent = `正在载入${passports[id].title}…`;
      loading.querySelector('.loader').hidden = false;
      loading.classList.remove('done');
      status.textContent = `正在载入${passports[id].title}`;
      container.setAttribute('aria-busy', 'true');
    },
    activateModel(id, object) {
      if (model) scene.remove(model);
      model = object;
      scene.add(model);
      activeId = id;
      bounds = new THREE.Box3().setFromObject(model);
      resize(); reset();
      const definition = passports[id];
      $('#passport-country').textContent = definition.country;
      $('#passport-title').textContent = definition.title;
      $('#passport-description').textContent = definition.description;
      $('#asset-credit').textContent = definition.credit;
      $('#asset-credit').href = definition.source;
      document.title = `${definition.title} · 护照 3D 展示`;
      container.setAttribute('aria-label', `可旋转缩放的${definition.title}三维模型`);
      container.setAttribute('aria-busy', 'false');
      loading.classList.add('done');
      retry.hidden = true;
      buttons.forEach(button => button.setAttribute('aria-busy', 'false'));
      toolbar.forEach(button => { button.disabled = false; });
      status.textContent = `${definition.title}已就绪`;
      dirty = true;
    },
    failure(id, error) {
      console.error(`Unable to load ${id} passport`, error);
      loading.querySelector('.loader').hidden = true;
      loadingText.textContent = `${passports[id].title}加载失败，请重试或切换另一本。`;
      progress.textContent = '';
      status.textContent = '加载失败';
      retry.hidden = false;
      buttons.forEach(button => button.setAttribute('aria-busy', 'false'));
      container.setAttribute('aria-busy', 'false');
    },
  });

  function select(id, writeHistory = true) {
    id = validId(id);
    if (writeHistory) {
      const url = new URL(location.href); url.searchParams.set('passport', id);
      if (url.href !== location.href) history.pushState({ passport: id }, '', url);
    }
    return library.select(id);
  }
  buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.passport)));
  window.addEventListener('popstate', () => select(fromUrl(), false));
  retry.addEventListener('click', () => select(requestedId, false));
  select(requestedId, false);

  const autoButton = $('#rotate');
  function toggleRotate() {
    controls.autoRotate = !controls.autoRotate;
    autoButton.classList.toggle('active', controls.autoRotate);
    autoButton.setAttribute('aria-pressed', String(controls.autoRotate));
    $('#rotate-label').textContent = controls.autoRotate ? '停止旋转' : '自动旋转';
    dirty = true;
  }
  autoButton.addEventListener('click', toggleRotate);
  $('#reset').addEventListener('click', () => reset());
  $('#front').addEventListener('click', () => { if (controls.autoRotate) toggleRotate(); reset('front'); });
  $('#back').addEventListener('click', () => { if (controls.autoRotate) toggleRotate(); reset('back'); });
  $('#download').addEventListener('click', () => {
    if (!activeId || requestedId !== activeId) return;
    const link = document.createElement('a');
    link.href = passports[activeId].url;
    link.download = passports[activeId].filename;
    link.click();
  });
  document.addEventListener('keydown', event => {
    if (event.target.closest('button, a, input, select, textarea') || activeId !== requestedId) return;
    if (event.code === 'KeyR') reset();
    if (event.code === 'Space') { event.preventDefault(); toggleRotate(); }
  });
  renderer.setAnimationLoop(() => {
    controls.update();
    if (dirty) { renderer.render(scene, camera); dirty = false; }
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    loadingText.textContent = '图形显示中断，请刷新页面后重试。';
    loading.querySelector('.loader').hidden = true;
    progress.textContent = ''; loading.classList.remove('done');
    toolbar.forEach(button => { button.disabled = true; });
  });
  window.__passportViewer = { scene, camera, controls, renderer, library, get model() { return model; }, get activeId() { return activeId; }, get requestedId() { return requestedId; } };
}

try { initialize(); }
catch (error) {
  console.error(error);
  loading.querySelector('.loader').hidden = true;
  loadingText.textContent = '当前浏览器无法启动 3D，请使用支持 WebGL 的浏览器。';
  progress.textContent = '';
  status.textContent = '3D 显示不可用';
}
