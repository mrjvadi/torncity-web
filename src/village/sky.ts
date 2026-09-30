// The lab's sky dome (prototypes/city/sky.js): a horizon colour that matches
// the fog, a blue zenith, a soft sun and a few procedural cloud banks, drawn
// behind everything with no depth writes.

import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three'

export interface Sky { mesh: Mesh; material: ShaderMaterial; dispose(): void }

export function createSky(sunDir: Vector3, horizon: number, top: number): Sky {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSun: { value: sunDir.clone().normalize() },
      uHor: { value: new Color(horizon) },
      uTop: { value: new Color(top) },
      uTime: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform vec3 uSun, uHor, uTop; uniform float uTime; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=n(p)*a; p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.0);
        vec3 col = mix(uHor, uTop, pow(y, 0.55));
        float sd = max(dot(d, normalize(uSun)), 0.0);
        col += vec3(1.0, 0.9, 0.7) * (pow(sd, 900.0) * 3.0 + pow(sd, 12.0) * 0.16);
        vec2 cp = d.xz / (d.y + 0.12) * 0.75 + vec2(uTime * 0.004, 0.0);
        float c = fbm(cp * 1.15 + 3.0);
        float cov = smoothstep(0.52, 0.80, c) * smoothstep(0.02, 0.26, d.y);
        vec3 cc = mix(vec3(0.82, 0.86, 0.92), vec3(1.0), smoothstep(0.55, 0.85, c));
        col = mix(col, cc, cov * 0.85);
        col = mix(col, uHor, (1.0 - smoothstep(0.0, 0.16, d.y)) * 0.85);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const geo = new SphereGeometry(8000, 24, 12)
  const mesh = new Mesh(geo, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  return { mesh, material, dispose() { geo.dispose(); material.dispose() } }
}
