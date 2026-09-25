// Persistent Three.js particle layer that lives above the router.
// It survives route changes, so the same petals & gold sparks that burst on the
// Welcome page fly through the golden flash and settle into the Home page.
import * as THREE from 'three'

const CAM_Z = 10
const FOV = 50
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
const BURST_END = 1.75 // seconds — matches the Welcome page navigate delay (1.7s)

const rand = (a, b) => a + Math.random() * (b - a)
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function petalGeometry() {
  const g = new THREE.PlaneGeometry(1, 1.35, 5, 8)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    pos.setZ(i, x * x * 0.55 - y * y * 0.12) // cupped petal
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

const petalMaterial = () =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      varying vec2 vUv; varying float vShade; varying float vAlpha;
      void main(){
        vUv = uv; vAlpha = aAlpha;
        vec3 n = normalize(mat3(modelViewMatrix * instanceMatrix) * normal);
        vShade = 0.78 + 0.22*abs(n.z);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying float vShade; varying float vAlpha;
      void main(){
        float x = (vUv.x - 0.5) * 2.0, y = vUv.y;
        float w = pow(sin(3.14159 * pow(y, 0.75)), 0.8) * (0.95 - 0.1*y);
        float edge = w - abs(x);
        float a = smoothstep(0.0, 0.08, edge) * vAlpha;
        if (a < 0.01) discard;
        vec3 col = mix(vec3(0.82,0.05,0.08), vec3(1.0,0.48,0.44), smoothstep(0.1,0.95,y)*0.8 + 0.2*(1.0-abs(x)));
        col *= (0.9 + 0.1*sin(x*40.0)) * vShade;
        col += vec3(1.0,0.6,0.5) * pow(1.0 - clamp(edge*5.0,0.0,1.0), 3.0) * 0.25;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

const sparkMaterial = (pixel) =>
  new THREE.ShaderMaterial({
    uniforms: { uPixel: { value: pixel } },
    vertexShader: /* glsl */ `
      attribute float aAlpha; attribute float aSize; attribute float aHue;
      uniform float uPixel;
      varying float vAlpha; varying float vHue;
      void main(){
        vAlpha = aAlpha; vHue = aHue;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixel * (10.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha; varying float vHue;
      void main(){
        vec2 p = gl_PointCoord - 0.5; float d = length(p);
        float core = exp(-d*d*60.0), halo = exp(-d*d*14.0)*0.4;
        float star = exp(-abs(p.x)*40.0)*exp(-abs(p.y)*6.0) + exp(-abs(p.y)*40.0)*exp(-abs(p.x)*6.0);
        float a = (core + halo + star*0.35) * vAlpha;
        vec3 col = mix(vec3(1.0,0.7,0.28), vec3(1.0,0.93,0.72), vHue);
        gl_FragColor = vec4(col*a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

export function createTransitionLayer(container, flashEl) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const mobile = window.matchMedia('(max-width: 760px)').matches
  const NP = reduced ? 30 : mobile ? 55 : 95
  const NS = reduced ? 150 : mobile ? 280 : 520

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2))
  renderer.setClearColor(0x000000, 0)
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60)
  camera.position.set(0, 0, CAM_Z)

  // ---- petals ----
  const pGeo = petalGeometry()
  const pAlpha = new THREE.InstancedBufferAttribute(new Float32Array(NP), 1)
  pAlpha.setUsage(THREE.DynamicDrawUsage)
  pGeo.setAttribute('aAlpha', pAlpha)
  const petals = new THREE.InstancedMesh(pGeo, petalMaterial(), NP)
  petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  petals.frustumCulled = false
  scene.add(petals)
  const P = Array.from({ length: NP }, () => ({
    p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), rv: new THREE.Vector3(),
    s: 0.2, a: 0, target: 0, alive: false, phase: Math.random() * 6.28, fall: rand(0.55, 1.1),
  }))

  // ---- gold sparks ----
  const sGeo = new THREE.BufferGeometry()
  const sPos = new THREE.BufferAttribute(new Float32Array(NS * 3), 3).setUsage(THREE.DynamicDrawUsage)
  const sA = new THREE.BufferAttribute(new Float32Array(NS), 1).setUsage(THREE.DynamicDrawUsage)
  const sSize = new THREE.BufferAttribute(new Float32Array(NS), 1)
  const sHue = new THREE.BufferAttribute(new Float32Array(NS), 1)
  for (let i = 0; i < NS; i++) {
    sSize.array[i] = rand(1.5, 5)
    sHue.array[i] = Math.random()
  }
  sGeo.setAttribute('position', sPos)
  sGeo.setAttribute('aAlpha', sA)
  sGeo.setAttribute('aSize', sSize)
  sGeo.setAttribute('aHue', sHue)
  const sparks = new THREE.Points(sGeo, sparkMaterial(1))
  sparks.frustumCulled = false
  scene.add(sparks)
  const S = Array.from({ length: NS }, () => ({
    p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, alive: false, tw: Math.random() * 6.28,
  }))

  // half extents of the visible area at depth z
  const half = (z) => {
    const h = (CAM_Z - z) * TAN
    return { w: h * camera.aspect, h }
  }

  // ---- spawners ----
  function petalBurst(o) {
    const ang = Math.random() * Math.PI * 2
    const r = Math.random() * 1.2
    o.p.set(Math.cos(ang) * r, -0.4 + Math.sin(ang) * r * 0.6, rand(-1, 1))
    const sp = rand(6, 15)
    o.v.set(Math.cos(ang) * sp, Math.sin(ang) * sp * 0.75 + 1, rand(3, 9))
    o.r.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28))
    o.rv.set(rand(-6, 6), rand(-6, 6), rand(-4, 4))
    o.s = rand(0.18, 0.34)
    o.a = 1
    o.target = 1
    o.alive = true
  }
  function petalEnter(o) {
    // fly in from deep behind the flash toward the viewer, then settle
    const z = rand(-24, -10)
    const hh = half(z)
    o.p.set(rand(-hh.w, hh.w), rand(-hh.h * 0.6, hh.h), z)
    o.v.set(-o.p.x * rand(0.05, 0.2), rand(-1.5, 0.5), rand(14, 24))
    o.rv.set(rand(-5, 5), rand(-5, 5), rand(-3, 3))
    o.s = rand(0.18, 0.34)
    o.a = 0
    o.target = 1
    o.alive = true
  }
  function petalAmbient(o, fromTop) {
    const z = rand(-6, 4)
    const hh = half(z)
    o.p.set(rand(-hh.w, hh.w), fromTop ? hh.h + rand(0.3, 2) : rand(-hh.h, hh.h), z)
    o.v.set(0, -o.fall, 0)
    o.rv.set(rand(-1.5, 1.5), rand(-1.5, 1.5), rand(-1, 1))
    o.s = rand(0.2, 0.36)
    o.a = fromTop ? 1 : 0
    o.target = 1
    o.alive = true
  }
  function sparkBurst(o) {
    const ang = Math.random() * Math.PI * 2
    const sp = rand(3, 13)
    o.p.set(rand(-0.4, 0.4), rand(-0.6, 0.2), rand(-0.5, 0.5))
    o.v.set(Math.cos(ang) * sp, Math.sin(ang) * sp * 0.7, rand(0, 7))
    o.life = 0
    o.max = rand(1.2, 2.2)
    o.alive = true
  }
  function sparkEnter(o) {
    const z = rand(-22, -6)
    const hh = half(z)
    o.p.set(rand(-hh.w, hh.w), rand(-hh.h, hh.h), z)
    o.v.set(-o.p.x * 0.1, rand(-0.5, 0.5), rand(10, 20))
    o.life = 0
    o.max = rand(2.5, 6)
    o.alive = true
  }
  function sparkAmbient(o) {
    const z = rand(-6, 5)
    const hh = half(z)
    o.p.set(rand(-hh.w, hh.w), rand(-hh.h, hh.h), z)
    o.v.set(rand(-0.15, 0.15), rand(0.05, 0.35), 0)
    o.life = 0
    o.max = rand(3, 7)
    o.alive = true
  }

  // ---- state ----
  let mode = 'idle' // idle | burst | live
  let t0 = 0
  let ambient = false
  let running = false
  let last = performance.now()
  const ambientPetals = Math.round(NP * 0.45)
  const ambientSparks = Math.round(NS * 0.35)
  const dummy = new THREE.Object3D()

  function resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    sparks.material.uniforms.uPixel.value = renderer.getPixelRatio() * (h / 900)
  }
  window.addEventListener('resize', resize)
  resize()

  function run() {
    if (running) return
    running = true
    last = performance.now()
    renderer.setAnimationLoop(tick)
  }

  function tick() {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const T = (now - t0) / 1000
    const time = now / 1000

    // switch from burst to fly-in exactly when the route changes
    if (mode === 'burst' && T >= BURST_END) {
      mode = 'live'
      P.forEach(petalEnter)
      S.forEach(sparkEnter)
    }

    // golden flash that bridges the two pages
    if (flashEl) {
      const f = mode === 'idle' ? 0 : smooth(0.95, 1.7, T) * (1 - smooth(1.85, 3.0, T))
      flashEl.style.opacity = f.toFixed(3)
    }

    let anyAlive = false

    // petals
    for (let i = 0; i < NP; i++) {
      const o = P[i]
      if (!o.alive) {
        o.a = 0
      } else {
        anyAlive = true
        const drag = mode === 'burst' ? 1.1 : 2.2
        const k = Math.exp(-drag * dt)
        // settle toward a gentle falling drift with sway
        const sway = Math.sin(time * 0.9 + o.phase) * 0.45
        o.v.x = o.v.x * k + sway * (1 - k)
        o.v.y = o.v.y * k + -o.fall * (1 - k)
        o.v.z = o.v.z * k
        o.p.addScaledVector(o.v, dt)
        const spin = mode === 'burst' ? 1 : 0.35 + 0.65 * Math.exp(-(T - BURST_END))
        o.r.addScaledVector(o.rv, dt * spin)
        o.a += (o.target - o.a) * Math.min(1, dt * 3)
        const hh = half(o.p.z)
        const out = o.p.y < -hh.h - 1 || o.p.z > CAM_Z - 1 || Math.abs(o.p.x) > hh.w + 3
        if (out && mode === 'live') {
          if (ambient && i < ambientPetals) petalAmbient(o, true)
          else o.alive = false
        }
        // when leaving the Home page, fade everything away
        if (mode === 'live' && !ambient && T > 4) o.target = 0
        if (o.target === 0 && o.a < 0.02) o.alive = false
      }
      dummy.position.copy(o.p)
      dummy.rotation.set(o.r.x, o.r.y, o.r.z)
      dummy.scale.setScalar(o.alive ? o.s : 0.0001)
      dummy.updateMatrix()
      petals.setMatrixAt(i, dummy.matrix)
      pAlpha.array[i] = o.a
    }
    petals.instanceMatrix.needsUpdate = true
    pAlpha.needsUpdate = true

    // sparks
    for (let i = 0; i < NS; i++) {
      const o = S[i]
      let a = 0
      if (o.alive) {
        anyAlive = true
        o.life += dt
        const k = Math.exp(-(mode === 'burst' ? 1.4 : 1.8) * dt)
        o.v.multiplyScalar(k)
        o.v.y += 0.12 * dt // embers float upward
        o.p.addScaledVector(o.v, dt)
        const lf = o.life / o.max
        a = Math.sin(Math.min(1, lf) * Math.PI) * (0.6 + 0.4 * Math.sin(time * 7 + o.tw))
        if (lf >= 1 || o.p.z > CAM_Z - 0.5) {
          if (mode === 'live' && ambient && i < ambientSparks) sparkAmbient(o)
          else o.alive = false
        }
      }
      sPos.array[i * 3] = o.p.x
      sPos.array[i * 3 + 1] = o.p.y
      sPos.array[i * 3 + 2] = o.p.z
      sA.array[i] = a
    }
    sPos.needsUpdate = true
    sA.needsUpdate = true

    renderer.render(scene, camera)

    if (!anyAlive && mode !== 'burst' && T > 3.2) {
      mode = 'idle'
      running = false
      renderer.setAnimationLoop(null)
      renderer.clear()
      if (flashEl) flashEl.style.opacity = '0'
    }
  }

  return {
    // called when ENTER is clicked
    start() {
      if (mode === 'burst') return
      mode = 'burst'
      t0 = performance.now()
      P.forEach(petalBurst)
      S.forEach(sparkBurst)
      run()
    },
    // keep a gentle drift of petals & gold dust while on the Home page
    setAmbient(on) {
      ambient = on
      if (on && mode === 'idle') {
        // landed on /home directly (refresh / deep link): fade particles in
        mode = 'live'
        t0 = performance.now() - (BURST_END + 3) * 1000
        P.forEach((o, i) => (i < ambientPetals ? petalAmbient(o, false) : (o.alive = false)))
        S.forEach((o, i) => (i < ambientSparks ? sparkAmbient(o) : (o.alive = false)))
        run()
      }
    },
    dispose() {
      renderer.setAnimationLoop(null)
      window.removeEventListener('resize', resize)
      pGeo.dispose()
      petals.material.dispose()
      sGeo.dispose()
      sparks.material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
