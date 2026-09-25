// Nobo Rupe Nobo Durga — Three.js welcome scene
// Layers: shader background plate (silk / water / diyas / sparkles animated),
// floating 3D title layers, instanced 3D petals, gold particle streams,
// rising embers, bokeh, bloom post-processing and mouse-driven camera parallax.
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

import plateUrl from '../../assets/welcome/plate.webp'
import maskUrl from '../../assets/welcome/mask.webp'
import enOrnTop from '../../assets/welcome/ornTop.webp'
import enLine1 from '../../assets/welcome/line1.webp'
import enLine2 from '../../assets/welcome/line2.webp'
import enOrnBot from '../../assets/welcome/ornBot.webp'
import bnOrnTop from '../../assets/welcome/bn/ornTop.webp'
import bnLine1 from '../../assets/welcome/bn/line1.webp'
import bnLine2 from '../../assets/welcome/bn/line2.webp'
import bnOrnBot from '../../assets/welcome/bn/ornBot.webp'
import LAYOUT from '../../assets/welcome/layers.json'

// Mockup is 1672 x 940 px. 1 world unit = 100 px, plate centred at origin.
const IMG_W = 1672
const IMG_H = 940
const PLATE_W = IMG_W / 100
const PLATE_H = IMG_H / 100
const OVERSCAN = 1.07 // room for parallax without showing plate edges
const FOV = 30
const px2w = (px, py) => new THREE.Vector2((px - IMG_W / 2) / 100, (IMG_H / 2 - py) / 100)

// Title layers cut from the EN / BN mockups (boxes in layers.json: [x, y, w, h] image px).
// Every title layer sits on the SAME depth plane so glyph pieces can never drift apart.
const TITLE_Z = 1.25
const BTN_Z = TITLE_Z
const URLS = {
  en: { ornTop: enOrnTop, line1: enLine1, line2: enLine2, ornBot: enOrnBot },
  bn: { ornTop: bnOrnTop, line1: bnLine1, line2: bnLine2, ornBot: bnOrnBot },
}
const SEQUENCE = [
  { key: 'ornTop', start: 0.9, dur: 1.0 },
  { key: 'line1', start: 1.3, dur: 1.1 },
  { key: 'line2', start: 1.8, dur: 1.5, wipe: true },
  { key: 'ornBot', start: 2.7, dur: 1.0 },
]
const LANGS = ['en', 'bn']
const LAYERS = LANGS.flatMap((lang) =>
  SEQUENCE.map((q) => ({ ...q, lang, url: URLS[lang][q.key], box: LAYOUT[lang].layers[q.key], z: TITLE_Z }))
)
// shared block bounds of both languages (title + button), so switching never shifts the layout
const BLOCK = (() => {
  let l = 1e9, t = 1e9, r = -1e9, b = -1e9
  for (const lang of LANGS) {
    for (const [x, y, w, h] of [...Object.values(LAYOUT[lang].layers), LAYOUT[lang].btn]) {
      l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x + w); b = Math.max(b, y + h)
    }
  }
  return { l, t, r, b }
})()
const TITLE_CENTER = px2w((BLOCK.l + BLOCK.r) / 2, (BLOCK.t + BLOCK.b) / 2)
const TITLE_BLOCK_W = (BLOCK.r - BLOCK.l) / 100

