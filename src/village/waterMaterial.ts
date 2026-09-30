// The lab's water shader (prototypes/city/watermat.js) fitted to the mesh the
// demo's buildWater makes: normal-map ripples in three scales that drift along
// the flow, schlick fresnel over a sky gradient with a sun glint, a depth tint
// (shallow bed shows through), a thin foam line at the waterline and an alpha
// that fades to nothing where the surface meets the bank. `shoreDist` (metres
// from dry land) stands in for depth, `flowDir` for the current.

import { Color, DoubleSide, ShaderMaterial, UniformsLib, UniformsUtils, Vector3, type Texture } from 'three'

export function createWaterMaterial(o: { normals: Texture; sunDir: Vector3; horizon: number; top: number }): ShaderMaterial {
  const U = UniformsUtils.merge([UniformsLib.fog, {
    uTime: { value: 0 }, uNormals: { value: o.normals }, uSun: { value: o.sunDir.clone().normalize() },
    uShallow: { value: new Color(0x5a8f7e) }, uDeep: { value: new Color(0x17475c) },
    uSkyTop: { value: new Color(o.top) }, uSkyHor: { value: new Color(o.horizon) },
  }])
  return new ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, fog: true, side: DoubleSide,
    vertexShader: `
      attribute float shoreDist; attribute vec2 flowDir; attribute float edgeAlpha;
      varying float vDepth; varying vec2 vFlow; varying vec3 vWP; varying float vEdge;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vDepth = shoreDist * 0.1; vFlow = flowDir * 0.03; vEdge = edgeAlpha;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform sampler2D uNormals; uniform vec3 uSun, uShallow, uDeep, uSkyTop, uSkyHor;
      varying float vDepth; varying vec2 vFlow; varying vec3 vWP; varying float vEdge;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vWP.xz;
        float fl = length(vFlow) * 30.0;
        vec2 f1 = vFlow * uTime * 0.9, f2 = vFlow * uTime * 0.55;
        vec2 still1 = vec2(0.030, 0.021) * uTime, still2 = vec2(-0.017, 0.026) * uTime;
        vec3 a = texture2D(uNormals, p * 0.085 - f1 + still1 * (1.0 - min(fl, 1.0))).xyz * 2.0 - 1.0;
        vec3 b = texture2D(uNormals, p * 0.31 - f2 + still2 * (1.0 - min(fl, 1.0)) + 0.4).xyz * 2.0 - 1.0;
        vec3 c = texture2D(uNormals, p * 0.9 - f1 * 0.4 + 0.7).xyz * 2.0 - 1.0;
        vec2 nn = a.xy * 0.55 + b.xy * 0.4 + c.xy * 0.18;
        float dist = length(cameraPosition - vWP);
        nn *= mix(1.0, 0.25, smoothstep(120.0, 900.0, dist));
        vec3 N = normalize(vec3(nn.x * 0.55, 1.0, -nn.y * 0.55));
        vec3 V = normalize(cameraPosition - vWP);
        vec3 R = reflect(-V, N);
        float ndv = max(dot(N, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 sky = mix(uSkyHor, uSkyTop, smoothstep(0.0, 0.6, max(R.y, 0.0)));
        float sunG = pow(max(dot(R, normalize(uSun)), 0.0), 220.0) * 2.5 + pow(max(dot(R, normalize(uSun)), 0.0), 18.0) * 0.12;
        float d = max(vDepth, 0.0);
        vec3 body = mix(uShallow, uDeep, smoothstep(0.1, 2.4, d));
        body *= 0.8 + 0.2 * a.z;
        vec3 col = mix(body, sky, clamp(fres * 1.15 + 0.06, 0.0, 1.0)) + vec3(1.0, 0.93, 0.8) * sunG;
        float shore = 1.0 - smoothstep(0.02, 0.35, d);
        float foam = shore * smoothstep(0.25, 0.85, a.z * 0.5 + b.z * 0.5 + 0.1) * 0.3;
        col = mix(col, vec3(0.9, 0.95, 0.95), foam);
        float alpha = vEdge * mix(0.66, 0.97, smoothstep(0.1, 1.6, d));
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  })
}
