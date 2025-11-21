import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface GeminiLivePortalIconProps {
  isActive: boolean;
}

const fragmentShader = `
  #define TAU 6.28318530718
  uniform float iTime;
  uniform vec3 iResolution;

  float rand(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u * u * (3.0 - 2.0 * u);

    float res = mix(
      mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
      mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x),
      u.y
    );
    return res * res;
  }

  float fbm(vec2 p, int octaves) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 5; i++) {
      if (i >= octaves) break;
      sum += amp * noise(p);
      norm += amp;
      amp *= 0.5;
      p *= 2.0;
    }
    return sum / norm;
  }

  vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 resolution = iResolution.xy;
    float minRes = min(resolution.x, resolution.y);
    vec2 uv = (fragCoord * 2.0 - resolution.xy) / minRes * 1.5;

    float t = iTime * 0.6;
    float len = dot(uv, uv);
    if (len > 2.8) {
      fragColor = vec4(0.0);
      return;
    }

    float smoothMask = smoothstep(1.05, 0.92, len);
    float distortion = smoothMask * len * len * 1.8;
    vec3 normal = normalize(vec3(uv.x, uv.y, 0.7 - distortion));

    float nx = fbm(uv * 2.0 + t * 0.4 + 25.69, 4);
    float ny = fbm(uv * 2.0 + t * 0.4 + 86.31, 4);
    float n = fbm(uv * 3.0 + 2.0 * vec2(nx, ny), 3);

    vec3 col = vec3(n * 0.5 + 0.25);
    float angle = atan(uv.y, uv.x) / TAU + t * 0.1;
    col *= palette(angle, vec3(0.3), vec3(0.5), vec3(1.0), vec3(0.0, 0.8, 0.8));
    col *= 1.8;

    vec3 absCol = abs(col);
    vec3 c = col * distortion;
    c += (c * 0.5 + vec3(1.0) - dot(c, vec3(0.299, 0.587, 0.114))) * vec3(max(0.0, pow(dot(normal, vec3(0, 0, -1)), 5.0) * 3.0));

    float glow = 1.5 * smoothstep(0.6, 1.0, fbm(normal.xy * 3.0 / (1.0 + normal.z), 2)) * distortion;
    c += glow;

    col = c + col * pow((1.0 - smoothstep(1.0, 0.98, len) - pow(max(0.0, length(uv) - 1.0), 0.2)) * 2.0, 4.0);
    float f = fbm(normalize(uv) * 2.0 + t, 2) + 0.1;
    uv *= f + 0.1;
    uv *= 0.5;
    len = dot(uv, uv);
    vec3 ins = normalize(absCol) + 0.1;
    float ind = 0.2 + pow(smoothstep(0.0, 1.5, sqrt(len)) * 48.0, 0.25);
    ind *= ind * ind * ind;
    ind = 1.0 / ind;
    ins *= ind;
    col += ins * ins * smoothMask * smoothstep(0.7, 1.0, ind);
    col += abs(normal) * (1.0 - distortion) * smoothMask * 0.25;

    fragColor = vec4(col, smoothMask);
  }

  void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
  }
`;

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const GeminiLivePortalIcon: React.FC<GeminiLivePortalIconProps> = ({ isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number>();
  const uniformsRef = useRef({
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector3(1, 1, 1) }
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    rendererRef.current = renderer;
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = uniformsRef.current;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      fragmentShader,
      vertexShader,
      uniforms,
      transparent: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    container.appendChild(renderer.domElement);

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      rendererRef.current.setSize(width, height);
      uniforms.iResolution.value.set(width, height, 1);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const animate = (time: number) => {
      uniforms.iTime.value = time * 0.001;
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className={`transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
      <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border border-cyan-500/30 shadow-[0_0_25px_rgba(34,211,238,0.35)] bg-slate-950/60 backdrop-blur relative overflow-hidden" ref={containerRef} />
      <div className="text-center text-xs text-cyan-200 mt-2 font-semibold uppercase tracking-[0.4em]">
        Live
      </div>
    </div>
  );
};

export default GeminiLivePortalIcon;
