import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Beaker,
  ExternalLink,
  Loader2,
  Package,
  Smartphone,
  Sparkles
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';

declare global {
  interface XRSystem {
    isSessionSupported: (mode: XRSessionMode) => Promise<boolean>;
  }

  interface Navigator {
    xr?: XRSystem;
  }
}

interface ArMolecule {
  id: string;
  name: string;
  cid: string;
  formula: string;
  highlight: string;
  tags: string[];
}

interface DisplayMode {
  id: 'stick' | 'spacefill' | 'wireframe';
  label: string;
}

interface ParsedMolecule {
  atoms: Array<{ element: string; position: [number, number, number] }>;
  bonds: Array<{ start: number; end: number; order: number }>;
}

const AR_MOLECULE_LIBRARY: ArMolecule[] = [
  {
    id: 'benzene',
    name: 'Benzene',
    cid: '241',
    formula: 'C6H6',
    highlight: 'Show resonance and aromaticity in 3D.',
    tags: ['aromatic', 'plan', 'goal']
  },
  {
    id: 'caffeine',
    name: 'Caffeine',
    cid: '2519',
    formula: 'C8H10N4O2',
    highlight: 'Great icebreaker for kinetics & functional groups.',
    tags: ['focus', 'reflection', 'goal']
  },
  {
    id: 'ethanol',
    name: 'Ethanol',
    cid: '702',
    formula: 'C2H6O',
    highlight: 'Spot hydrogen bonding angles instantly.',
    tags: ['lab', 'monitor']
  },
  {
    id: 'aspirin',
    name: 'Aspirin',
    cid: '2244',
    formula: 'C9H8O4',
    highlight: 'Map out esterification steps spatially.',
    tags: ['goal', 'help']
  },
  {
    id: 'glucose',
    name: 'D-Glucose',
    cid: '5793',
    formula: 'C6H12O6',
    highlight: 'Visualise chair flips and stereochemistry.',
    tags: ['monitor', 'reflection']
  },
  {
    id: 'sodium-chloride',
    name: 'Sodium Chloride',
    cid: '5234',
    formula: 'NaCl',
    highlight: 'Crystal lattice anchor for ionic bonding talks.',
    tags: ['help', 'lab']
  }
];

const DISPLAY_MODES: DisplayMode[] = [
  { id: 'stick', label: 'Ball & Stick' },
  { id: 'spacefill', label: 'Space-filling' },
  { id: 'wireframe', label: 'Wireframe' }
];

const PUBCHEM_SDF_ENDPOINT = (cid: string) =>
  `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/SDF?record_type=3d`;

const ATOM_COLORS: Record<string, number> = {
  H: 0xffffff,
  C: 0x444444,
  N: 0x3050f8,
  O: 0xff0d0d,
  F: 0x90e050,
  Cl: 0x1ff01f,
  Br: 0xa62929,
  I: 0x940094,
  P: 0xff8000,
  S: 0xffff30,
  Na: 0xa0a0ff,
  K: 0x8f40d4
};

const ATOM_RADII: Record<string, number> = {
  H: 0.25,
  C: 0.4,
  N: 0.38,
  O: 0.36,
  F: 0.34,
  Cl: 0.42,
  Br: 0.45,
  I: 0.5,
  P: 0.42,
  S: 0.44,
  Na: 0.5,
  K: 0.52
};

const fallbackAtomRadius = 0.38;
const bondRadius = 0.08;

