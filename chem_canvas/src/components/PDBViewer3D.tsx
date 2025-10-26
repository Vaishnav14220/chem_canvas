import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Loader2, AlertCircle } from 'lucide-react';

interface PDBViewer3DProps {
  pdbUrl: string;
}

interface Atom {
  x: number;
  y: number;
  z: number;
  element: string;
}

const getAtomColor = (element: string): number => {
  const colors: Record<string, number> = {
    C: 0x909090,
    N: 0x3050f8,
    O: 0xff0d0d,
    H: 0xffffff,
    S: 0xffff30,
    P: 0xff7f00,
    F: 0x31ffb8,
    Cl: 0x31ffb8,
    Br: 0xa62929,
    I: 0x940094,
  };
  return colors[element] || 0x888888;
};

const parsePDB = (data: string): Atom[] => {
  const atoms: Atom[] = [];
  const lines = data.split('\n');

  for (const line of lines) {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue;

    try {
      const x = parseFloat(line.substring(30, 38));
      const y = parseFloat(line.substring(38, 46));
      const z = parseFloat(line.substring(46, 54));

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

      let element = line.length > 76 ? line.substring(76, 78).trim() : '';
      if (!element) {
        const atomName = line.substring(12, 16).trim();
        element = atomName.charAt(0);
      }

      atoms.push({
        x,
        y,
        z,
        element: element.toUpperCase(),
      });
    } catch {
      continue;
    }
  }

  return atoms;
};