const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
`

// ---------- background plate ----------
function makePlate(tex, mask) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPlate: { value: tex },
      uMask: { value: mask },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2() },
      uIntro: { value: 0 },
      uFlash: { value: 0 },
      uMotion: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPlate, uMask;
      uniform float uTime, uIntro, uFlash, uMotion;
      uniform vec2 uMouse;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main(){
        float t = uTime * uMotion;
        vec2 uv = vUv;
        vec3 m = texture2D(uMask, uv).rgb;
        float silk = m.r, water = m.g, flame = m.b;

        // goddess region (face + crown)
        vec2 gc = vec2(845.0/1672.0, 1.0 - 250.0/940.0);
        vec2 gd = (uv - gc) * vec2(1672.0/300.0, 940.0/300.0);
        float god = clamp(exp(-pow(dot(gd,gd), 2.0)) * 1.6, 0.0, 1.0);

        // pseudo depth for internal parallax
        float depth = 0.35 + 0.25*silk + 0.5*water - 0.25*god;
        uv += uMouse * depth * 0.006;

        // flowing silk: travelling waves along the drapes
        vec2 w = vec2(
          sin(uv.y*16.0 - t*1.25 + uv.x*7.0) + 0.5*sin(uv.y*31.0 + t*0.9),
          cos(uv.x*13.0 - t*1.05 + uv.y*6.0) + 0.5*cos(uv.x*27.0 - t*1.6)
        );
        uv += w * 0.0042 * silk;

        // goddess: slow divine breathing
        uv = mix(uv, gc + (uv-gc)*(1.0 - 0.007*sin(t*0.7)), god);

        // water ripples
        uv.x += sin(uv.y*260.0 + t*2.4) * 0.0016 * water;
        uv.y += sin(uv.x*85.0 - t*1.6 + sin(uv.y*140.0 + t)) * 0.0011 * water;

        vec3 col = texture2D(uPlate, uv).rgb;
        float lum = dot(col, vec3(0.3,0.59,0.11));

        // water glints
        float g = pow(max(0.0, sin(uv.x*420.0 + t*2.6 + sin(uv.y*600.0 - t*1.3)*2.0)), 24.0);
        col += water * g * smoothstep(0.35, 0.8, lum) * vec3(1.0,0.72,0.35) * 0.35;

        // diya flames flicker
        float fl = noise(vec2(uv.x*38.0, t*7.0)) * 0.6 + noise(vec2(uv.x*90.0, t*13.0)) * 0.4;
        col *= 1.0 + flame * (fl - 0.45) * 0.55;
        col += flame * vec3(1.0,0.55,0.18) * 0.10 * fl;

        // sparkle twinkle on bright points / gold streaks
        float sp = smoothstep(0.62, 0.92, lum) * (1.0 - god*0.6) * (1.0 - water*0.5);
        float tw = noise(uv*vec2(170.0,95.0) + vec2(t*1.7, -t*1.1));
        col += sp * (tw - 0.42) * 0.55 * vec3(1.0,0.82,0.45);

        // golden light sweep over the crown & jewellery
        float sweepPos = mod(t*0.11, 1.8) - 0.3;
        float sweep = exp(-pow((uv.x*0.9 + uv.y*0.45 - sweepPos - 0.35) * 16.0, 2.0));
        col += god * sweep * smoothstep(0.45, 0.8, lum) * vec3(1.0,0.78,0.4) * 0.35;

        // warm glow pulse behind the title
        vec2 tc = (uv - vec2(0.5, 0.37)) * vec2(2.2, 3.4);
        col += vec3(0.55,0.12,0.03) * exp(-dot(tc,tc)*2.0) * (0.18 + 0.06*sin(t*1.3));

        // vignette
        vec2 v = vUv - 0.5;
        col *= 1.0 - dot(v*vec2(0.9,1.1), v*vec2(0.9,1.1)) * 0.55;

        col *= uIntro;
        col = mix(col, vec3(1.0,0.86,0.62), uFlash);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W, PLATE_H), mat)
  mesh.renderOrder = -10
  return mesh
}

// ---------- title layers ----------
function makeTitleLayer(tex, layer) {
  const [x, y, w, h] = layer.box
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: tex },
      uOpacity: { value: 0 },
      uReveal: { value: layer.wipe ? 0 : 1 },
      uShine: { value: -1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform float uOpacity, uReveal, uShine;
      varying vec2 vUv;
      void main(){
        vec4 c = texture2D(uTex, vUv);
        float wipe = smoothstep(uReveal, uReveal - 0.12, vUv.x - 0.06 + 0.06*(1.0-uReveal));
        float band = exp(-pow((vUv.x - vUv.y*0.35 - uShine) * 7.0, 2.0));
        c.rgb *= 0.9; // keep lettering crisp (just under the bloom threshold)
        c.rgb += band * vec3(1.0,0.86,0.55) * 0.55;
        gl_FragColor = vec4(c.rgb, c.a * uOpacity * wipe);
      }
    `,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w / 100, h / 100), mat)
  const c = px2w(x + w / 2, y + h / 2)
  mesh.userData = { base: new THREE.Vector3(c.x, c.y, layer.z), layer }
  mesh.renderOrder = 5
  return mesh
}