const parseSdf = (sdf: string): ParsedMolecule | null => {
  const lines = sdf.split(/\r?\n/);
  if (lines.length < 4) {
    return null;
  }

  const countsLine = lines[3];
  if (!countsLine) {
    return null;
  }

  const parseCount = (start: number, end: number) =>
    Number.parseInt(countsLine.slice(start, end).trim(), 10) || 0;

  const atomCount = parseCount(0, 3);
  const bondCount = parseCount(3, 6);

  if (!atomCount || atomCount <= 0) {
    return null;
  }

  const atoms: ParsedMolecule['atoms'] = [];
  const bonds: ParsedMolecule['bonds'] = [];

  for (let index = 0; index < atomCount; index += 1) {
    const line = lines[4 + index];
    if (!line) continue;

    const x = Number.parseFloat(line.slice(0, 10).trim());
    const y = Number.parseFloat(line.slice(10, 20).trim());
    const z = Number.parseFloat(line.slice(20, 30).trim());
    const element = line.slice(31, 34).trim();

    if (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Number.isFinite(z) &&
      element
    ) {
      atoms.push({
        element,
        position: [x, y, z]
      });
    }
  }

  for (let index = 0; index < bondCount; index += 1) {
    const line = lines[4 + atomCount + index];
    if (!line) continue;

    const start = Number.parseInt(line.slice(0, 3).trim(), 10);
    const end = Number.parseInt(line.slice(3, 6).trim(), 10);
    const order = Number.parseInt(line.slice(6, 9).trim(), 10) || 1;

    if (Number.isFinite(start) && Number.isFinite(end)) {
      bonds.push({
        start: Math.max(0, start - 1),
        end: Math.max(0, end - 1),
        order
      });
    }
  }

  if (!atoms.length) {
    return null;
  }

  return { atoms, bonds };
};

type ViewerReferences = {
  THREE: typeof THREE;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls | null;
  arButton: HTMLElement | null;
  moleculeGroup: THREE.Group | null;
  ambientLight: THREE.AmbientLight | null;
  directionalLight: THREE.DirectionalLight | null;
  frameId: number | null;
};