const PDBViewer3D = ({ pdbUrl }: PDBViewer3DProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMCP] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    console.log('[PDBViewer3D] Component mounted with pdbUrl:', pdbUrl);
    console.log('[PDBViewer3D] THREE library available:', !!THREE);
    setDebugInfo('Initializing...');
    
    const init = async () => {
      setLoading(true);
      setError(null);

      try {
        setDebugInfo('Starting PDB download...');
        console.log('[PDBViewer3D] Starting simple PDB download...');
        
        // Simple direct download with fallback
        let pdbData: string;
        try {
          setDebugInfo('Trying direct fetch...');
          console.log('[PDBViewer3D] Trying direct fetch...');
          const response = await fetch(pdbUrl);
          if (response.ok) {
            pdbData = await response.text();
            setDebugInfo(`Direct fetch OK (${pdbData.length} chars)`);
            console.log('[PDBViewer3D] Direct fetch succeeded, length:', pdbData.length);
          } else {
            throw new Error(`Direct fetch failed: ${response.status}`);
          }
        } catch (err) {
          setDebugInfo('Trying CORS proxy...');
          console.log('[PDBViewer3D] Direct fetch failed, trying CORS proxy...');
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(pdbUrl)}`;
          const response = await fetch(proxyUrl);
          if (!response.ok) {
            throw new Error(`CORS proxy failed: ${response.status}`);
          }
          pdbData = await response.text();
          setDebugInfo(`CORS fetch OK (${pdbData.length} chars)`);
          console.log('[PDBViewer3D] CORS fetch succeeded, length:', pdbData.length);
        }

        setDebugInfo('Parsing atoms...');
        console.log('[PDBViewer3D] PDB downloaded, parsing atoms...');
        const atoms = parsePDB(pdbData);
        setDebugInfo(`Parsed ${atoms.length} atoms`);
        console.log('[PDBViewer3D] Parsed atoms:', atoms.length);
        
        if (atoms.length === 0) {
          throw new Error('No atoms found in PDB data');
        }

        if (!containerRef.current) {
          console.log('[PDBViewer3D] No container ref available');
          return;
        }

        setDebugInfo('Creating 3D scene...');
        console.log('[PDBViewer3D] Creating Three.js scene...');
        
        // Three.js setup
        const width = containerRef.current.clientWidth || 800;
        const height = containerRef.current.clientHeight || 600;
        console.log('[PDBViewer3D] Container size:', width, 'x', height);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f172a);

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        console.log('[PDBViewer3D] Renderer created, calculating bounds...');

        // Calculate molecular bounds
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (const atom of atoms) {
          minX = Math.min(minX, atom.x);
          maxX = Math.max(maxX, atom.x);
          minY = Math.min(minY, atom.y);
          maxY = Math.max(maxY, atom.y);
          minZ = Math.min(minZ, atom.z);
          maxZ = Math.max(maxZ, atom.z);
        }

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 50;

        console.log('[PDBViewer3D] Bounds calculated, maxDim:', maxDim, 'center:', [centerX, centerY, centerZ]);

        // Create atom spheres
        const sphereGeom = new THREE.SphereGeometry(0.35, 16, 16);

        for (const atom of atoms) {
          const color = new THREE.Color(getAtomColor(atom.element));
          const material = new THREE.MeshPhongMaterial({ color });
          const mesh = new THREE.Mesh(sphereGeom, material);
          mesh.position.set(atom.x - centerX, atom.y - centerY, atom.z - centerZ);
          scene.add(mesh);
        }

        setDebugInfo('Rendering atoms...');
        console.log('[PDBViewer3D] Created', atoms.length, 'atom meshes, scene children:', scene.children.length);

        // Lighting setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        console.log('[PDBViewer3D] Lighting added');

        // Camera positioning
        const distance = maxDim / (2 * Math.tan((camera.fov / 2) * (Math.PI / 180)));
        camera.position.set(distance * 0.6, distance * 0.5, distance);
        camera.lookAt(0, 0, 0);

        console.log('[PDBViewer3D] Camera positioned at distance:', distance);

        // Mouse controls
        let isDragging = false;
        let prevX = 0, prevY = 0;

        const handleMouseDown = (e: MouseEvent) => {
          isDragging = true;
          prevX = e.clientX;
          prevY = e.clientY;
        };

        const handleMouseMove = (e: MouseEvent) => {
          if (!isDragging) return;
          const deltaX = e.clientX - prevX;
          const deltaY = e.clientY - prevY;
          rotationRef.current.y += deltaX * 0.01;
          rotationRef.current.x += deltaY * 0.01;
          prevX = e.clientX;
          prevY = e.clientY;
        };

        const handleMouseUp = () => {
          isDragging = false;
        };

        const handleWheel = (e: WheelEvent) => {
          e.preventDefault();
          const scale = 1 + e.deltaY * 0.001;
          camera.position.multiplyScalar(scale);
        };

        renderer.domElement.addEventListener('mousedown', handleMouseDown);
        renderer.domElement.addEventListener('mousemove', handleMouseMove);
        renderer.domElement.addEventListener('mouseup', handleMouseUp);
        renderer.domElement.addEventListener('wheel', handleWheel);

        console.log('[PDBViewer3D] Mouse controls added');

        // Animation loop
        const animate = () => {
          frameIdRef.current = requestAnimationFrame(animate);

          scene.rotation.x += (rotationRef.current.x - scene.rotation.x) * 0.1;
          scene.rotation.y += (rotationRef.current.y - scene.rotation.y) * 0.1;

          renderer.render(scene, camera);
        };

        animate();
        setLoading(false);
        setDebugInfo('3D viewer ready!');
        console.log('[PDBViewer3D] 3D viewer loaded successfully!');

        // Cleanup function
        return () => {
          if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
          renderer.domElement.removeEventListener('mousedown', handleMouseDown);
          renderer.domElement.removeEventListener('mousemove', handleMouseMove);
          renderer.domElement.removeEventListener('mouseup', handleMouseUp);
          renderer.domElement.removeEventListener('wheel', handleWheel);
          if (containerRef.current?.contains(renderer.domElement)) {
            containerRef.current.removeChild(renderer.domElement);
          }
          renderer.dispose();
          sphereGeom.dispose();
        };

      } catch (err) {
        console.error('[PDBViewer3D] Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load molecular structure';
        setError(errorMessage);
        setDebugInfo(`Error: ${errorMessage}`);
        setLoading(false);
      }
    };

    init();
  }, [pdbUrl]);

  return (
    <div className="w-full">
      {loading && (
        <div className="flex h-96 items-center justify-center bg-slate-950 rounded-md">
          <div className="flex flex-col items-center gap-2 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading 3D molecular structure...
              {usingMCP && <span className="text-cyan-400 text-xs">(via MCP)</span>}
            </div>
            {debugInfo && (
              <div className="text-xs text-slate-400">
                Debug: {debugInfo}
              </div>
            )}
          </div>
        </div>
      )}
      {error && (
        <div className="flex h-96 items-center justify-center border border-red-500/40 bg-red-500/10 rounded-md">
          <div className="flex max-w-xs items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400 mt-0.5" />
            <div className="text-xs text-red-100">
              <p className="font-semibold text-red-200">{error}</p>
              <p className="mt-1 break-words text-red-300">{pdbUrl}</p>
            </div>
          </div>
        </div>
      )}
      {!loading && !error && (
        <div className="relative">
          <div 
            ref={containerRef} 
            className="w-full h-96 rounded-md border border-slate-800 bg-slate-950"
            style={{ cursor: 'grab' }}
          />
          <div className="absolute top-2 right-2 flex gap-1">
            {usingMCP && (
              <div className="px-2 py-1 bg-cyan-900/50 text-cyan-300 text-xs rounded border border-cyan-700">
                MCP Enhanced
              </div>
            )}
            <div className="px-2 py-1 bg-slate-800/50 text-slate-300 text-xs rounded border border-slate-700">
              THREE.js 3D
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400 text-center">
            Drag to rotate • Scroll to zoom • Interactive molecular structure
          </div>
        </div>
      )}
    </div>
  );
};

export default PDBViewer3D;