function makeTitleGlow() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity, uTime; varying vec2 vUv;
      void main(){
        vec2 p = (vUv-0.5)*vec2(2.0,2.0);
        float d = exp(-dot(p,p)*2.4);
        gl_FragColor = vec4(vec3(0.62,0.08,0.03)*d, d*0.55*uOpacity*(0.9+0.1*sin(uTime*1.4)));
      }
    `,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 3.6), mat)
  mesh.renderOrder = 4
  return mesh
}

// ---------- 3D petals (instanced, animated on GPU) ----------
function makePetals(count) {
  const base = new THREE.PlaneGeometry(1, 1.35, 5, 8)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = base.index
  geo.setAttribute('position', base.getAttribute('position'))
  geo.setAttribute('uv', base.getAttribute('uv'))
  const start = new Float32Array(count * 3)
  const seed = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    const z = Math.random() < 0.18 ? 2.2 + Math.random() * 1.6 : -0.6 + Math.random() * 2.6
    start.set([(Math.random() * 2 - 1) * 9.5, Math.random(), z], i * 3)
    seed.set([Math.random(), 0.35 + Math.random() * 0.45, 0.14 + Math.random() * 0.12, Math.random()], i * 4)
  }
  geo.setAttribute('aStart', new THREE.InstancedBufferAttribute(start, 3))
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4))
  geo.instanceCount = count

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBurst: { value: 0 }, uOpacity: { value: 0 }, uWind: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aStart; attribute vec4 aSeed;
      uniform float uTime, uBurst, uWind;
      varying vec2 vUv; varying float vShade; varying float vDepth;
      mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1,0,0, 0,c,-s, 0,s,c); }
      mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0,s, 0,1,0, -s,0,c); }
      mat3 rotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,-s,0, s,c,0, 0,0,1); }
      void main(){
        vUv = uv;
        float t = uTime * aSeed.y;
        float range = 12.0;
        float y = 6.0 - mod(aStart.y*range + t*0.9, range);
        float x = aStart.x + sin(t*0.8 + aSeed.x*6.28)*0.7 + uWind*(6.0 - y)*0.08;
        vec3 center = vec3(x, y, aStart.z);
        // burst on ENTER: petals rush outward & toward camera
        vec2 dir = normalize(center.xy + vec2(0.001));
        center += vec3(dir * uBurst * (2.5 + aSeed.w*3.0), uBurst * (2.0 + aSeed.x*3.0));

        vec3 p = position;
        p.z += p.x*p.x*0.55 - p.y*p.y*0.12;           // cupped petal
        float a = t*(1.2 + aSeed.w*1.5) + aSeed.x*20.0;
        mat3 R = rotY(a*0.9) * rotX(a*0.7 + 1.0) * rotZ(a*0.4);
        vec3 n = R * vec3(0.0,0.0,1.0);
        vShade = 0.78 + 0.22*abs(n.z);
        p = R * (p * aSeed.z);
        vec4 mv = modelViewMatrix * vec4(center + p, 1.0);
        vDepth = aStart.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vUv; varying float vShade; varying float vDepth;
      void main(){
        float x = (vUv.x - 0.5) * 2.0;
        float y = vUv.y;
        float w = pow(sin(3.14159 * pow(y, 0.75)), 0.8) * (0.95 - 0.1*y);
        float notch = smoothstep(0.1, 0.0, abs(x)) * smoothstep(0.9, 1.0, y) * 0.12;
        float edge = w - abs(x) - notch;
        float a = smoothstep(0.0, 0.08, edge);
        if (a < 0.01) discard;
        vec3 deep = vec3(0.82, 0.05, 0.08);
        vec3 pink = vec3(1.0, 0.48, 0.44);
        vec3 col = mix(deep, pink, smoothstep(0.1, 0.95, y) * 0.8 + 0.2*(1.0-abs(x)));
        col *= 0.9 + 0.1*sin(x*40.0);                 // faint veins
        col *= vShade;
        col += vec3(1.0,0.6,0.5) * pow(1.0 - clamp(edge*5.0,0.0,1.0), 3.0) * 0.25; // rim light
        float near = smoothstep(2.2, 3.6, vDepth);    // big foreground petals are softer
        gl_FragColor = vec4(col, a * uOpacity * (1.0 - near*0.35));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 8
  return mesh
}

// ---------- gold particle streams, embers, bokeh ----------
function pointsMaterial(frag, extraUniforms = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPixel: { value: 1 }, uBurst: { value: 0 }, ...extraUniforms },
    vertexShader: /* glsl */ `
      attribute vec4 aData; attribute vec3 aExtra;
      uniform float uTime, uPixel, uBurst;
      varying float vAlpha; varying float vHue;
      #define PI 3.14159265
      void main(){
        vec3 pos; float size; float alpha;
        float t = uTime;
        #ifdef STREAM
          // particles ride sweeping sine ribbons like the mockup's gold trails
          float side = aExtra.x;             // -1 left, 1 right
          float s = fract(aData.x + t * aData.y);
          float yb = aExtra.y, amp = aExtra.z;
          pos.x = side * (9.2 - s * 7.6);
          pos.y = yb + amp * sin(s*3.6 + aData.z*6.28 + t*0.35) - s*1.3 + (aData.w-0.5)*0.35;
          pos.z = 0.4 + aData.z*1.4;
          pos.x += (aData.w-0.5)*0.3;
          size = (1.5 + aData.w*3.5);
          alpha = sin(s*PI) * (0.55 + 0.45*sin(t*6.0 + aData.z*40.0));
        #endif
        #ifdef EMBER
          float s = fract(aData.x + t * aData.y);
          pos = vec3(aExtra.x + sin(t*1.5 + aData.z*10.0)*0.25*s, -4.4 + s*4.2, aExtra.z);
          size = 1.5 + aData.w*3.0;
          alpha = sin(s*PI) * (0.6 + 0.4*sin(t*9.0 + aData.z*30.0));
        #endif
        #ifdef BOKEH
          pos = vec3(aExtra.x + sin(t*0.12 + aData.z*6.0)*0.8, aExtra.y + cos(t*0.1 + aData.w*6.0)*0.5, aExtra.z);
          size = 30.0 + aData.w*70.0;
          alpha = 0.18 + 0.12*sin(t*0.6 + aData.z*6.28);
        #endif
        vHue = aData.z;
        pos.xy += normalize(pos.xy + 0.001) * uBurst * 3.0;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * uPixel * (8.0 / -mv.z);
        vAlpha = alpha;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

const SPARK_FRAG = /* glsl */ `
  uniform float uOpacity; varying float vAlpha; varying float vHue;
  void main(){
    vec2 p = gl_PointCoord - 0.5; float d = length(p);
    float core = exp(-d*d*60.0); float halo = exp(-d*d*14.0)*0.35;
    float star = exp(-abs(p.x)*40.0)*exp(-abs(p.y)*6.0) + exp(-abs(p.y)*40.0)*exp(-abs(p.x)*6.0);
    vec3 col = mix(vec3(1.0,0.72,0.3), vec3(1.0,0.92,0.7), vHue);
    float a = (core + halo + star*0.35) * vAlpha * uOpacity;
    gl_FragColor = vec4(col * a, a);
  }
`
const EMBER_FRAG = /* glsl */ `
  uniform float uOpacity; varying float vAlpha; varying float vHue;
  void main(){
    vec2 p = gl_PointCoord - 0.5; float d = length(p);
    float a = exp(-d*d*30.0) * vAlpha * uOpacity;
    gl_FragColor = vec4(mix(vec3(1.0,0.45,0.1), vec3(1.0,0.8,0.4), vHue) * a, a);
  }
`
const BOKEH_FRAG = /* glsl */ `
  uniform float uOpacity; varying float vAlpha; varying float vHue;
  void main(){
    vec2 p = gl_PointCoord - 0.5; float d = length(p);
    float a = smoothstep(0.5, 0.36, d) * (0.6 + 0.4*smoothstep(0.2,0.45,d)) * vAlpha * uOpacity;
    vec3 col = mix(vec3(1.0,0.25,0.2), vec3(1.0,0.7,0.35), vHue);
    gl_FragColor = vec4(col * a, a);
  }
`

function makePoints(count, kind, frag, fill) {
  const geo = new THREE.BufferGeometry()
  const data = new Float32Array(count * 4)
  const extra = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) fill(i, data, extra)
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  geo.setAttribute('aData', new THREE.BufferAttribute(data, 4))
  geo.setAttribute('aExtra', new THREE.BufferAttribute(extra, 3))
  const mat = pointsMaterial(frag)
  mat.defines = { [kind]: 1 }
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  pts.renderOrder = kind === 'BOKEH' ? 9 : 6
  return pts
}