const MoleculeStage: React.FC<{
  molecule: ParsedMolecule | null;
  loading: boolean;
  error: string | null;
  displayMode: DisplayMode;
  arSupported: boolean;
  scaleMultiplier: number;
  onSessionStateChange?: (state: 'idle' | 'ar' | 'error') => void;
  onArButtonReady?: (button: HTMLElement | null) => void;
  onScaleGesture?: (value: number) => void;
}> = ({ molecule, loading, error, displayMode, arSupported, scaleMultiplier, onSessionStateChange, onArButtonReady, onScaleGesture }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayButtonContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ViewerReferences | null>(null);
  const pinchStateRef = useRef<{ initialDistance: number; initialScale: number } | null>(null);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    let disposed = false;

    const setupViewer = async () => {
      const container = containerRef.current;
      if (!container) return;

      // Three.js modules are now statically imported at the top
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.xr.enabled = arSupported;
      // Note: outputEncoding may not be available in this Three.js version
      // renderer.outputEncoding = THREE.sRGBEncoding;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = null;

      const camera = new THREE.PerspectiveCamera(
        65,
        container.clientWidth / container.clientHeight,
        0.01,
        30
      );
      camera.position.set(0, 0, 5);

      let controls: import('three/addons/controls/OrbitControls.js').OrbitControls | null = null;
      if (!arSupported) {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
      }

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
      directionalLight.position.set(3, 5, 6);
      scene.add(directionalLight);

      let arButton: HTMLElement | null = null;

      if (arSupported) {
        const buttonContainer = overlayButtonContainerRef.current ?? overlayRef.current;

        arButton = ARButton.createButton(renderer, {
          requiredFeatures: [],
          optionalFeatures: ['dom-overlay'],
          domOverlay: overlayRef.current ? { root: overlayRef.current } : undefined
        });

        if (arButton) {
          arButton.textContent = 'Enter AR';
          arButton.classList.add(
            'inline-flex',
            'items-center',
            'justify-center',
            'gap-2',
            'rounded-lg',
            'border',
            'border-blue-400/60',
            'bg-blue-600/70',
            'px-3',
            'py-2',
            'text-[11px]',
            'font-semibold',
            'uppercase',
            'tracking-wide',
            'text-blue-50',
            'transition',
            'hover:bg-blue-600/80'
          );
          arButton.style.pointerEvents = 'auto';

          buttonContainer?.appendChild(arButton);
          onArButtonReady?.(arButton);
        }

        renderer.xr.addEventListener('sessionstart', () => {
          if (controls?.enabled) {
            controls.enabled = false;
          }
          onSessionStateChange?.('ar');
        });

        renderer.xr.addEventListener('sessionend', () => {
          if (controls?.enabled) {
            controls.enabled = true;
          }
          onSessionStateChange?.('idle');
        });
      } else {
        onArButtonReady?.(null);
      }

      const handleResize = () => {
        if (!container || !viewerRef.current) return;
        const { camera: activeCamera, renderer: activeRenderer } = viewerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;
        activeCamera.aspect = width / height;
        activeCamera.updateProjectionMatrix();
        activeRenderer.setSize(width, height);
      };

      window.addEventListener('resize', handleResize);

      const run = () => {
        if (controls) {
          controls.update();
        }
        renderer.render(scene, camera);
        const frameId = renderer.setAnimationLoop(run);
        viewerRef.current && (viewerRef.current.frameId = frameId as unknown as number);
      };

      run();

      viewerRef.current = {
        THREE,
        renderer,
        scene,
        camera,
        controls,
        arButton,
        moleculeGroup: null,
        ambientLight,
        directionalLight,
        frameId: null
      };

      setInitialised(true);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    };

    setupViewer();

    return () => {
      disposed = true;
      const viewer = viewerRef.current;
      if (!viewer) return;

      if (viewer.frameId !== null) {
        viewer.renderer.setAnimationLoop(null);
      }

      viewer.controls?.dispose();
      viewer.renderer.dispose();
      viewer.scene.clear();
      viewer.renderer.domElement.remove();
      viewer.arButton?.remove();
      onArButtonReady?.(null);
      viewerRef.current = null;
    };
  }, [arSupported, onArButtonReady, onSessionStateChange]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !initialised) return;

    const { THREE, scene, camera, controls } = viewer;

    if (viewer.moleculeGroup) {
      scene.remove(viewer.moleculeGroup);
      viewer.moleculeGroup.traverse((child: THREE.Object3D) => {
        const meshChild = child as THREE.Mesh;
        if (meshChild.geometry && typeof meshChild.geometry.dispose === 'function') {
          meshChild.geometry.dispose();
        }
        if (meshChild.material) {
          const materials = Array.isArray(meshChild.material)
            ? meshChild.material
            : [meshChild.material];
          materials.forEach((material: any) => {
            if (material && typeof material.dispose === 'function') {
              material.dispose();
            }
          });
        }
      });
      viewer.moleculeGroup = null;
    }

    if (!molecule) {
      onSessionStateChange?.('idle');
      return;
    }

    const group = new THREE.Group();

    const sphereGeometries = new Map<string, import('three').SphereGeometry>();
    const materialCache = new Map<string, import('three').MeshStandardMaterial>();
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: displayMode.id === 'wireframe' ? 0.9 : 0.3
    });

    const radiusForElement = (element: string) =>
      ATOM_RADII[element] ?? fallbackAtomRadius;

    const colorForElement = (element: string) =>
      ATOM_COLORS[element] ?? 0xb0bec5;

    const positions = molecule.atoms.map((atom) => atom.position);
    const centroid = positions.reduce(
      (acc, [x, y, z]) => {
        acc.x += x;
        acc.y += y;
        acc.z += z;
        return acc;
      },
      { x: 0, y: 0, z: 0 }
    );

    centroid.x /= positions.length;
    centroid.y /= positions.length;
    centroid.z /= positions.length;

    const scaledPositions = positions.map(([x, y, z]) => [
      (x - centroid.x) * 0.55,
      (y - centroid.y) * 0.55,
      (z - centroid.z) * 0.55
    ]);

    molecule.atoms.forEach((atom, index) => {
      const key = `${atom.element}-${displayMode.id}`;

      const material =
        materialCache.get(key) ||
        new viewer.THREE.MeshStandardMaterial({
          color: colorForElement(atom.element),
          metalness: 0.1,
          roughness:
            displayMode.id === 'spacefill'
              ? 0.4
              : displayMode.id === 'wireframe'
                ? 0.9
                : 0.6,
          wireframe: displayMode.id === 'wireframe'
        });

      materialCache.set(key, material);

      const baseRadius = radiusForElement(atom.element);
      const radius =
        displayMode.id === 'spacefill'
          ? baseRadius * 1.15
          : displayMode.id === 'wireframe'
            ? baseRadius * 0.9
            : baseRadius;

      const geometry =
        sphereGeometries.get(key) ||
        new viewer.THREE.SphereGeometry(Math.max(0.05, radius), 32, 32);

      sphereGeometries.set(key, geometry);

      const mesh = new viewer.THREE.Mesh(geometry, material);
      const [x, y, z] = scaledPositions[index];
      mesh.position.set(x, y, z);
      group.add(mesh);
    });

    molecule.bonds.forEach((bond) => {
      const start = scaledPositions[bond.start];
      const end = scaledPositions[bond.end];

      if (!start || !end) return;

      const startVector = new viewer.THREE.Vector3(...start);
      const endVector = new viewer.THREE.Vector3(...end);

      if (displayMode.id === 'wireframe') {
        const geometry = new viewer.THREE.BufferGeometry().setFromPoints([
          startVector,
          endVector
        ]);
        const line = new viewer.THREE.Line(geometry, lineMaterial);
        group.add(line);
        return;
      }

      const cylinderGeometry = new viewer.THREE.CylinderGeometry(
        bondRadius * (displayMode.id === 'spacefill' ? 0.9 : 0.7),
        bondRadius * (displayMode.id === 'spacefill' ? 0.9 : 0.7),
        startVector.distanceTo(endVector),
        24
      );

      const cylinderMaterial = new viewer.THREE.MeshStandardMaterial({
        color: 0xe0e0e0,
        metalness: 0.2,
        roughness: 0.5
      });

      const mesh = new viewer.THREE.Mesh(cylinderGeometry, cylinderMaterial);
      mesh.position.copy(startVector).add(endVector).multiplyScalar(0.5);
      mesh.lookAt(endVector);
      mesh.rotateX(Math.PI / 2);
      group.add(mesh);

      if (bond.order > 1) {
        const offset = new viewer.THREE.Vector3()
          .subVectors(endVector, startVector)
          .cross(new viewer.THREE.Vector3(0, 1, 0))
          .normalize()
          .multiplyScalar(0.12);

        for (let i = 1; i < bond.order; i += 1) {
          const sideMesh = mesh.clone();
          const direction = i % 2 === 0 ? 1 : -1;
          sideMesh.position.add(offset.clone().multiplyScalar(direction));
          group.add(sideMesh);
        }
      }
    });

    const boundingBox = new viewer.THREE.Box3().setFromObject(group);
    const size = boundingBox.getSize(new viewer.THREE.Vector3()).length();

    group.position.sub(boundingBox.getCenter(new viewer.THREE.Vector3()));
    const baseScale = 2.6 / Math.max(size, 1);
    group.scale.multiplyScalar(baseScale * scaleMultiplier);
    scene.add(group);
    viewer.moleculeGroup = group;

    if (!viewer.renderer.xr.isPresenting && controls) {
      controls.reset();
      const distance = Math.max(3, size * 0.9);
      camera.position.set(distance, distance * 0.6, distance);
      controls.target.set(0, 0, 0);
      controls.update();
    }

    if (viewer.renderer.xr.isPresenting) {
      const target = new viewer.THREE.Vector3(0, 0, -0.6);
      group.position.copy(target);
    }
  }, [molecule, displayMode, initialised, onSessionStateChange, scaleMultiplier]);

  useEffect(() => {
    if (!onScaleGesture) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const distance = (touch1: Touch, touch2: Touch) => {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        pinchStateRef.current = {
          initialDistance: distance(event.touches[0], event.touches[1]),
          initialScale: scaleMultiplier
        };
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && pinchStateRef.current) {
        event.preventDefault();
        const currentDistance = distance(event.touches[0], event.touches[1]);
        if (pinchStateRef.current.initialDistance > 0 && Number.isFinite(currentDistance)) {
          const ratio = currentDistance / pinchStateRef.current.initialDistance;
          const nextScale = Math.max(0.5, Math.min(2, pinchStateRef.current.initialScale * ratio));
          onScaleGesture(nextScale);
        }
      }
    };

    const handleTouchEnd = () => {
      pinchStateRef.current = null;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      pinchStateRef.current = null;
    };
  }, [onScaleGesture, scaleMultiplier]);

  return (
    <div className="space-y-2">
      <div className="relative h-72 overflow-hidden rounded-2xl border border-blue-500/40 bg-blue-950/40">
        <div ref={containerRef} className="h-full w-full" />
        <div ref={overlayRef} className="pointer-events-none absolute inset-0 flex flex-col justify-end p-3">
          <div ref={overlayButtonContainerRef} className="pointer-events-auto flex justify-end gap-2" />
        </div>
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-blue-950/70 text-xs text-blue-100/80">
            <Loader2 className="h-5 w-5 animate-spin text-blue-200" />
            Loading molecule...
          </div>
        ) : null}
        {!loading && error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-blue-950/70 text-center text-xs text-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
            <p>{error}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

interface ArMoleculePreviewProps {
  focusTopic?: string;
  initialCid?: string;
  mode?: 'standard' | 'mobile';
}

const ArMoleculePreview: React.FC<ArMoleculePreviewProps> = ({ focusTopic, initialCid, mode = 'standard' }) => {
  const suggested = useMemo(() => {
    if (!focusTopic) return null;
    const focus = focusTopic.toLowerCase();
    return (
      AR_MOLECULE_LIBRARY.find((entry) =>
        entry.tags.some((tag) => focus.includes(tag) || tag.includes(focus))
      ) ?? null
    );
  }, [focusTopic]);

  const [selected, setSelected] = useState<ArMolecule>(
    suggested ?? AR_MOLECULE_LIBRARY[0]
  );
  const [displayMode, setDisplayMode] = useState<DisplayMode>(DISPLAY_MODES[0]);
  const [customCid, setCustomCid] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moleculeData, setMoleculeData] = useState<ParsedMolecule | null>(null);
  const [arSupported, setArSupported] = useState<boolean | null>(null);
  const [sessionState, setSessionState] = useState<'idle' | 'ar' | 'error'>('idle');
  const [arButtonElement, setArButtonElement] = useState<HTMLElement | null>(null);
  const [requiresHttps, setRequiresHttps] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [scaleMultiplier, setScaleMultiplier] = useState(1);

  const handleScaleGesture = useCallback((nextScale: number) => {
    setScaleMultiplier((prev) => {
      const clamped = Math.max(0.5, Math.min(2, nextScale));
      return Math.abs(clamped - prev) < 0.0001 ? prev : clamped;
    });
  }, []);

  const handleEnterAr = () => {
    arButtonElement?.click();
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setRequiresHttps(!window.isSecureContext);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const update = () => setIsTouchDevice(mediaQuery.matches);
    update();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (typeof navigator === 'undefined') {
      setArSupported(false);
      return;
    }

    const detect = async () => {
      if (!navigator.xr || !navigator.xr.isSessionSupported) {
        setArSupported(false);
        return;
      }
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        if (!cancelled) {
          setArSupported(supported);
        }
      } catch (error) {
        console.error('AR capability detection failed', error);
        if (!cancelled) {
          setArSupported(false);
        }
      }
    };

    detect();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setShowQr(false);
  }, [selected?.cid]);

  useEffect(() => {
    if (!initialCid) {
      return;
    }

    setSelected((current) => {
      if (current.cid === initialCid) {
        return current;
      }

      const preset = AR_MOLECULE_LIBRARY.find((entry) => entry.cid === initialCid);
      if (preset) {
        return preset;
      }

      return {
        id: `custom-${initialCid}`,
        name: `PubChem CID ${initialCid}`,
        cid: initialCid,
        formula: 'n/a',
        highlight: 'Fetched directly from PubChem.',
        tags: ['custom']
      };
    });
  }, [initialCid]);

  useEffect(() => {
    let active = true;
    const abortable = new AbortController();

    const fetchSdf = async (cid: string) => {
      setIsLoading(true);
      setLoadError(null);
      setMoleculeData(null);

      try {
        const response = await fetch(PUBCHEM_SDF_ENDPOINT(cid), {
          signal: abortable.signal,
          headers: {
            Accept: 'chemical/x-mdl-sdfile, text/plain'
          }
        });

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? '3D structure not available for this molecule.'
              : `PubChem request failed with status ${response.status}.`
          );
        }

        const sdfText = await response.text();
        const parsed = parseSdf(sdfText);

        if (!parsed) {
          throw new Error('Failed to parse 3D structure from PubChem.');
        }

        if (active) {
          setMoleculeData(parsed);
          setIsLoading(false);
        }
      } catch (error) {
        if (abortable.signal.aborted) {
          return;
        }
        console.error('Failed to load PubChem structure', error);
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : 'Unknown error fetching structure.'
          );
          setIsLoading(false);
          setMoleculeData(null);
        }
      }
    };

    fetchSdf(selected.cid);

    return () => {
      active = false;
      abortable.abort();
    };
  }, [selected]);

  useEffect(() => {
    if (suggested && suggested.id !== selected.id) {
      setSelected(suggested);
    }
  }, [suggested, selected.id]);

  const handleCustomLoad = () => {
    const trimmedCid = customCid.trim();
    if (!trimmedCid) {
      setLoadError('Enter a PubChem CID before loading.');
      return;
    }
    setSelected({
      id: `custom-${trimmedCid}`,
      name: customLabel.trim() || `PubChem CID ${trimmedCid}`,
      cid: trimmedCid,
      formula: 'n/a',
      highlight: 'Fetched directly from PubChem.',
      tags: ['custom']
    });
  };

  const arBanner =
    arSupported === false
      ? 'AR requires a WebXR capable device (Chrome on Android or Safari on iOS 13+). You can still explore the molecule in 3D.'
      : sessionState === 'ar'
        ? 'AR session active - walk around the molecule to inspect bond angles.'
        : 'Tap Start AR on supported devices to place the molecule in your space.';

  const startArDisabled =
    arSupported !== true ||
    isLoading ||
    Boolean(loadError) ||
    !arButtonElement ||
    requiresHttps;

  const arStatusMessage = (() => {
    if (arSupported === null) {
      return 'Checking whether this browser supports WebXR...';
    }
    if (requiresHttps) {
      return 'AR needs a secure (https) connection. Open ChemCanvas using https and try again.';
    }
    if (arSupported === false) {
      return 'This device or browser does not expose WebXR immersive-ar. Try Chrome on Android or Safari on iOS 13+.';
    }
    if (isLoading) {
      return 'Loading 3D structure...';
    }
    if (loadError) {
      return 'Fix the molecule load error above, then try again.';
    }
    if (!arButtonElement) {
      return 'Viewer initialising...';
    }
    if (sessionState === 'ar') {
      return 'AR session active - move your device to explore the molecule.';
    }
    return 'Ready to launch AR. Position your device and tap Start AR when you are ready.';
  })();

  const qrValue = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    const cidValue = selected?.cid;
    if (!cidValue) {
      return '';
    }
    return `${window.location.origin}/ar/${encodeURIComponent(cidValue)}`;
  }, [selected?.cid]);

  return (
    <div className="space-y-3 text-[11px] text-blue-100">
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
        <div className="flex items-start gap-2">
          <Smartphone size={16} className="mt-1 text-blue-200" />
          <div>
            <p className="font-semibold uppercase tracking-wide text-blue-200">How it works</p>
            <ol className="ml-3 list-decimal space-y-1 text-blue-100/90">
              <li>Pick a molecule or load a PubChem CID.</li>
              <li>Preview in 3D, then enter AR (supported devices).</li>
              <li>Capture snapshots to feed reflection or monitoring notes.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-500/30 bg-blue-900/20 p-3 text-blue-200/90">
        {arBanner}
      </div>

      {mode !== 'mobile' && (
        <div className="space-y-2">
          <p className="font-semibold uppercase tracking-wide text-blue-200">Quick picks</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {AR_MOLECULE_LIBRARY.map((molecule) => {
              const isActive = molecule.id === selected.id;
              return (
                <button
                  key={molecule.id}
                  type="button"
                  onClick={() => setSelected(molecule)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    isActive
                      ? 'border-blue-400 bg-blue-700/40 text-blue-50 shadow-inner'
                      : 'border-blue-400/30 bg-blue-950/30 text-blue-100 hover:border-blue-400/60 hover:bg-blue-800/30'
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-blue-200">
                    <Package size={14} />
                    {molecule.name}
                  </div>
                  <p className="mt-1 text-[10px] text-blue-200/80">
                    {molecule.formula} &middot; CID {molecule.cid}
                  </p>
                  <p className="mt-1 text-[10px] text-blue-100/75">{molecule.highlight}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === 'standard' && !isTouchDevice && qrValue ? (
        <div className="rounded-xl border border-blue-500/40 bg-blue-950/40 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">Share to mobile</p>
              <p className="mt-1 text-[11px] text-blue-100/80">
                Scan the QR code with your phone to open this molecule in AR instantly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowQr((prev) => !prev)}
              className="rounded-lg border border-blue-400/60 bg-blue-600/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-50 transition hover:bg-blue-600/50"
            >
              {showQr ? 'Hide QR' : 'Show QR'}
            </button>
          </div>
          {showQr ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-900/30 p-3">
              <QRCodeSVG value={qrValue} size={196} includeMargin />
              <p className="text-[11px] text-blue-200/80 break-all">{qrValue}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode !== 'mobile' && (
        <div className="rounded-xl border border-blue-500/40 bg-blue-950/40 p-3 space-y-2">
          <p className="font-semibold uppercase tracking-wide text-blue-200">Load a PubChem CID</p>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input
            value={customCid}
            onChange={(event) => setCustomCid(event.target.value)}
            placeholder="CID (e.g., 962 for water)"
            className="rounded-lg border border-blue-400/40 bg-blue-900/40 px-3 py-2 text-blue-100 focus:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
          />
          <input
            value={customLabel}
            onChange={(event) => setCustomLabel(event.target.value)}
            placeholder="Optional label"
            className="rounded-lg border border-blue-400/40 bg-blue-900/40 px-3 py-2 text-blue-100 focus:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
          />
          <button
            type="button"
            onClick={handleCustomLoad}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-blue-400/60 bg-blue-600/40 px-3 py-2 font-semibold uppercase tracking-wide text-blue-50 transition hover:bg-blue-600/50"
          >
            <Beaker size={14} />
            Load
          </button>
        </div>
          <p className="text-blue-200/75">
            CIDs are visible in the right-hand metadata panel on PubChem compound pages.
          </p>
        </div>
      )}

      {mode !== 'mobile' && (
        <div className="flex flex-wrap items-center gap-2 text-blue-200/80">
        <span className="font-semibold uppercase tracking-wide">Display mode:</span>
        {DISPLAY_MODES.map((mode) => {
          const isActive = mode.id === displayMode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => setDisplayMode(mode)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 transition ${
                isActive
                  ? 'border-blue-300 bg-blue-600/40 text-blue-50'
                  : 'border-blue-400/40 bg-blue-950/40 text-blue-100 hover:border-blue-300/50'
              }`}
            >
              <Sparkles size={12} />
              {mode.label}
            </button>
          );
        })}
        </div>
      )}

      <div className="rounded-xl border border-blue-500/40 bg-blue-950/40 p-3 space-y-2">
        <label className="flex flex-col gap-1 text-xs text-blue-200 uppercase tracking-wide">
          AR scale
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={scaleMultiplier}
            onChange={(event) => setScaleMultiplier(Number(event.target.value))}
            className="mt-1"
          />
        </label>
        <p className="text-[11px] text-blue-200/80">
          Use this to shrink or enlarge the molecule before launching AR, or pinch on touch screens for quick tweaks. Current scale:{' '}
          <span className="font-semibold text-blue-100">x{scaleMultiplier.toFixed(2)}</span>
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/20 p-3 text-amber-100">
          <div className="flex items-center gap-2 font-semibold uppercase tracking-wide">
            <AlertTriangle size={14} />
            Unable to load 3D structure
          </div>
          <p className="mt-1 text-amber-100/80">{loadError}</p>
          <button
            type="button"
            onClick={() => setSelected((current) => ({ ...current }))}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-400/60 bg-amber-500/30 px-3 py-1 text-amber-50 transition hover:bg-amber-500/40"
          >
            Retry
          </button>
        </div>
      ) : null}

      <MoleculeStage
        molecule={moleculeData}
        loading={isLoading}
        error={loadError}
        displayMode={displayMode}
        arSupported={arSupported ?? false}
        scaleMultiplier={scaleMultiplier}
        onSessionStateChange={setSessionState}
        onArButtonReady={setArButtonElement}
        onScaleGesture={handleScaleGesture}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-500/40 bg-blue-900/20 p-3 text-blue-100/80">
        <span>{arStatusMessage}</span>
        <button
          type="button"
          onClick={handleEnterAr}
          disabled={startArDisabled}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition ${
            startArDisabled
              ? 'cursor-not-allowed border-blue-400/30 bg-blue-900/40 text-blue-200/60'
              : 'border-blue-400/60 bg-blue-600/50 text-blue-50 hover:bg-blue-600/60'
          }`}
        >
          <Smartphone size={14} />
          Start AR
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-blue-200/70">
        <span>
          Powered by PubChem PUG REST &middot; 3D conformers rendered in real time.
        </span>
        <a
          href={PUBCHEM_SDF_ENDPOINT(selected.cid)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-100"
        >
          <ExternalLink size={12} />
          Download SDF
        </a>
      </div>
    </div>
  );
};

export default ArMoleculePreview;