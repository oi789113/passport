import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const modelUrl = './us_passport.glb';
const container = document.querySelector('#canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.001, 20);
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = new RoomEnvironment();
scene.environment = pmrem.fromScene(environment, 0.04).texture;
scene.environmentIntensity = 0.45;
environment.dispose();
pmrem.dispose();

const hemi = new THREE.HemisphereLight(0xcbd9ff, 0x44311e, 0.8);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe7bd, 2.0);
key.position.set(-0.12,0.18,0.2);
key.castShadow = true;
key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left = -.16; key.shadow.camera.right = .16;
key.shadow.camera.top = .16; key.shadow.camera.bottom = -.16;
key.shadow.camera.near = .01; key.shadow.camera.far = 1;
key.shadow.bias = -.00001;
scene.add(key);
const fill = new THREE.DirectionalLight(0x9ec6ff, 0.7);
fill.position.set(.15,-.05,.12);scene.add(fill);
const edge = new THREE.DirectionalLight(0xffffff, 1.0);
edge.position.set(-.1,-.1,-.02);scene.add(edge);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .065;
controls.minDistance = .11;
controls.maxDistance = .6;
controls.enablePan = false;
controls.autoRotateSpeed = .7;
controls.rotateSpeed = .65;
controls.zoomSpeed = .75;
let model;
let dirty=true;
controls.addEventListener("change",()=>{dirty=true;});
let bounds;
const home = new THREE.Vector3(.115,-.085,.245);
function reset(front=false){
  const center = bounds ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3();
  camera.up.set(0,1,0);
  camera.position.copy(front ? new THREE.Vector3(0,0,.26) : home).add(center);
  controls.target.copy(center);
  controls.update();
}
reset();
new GLTFLoader().load(modelUrl, gltf => {
  model = gltf.scene;
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  scene.add(model);
  dirty=true;
  bounds = new THREE.Box3().setFromObject(model);
  reset();
  document.querySelector('#loading').classList.add('done');
  document.querySelector('#status').textContent='模型已就绪';
}, undefined, err => {
  document.querySelector('#loading').innerHTML='<div class="error">模型加载失败，请使用支持 WebGL 的浏览器打开。</div>';
  console.error(err);
});

const autoButton = document.querySelector('#rotate');
function toggleRotate(){
  controls.autoRotate = !controls.autoRotate;
  autoButton.classList.toggle('active',controls.autoRotate);
  autoButton.setAttribute('aria-pressed',String(controls.autoRotate));
  document.querySelector('#rotate-label').textContent = controls.autoRotate ? '停止旋转' : '自动旋转';
}
autoButton.addEventListener('click',toggleRotate);
document.querySelector('#reset').addEventListener('click',()=>reset());
document.querySelector('#front').addEventListener('click',()=>{if(controls.autoRotate)toggleRotate();reset(true);});
document.querySelector('#download').addEventListener('click',()=>{
  const a=document.createElement('a');a.href=modelUrl;a.download='us_passport.glb';a.click();
});
document.addEventListener('keydown',e=>{if(e.code==='KeyR')reset();if(e.code==='Space'){e.preventDefault();toggleRotate();}});
function resize(){
  dirty=true;
  const {width,height} = container.getBoundingClientRect();
  renderer.setSize(width,height);
  camera.aspect=width/height;
  camera.fov = width<600 ? 39 : 32;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);resize();
renderer.setAnimationLoop(()=>{controls.update();if(dirty){renderer.render(scene,camera);dirty=false;}});
window.__passportViewer={scene,camera,controls,renderer,get model(){return model;}};