// ---------- helpers ----------
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3)
const easeInOut = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }

function loadTex(loader, url) {
  return new Promise((res, rej) =>
    loader.load(url, (t) => {
      t.colorSpace = THREE.NoColorSpace
      t.minFilter = THREE.LinearMipmapLinearFilter
      t.anisotropy = 4
      res(t)
    }, undefined, rej))
}

// ---------- main ----------
export function createWelcomeScene(container, { buttonEl, onReady, lang = 'bn' } = {}) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const mobile = window.matchMedia('(max-width: 760px)').matches
  const motion = reduced ? 0.25 : 1

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2))
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace // textures are raw sRGB; pass through untouched
  renderer.toneMapping = THREE.NoToneMapping
  renderer.setClearColor(0x1a0000, 1)
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
  const rest = new THREE.Vector3(0, 0, 20)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.5, 0.86)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const titleGroup = new THREE.Group()
  scene.add(titleGroup)

  let plate, petals, streams, embers, bokeh, glow
  const titleMeshes = []
  let ready = false
  let disposed = false

  const state = {
    mouse: new THREE.Vector2(),
    target: new THREE.Vector2(),
    t0: performance.now(),
    enterAt: null,
    onEntered: null,
    titleScale: 1,
    lang,
    langVis: { en: lang === 'en' ? 1 : 0, bn: lang === 'bn' ? 1 : 0 },
    dist: 20,
  }

  const loader = new THREE.TextureLoader()
  Promise.all([plateUrl, maskUrl, ...LAYERS.map((l) => l.url)].map((u) => loadTex(loader, u))).then(([pt, mk, ...lt]) => {
    if (disposed) return
    plate = makePlate(pt, mk)
    plate.scale.setScalar(OVERSCAN)
    scene.add(plate)

    glow = makeTitleGlow()
    titleGroup.add(glow)
    LAYERS.forEach((l, i) => {
      const m = makeTitleLayer(lt[i], l)
      titleMeshes.push(m)
      titleGroup.add(m)
    })

    petals = makePetals(mobile ? 38 : 70)
    scene.add(petals)

    const flows = [
      // side, baseY, amplitude
      [-1, 3.6, 0.9], [-1, 2.2, 0.7], [-1, 0.6, 0.8], [-1, -2.0, 0.6],
      [1, 3.4, 0.8], [1, 1.8, 0.9], [1, 0.2, 0.7], [1, -1.6, 0.6],
    ]
    streams = makePoints(mobile ? 700 : 1400, 'STREAM', SPARK_FRAG, (i, d, e) => {
      const f = flows[i % flows.length]
      d.set([Math.random(), 0.018 + Math.random() * 0.03, Math.random(), Math.random()], i * 4)
      e.set(f, i * 3)
    })
    embers = makePoints(mobile ? 90 : 180, 'EMBER', EMBER_FRAG, (i, d, e) => {
      d.set([Math.random(), 0.05 + Math.random() * 0.08, Math.random(), Math.random()], i * 4)
      e.set([(Math.random() * 2 - 1) * 8.5, 0, -0.2 + Math.random() * 2.2], i * 3)
    })
    bokeh = makePoints(mobile ? 14 : 26, 'BOKEH', BOKEH_FRAG, (i, d, e) => {
      d.set([0, 0, Math.random(), Math.random()], i * 4)
      e.set([(Math.random() * 2 - 1) * 8, (Math.random() * 2 - 1) * 4.5, 1.5 + Math.random() * 3], i * 3)
    })
    scene.add(streams, embers, bokeh)

    resize()
    ready = true
    state.t0 = performance.now()
    onReady?.()
  })

  function resize() {
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight
    const aspect = w / h
    renderer.setSize(w, h)
    composer.setSize(w, h)
    bloom.resolution.set(w, h)
    camera.aspect = aspect
    // "cover": the visible area at z=0 always stays inside the plate
    const visH = Math.min(PLATE_H, PLATE_W / aspect)
    state.dist = visH / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    rest.set(0, 0, state.dist)
    camera.updateProjectionMatrix()
    for (const u of [streams, embers, bokeh]) if (u) u.material.uniforms.uPixel.value = renderer.getPixelRatio() * (h / 900)
    // shrink the title block on narrow screens so it always fits
    const visW = visH * aspect
    state.titleScale = Math.min(1, (visW * 0.92) / TITLE_BLOCK_W)
    layoutTitle()
  }

  function layoutTitle() {
    const s = state.titleScale
    const D = state.dist
    // on narrow screens pull the block to the vertical centre-ish
    const cy = s < 1 ? THREE.MathUtils.lerp(TITLE_CENTER.y, -0.6, 1 - s) : TITLE_CENTER.y
    titleGroup.position.set(TITLE_CENTER.x, cy, 0)
    for (const m of titleMeshes) {
      const b = m.userData.base
      const k = (D - b.z) / D // keeps the mockup size from the rest camera position
      m.position.set((b.x - TITLE_CENTER.x) * k * s, (b.y - TITLE_CENTER.y) * k * s, b.z)
      m.scale.setScalar(k * s)
    }
    if (glow) {
      glow.position.set(0, 0.35 * s, 0.9)
      glow.scale.setScalar(s)
    }
  }

  // project the ENTER button anchor into screen space so the HTML button tracks the 3D title
  const tmpA = new THREE.Vector3()
  const tmpB = new THREE.Vector3()
  function placeButton() {
    if (!buttonEl) return
    const s = state.titleScale
    const D = state.dist
    const k = (D - BTN_Z) / D
    const BTN_BOX = LAYOUT[state.lang].btn
    const c = px2w(BTN_BOX[0] + BTN_BOX[2] / 2, BTN_BOX[1] + BTN_BOX[3] / 2)
    const lx = (c.x - TITLE_CENTER.x) * k * s
    const ly = (c.y - TITLE_CENTER.y) * k * s
    const hw = (BTN_BOX[2] / 200) * k * s
    tmpA.set(lx - hw, ly, BTN_Z)
    tmpB.set(lx + hw, ly, BTN_Z)
    titleGroup.localToWorld(tmpA).project(camera)
    titleGroup.localToWorld(tmpB).project(camera)
    const W = container.clientWidth
    const H = container.clientHeight
    const x1 = (tmpA.x * 0.5 + 0.5) * W
    const x2 = (tmpB.x * 0.5 + 0.5) * W
    const y = (-tmpA.y * 0.5 + 0.5) * H
    const bw = x2 - x1
    buttonEl.style.width = `${bw}px`
    buttonEl.style.transform = `translate3d(${x1}px, ${y - (bw * BTN_BOX[3]) / BTN_BOX[2] / 2}px, 0)`
  }

  function onPointer(e) {
    const r = container.getBoundingClientRect()
    state.target.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
  }
  function onOrient(e) {
    if (e.gamma == null) return
    state.target.set(THREE.MathUtils.clamp(e.gamma / 30, -1, 1), THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1))
  }
  window.addEventListener('pointermove', onPointer)
  window.addEventListener('deviceorientation', onOrient)
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  let last = performance.now()
  renderer.setAnimationLoop(() => {
    if (!ready) return
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const T = (now - state.t0) / 1000 // time since load (intro)
    const t = T * motion

    // smoothed pointer
    state.mouse.lerp(state.target, 1 - Math.pow(0.02, dt))
    const mx = reduced ? 0 : state.mouse.x
    const my = reduced ? 0 : state.mouse.y

    // intro camera dolly + idle drift + parallax
    const intro = easeOut(T / 2.6)
    const idleX = Math.sin(t * 0.21) * 0.08
    const idleY = Math.cos(t * 0.17) * 0.05
    let enterK = 0
    if (state.enterAt !== null) enterK = easeInOut((performance.now() - state.enterAt) / 1600)
    camera.position.set(
      rest.x + mx * 0.32 + idleX,
      rest.y + my * 0.2 + idleY + enterK * 1.6,
      rest.z + (1 - intro) * 2.2 - enterK * (state.dist * 0.55)
    )
    camera.lookAt(mx * 0.08, my * 0.05 + enterK * 2.1, 0)

    // plate
    const pu = plate.material.uniforms
    pu.uTime.value = T
    pu.uMouse.value.set(mx, my)
    pu.uIntro.value = easeOut(T / 1.6)
    pu.uFlash.value = enterK * enterK

    // title: staged reveal, gentle float, 3D tilt, shine sweeps
    titleGroup.rotation.set(-my * 0.05, mx * 0.08, 0)
    titleGroup.position.z = Math.sin(t * 0.8) * 0.06
    const shineCycle = (t % 7) / 7
    for (const lg of LANGS) {
      const target = state.lang === lg ? 1 : 0
      state.langVis[lg] += (target - state.langVis[lg]) * Math.min(1, dt * 5)
    }
    const float = Math.sin(t * 1.1) * 0.025 // one shared float: layers stay locked together
    for (const m of titleMeshes) {
      const l = m.userData.layer
      const u = m.material.uniforms
      const p = easeOut((T - l.start) / l.dur)
      const vis = state.langVis[l.lang]
      u.uOpacity.value = p * vis * (1 - enterK)
      if (l.wipe) u.uReveal.value = 1.2 * easeInOut((T - l.start) / l.dur)
      u.uShine.value = shineCycle * 2.6 - 0.8 + (l.key === 'line1' ? -0.1 : 0)
      const base = m.userData.base
      const k = (state.dist - base.z) / state.dist
      m.position.y = (base.y - TITLE_CENTER.y) * k * state.titleScale + float - (1 - p) * 0.25 - (1 - vis) * 0.12
      m.scale.setScalar(k * state.titleScale * (0.94 + 0.06 * p))
    }
    glow.material.uniforms.uOpacity.value = easeOut((T - 0.8) / 1.5) * (1 - enterK)
    glow.material.uniforms.uTime.value = t

    // particles
    const fadeIn = easeOut((T - 0.4) / 1.8)
    petals.material.uniforms.uTime.value = t
    petals.material.uniforms.uOpacity.value = fadeIn
    petals.material.uniforms.uWind.value = mx * 0.8
    petals.material.uniforms.uBurst.value = enterK * 2.5
    for (const p of [streams, embers, bokeh]) {
      p.material.uniforms.uTime.value = t
      p.material.uniforms.uOpacity.value = fadeIn
      p.material.uniforms.uBurst.value = enterK
    }
    bloom.strength = 0.45 + 0.08 * Math.sin(t * 1.2) + enterK * 0.9

    placeButton()
    composer.render()

    if (state.enterAt !== null && performance.now() - state.enterAt > 1700 && state.onEntered) {
      const cb = state.onEntered
      state.onEntered = null
      cb()
    }
  })

  return {
    setLang(next) {
      if (next === 'en' || next === 'bn') state.lang = next
    },
    enter(cb) {
      if (state.enterAt !== null) return
      state.enterAt = performance.now()
      state.onEntered = cb
    },
    dispose() {
      disposed = true
      renderer.setAnimationLoop(null)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('deviceorientation', onOrient)
      ro.disconnect()
      scene.traverse((o) => {
        o.geometry?.dispose()
        if (o.material) {
          Object.values(o.material.uniforms || {}).forEach((u) => u.value?.isTexture && u.value.dispose())
          o.material.dispose()
        }
      })
      composer.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
