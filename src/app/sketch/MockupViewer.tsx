"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Garment } from "@/lib/enums";

// Three.js mockup viewer.
//
// Renders a low-poly proxy of the chosen garment with the user's sketch
// mapped onto it as a texture. Drag to rotate, scroll to zoom. We use
// pointer events + manual yaw/pitch rather than pulling in OrbitControls so
// we stay on the core three module and keep the bundle slim.
//
// `dataUrl` is the latest canvas snapshot; updating it swaps the texture
// without rebuilding the scene.

export function MockupViewer({
  dataUrl,
  garment,
}: {
  dataUrl: string;
  garment: Garment;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // We keep mutable references to the scene's pieces so subsequent renders
  // can swap the texture / rebuild the mesh without tearing the canvas down.
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    pivot: THREE.Group;
    material: THREE.MeshStandardMaterial;
    raf: number;
    dispose: () => void;
  } | null>(null);

  // ---- One-time setup: renderer, lights, camera, controls. ----
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = host.clientWidth;
    const height = host.clientHeight || 520;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x0f0d1a, 1);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 5.5);
    camera.lookAt(0, 1.4, 0);

    // Three-point-ish lighting for a soft fashion-mannequin look.
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff7e6, 0.9);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ec5ff, 0.35);
    rim.position.set(-3, 2, -2);
    scene.add(rim);

    // Subtle ground reflection so the mannequin doesn't float.
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 64),
      new THREE.MeshStandardMaterial({ color: 0x171428, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    scene.add(floor);

    const pivot = new THREE.Group();
    scene.add(pivot);

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    // Pointer-drag rotation. Two axes (yaw + a clamped pitch) so the user
    // can tilt up/down without flipping the model.
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let yaw = 0;
    let pitch = 0;
    const dom = renderer.domElement;
    dom.style.touchAction = "none";

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      dom.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw += dx * 0.01;
      pitch = Math.max(-0.6, Math.min(0.6, pitch + dy * 0.01));
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try { dom.releasePointerCapture(e.pointerId); } catch {}
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.max(3, Math.min(9, camera.position.z + e.deltaY * 0.005));
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointercancel", onUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

    // Auto-rotate gently when the user isn't interacting; pause while dragging.
    let lastT = performance.now();
    const tick = (t: number) => {
      const dt = (t - lastT) / 1000;
      lastT = t;
      if (!dragging) yaw += dt * 0.25;
      pivot.rotation.y = yaw;
      pivot.rotation.x = pitch;
      renderer.render(scene, camera);
      sceneRef.current!.raf = requestAnimationFrame(tick);
    };

    // Handle container resizing (sidebar drawer, window resize, etc.).
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight || 520;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const obs = new ResizeObserver(resize);
    obs.observe(host);

    sceneRef.current = {
      renderer,
      scene,
      camera,
      pivot,
      material,
      raf: 0,
      dispose: () => {
        cancelAnimationFrame(sceneRef.current!.raf);
        obs.disconnect();
        dom.removeEventListener("pointerdown", onDown);
        dom.removeEventListener("pointermove", onMove);
        dom.removeEventListener("pointerup", onUp);
        dom.removeEventListener("pointercancel", onUp);
        dom.removeEventListener("wheel", onWheel);
        renderer.dispose();
        material.dispose();
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const m = obj.material as THREE.Material | THREE.Material[];
            (Array.isArray(m) ? m : [m]).forEach((mat) => mat.dispose());
          }
        });
        host.removeChild(renderer.domElement);
      },
    };
    sceneRef.current.raf = requestAnimationFrame(tick);

    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // ---- Rebuild the garment mesh whenever `garment` changes. ----
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    // Strip any previous garment children (everything except the pivot's own
    // bookkeeping — pivot starts empty).
    while (s.pivot.children.length) s.pivot.remove(s.pivot.children[0]);
    for (const mesh of buildGarmentMeshes(garment, s.material)) {
      s.pivot.add(mesh);
    }
  }, [garment]);

  // ---- Swap the texture whenever the sketch updates. ----
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !dataUrl) return;
    const loader = new THREE.TextureLoader();
    loader.load(dataUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      const prev = s.material.map;
      s.material.map = tex;
      s.material.needsUpdate = true;
      prev?.dispose();
    });
  }, [dataUrl]);

  return (
    <div className="relative">
      <div
        ref={hostRef}
        className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-ink-950"
      />
      <p className="mt-2 text-[11px] text-ink-500">
        Drag to rotate · Scroll to zoom · Auto-spins when idle. Geometry is a
        low-poly proxy so you can preview how the sketch sits on the garment
        type.
      </p>
    </div>
  );
}

// Build a low-poly proxy mannequin for the chosen garment. Each piece uses
// the same shared `material` so a single texture swap updates everything.
function buildGarmentMeshes(garment: Garment, material: THREE.MeshStandardMaterial): THREE.Mesh[] {
  switch (garment) {
    case "shirt":
    case "hoodie":
      return [
        // Torso
        cylinder({ rTop: 0.6, rBot: 0.65, h: 1.1, y: 1.5, material }),
        // Left sleeve
        cylinder({ rTop: 0.18, rBot: 0.16, h: 0.7, y: 1.6, x: -0.7, z: 0, rotZ: 1.2, material }),
        // Right sleeve
        cylinder({ rTop: 0.18, rBot: 0.16, h: 0.7, y: 1.6, x: 0.7, rotZ: -1.2, material }),
        // Head proxy
        sphere({ r: 0.22, y: 2.3, material: neutralHead() }),
      ];
    case "trousers":
      return [
        cylinder({ rTop: 0.22, rBot: 0.2, h: 1.4, y: 0.75, x: -0.22, material }),
        cylinder({ rTop: 0.22, rBot: 0.2, h: 1.4, y: 0.75, x: 0.22, material }),
        // Waistband
        cylinder({ rTop: 0.55, rBot: 0.5, h: 0.15, y: 1.5, material }),
      ];
    case "skirt":
      return [
        // Waist
        cylinder({ rTop: 0.5, rBot: 0.55, h: 0.15, y: 1.5, material }),
        // Flared skirt
        cylinder({ rTop: 0.55, rBot: 1.05, h: 1.0, y: 0.95, material }),
      ];
    case "dress":
    case "gown":
    case "native":
      return [
        // Full-length tapered tube
        cylinder({ rTop: 0.55, rBot: 0.95, h: 2.1, y: 1.0, material }),
        sphere({ r: 0.22, y: 2.3, material: neutralHead() }),
      ];
    case "agbada":
      return [
        // Wide flowing drape
        cylinder({ rTop: 0.7, rBot: 1.2, h: 2.0, y: 1.05, material }),
        // Wide sleeves
        cylinder({ rTop: 0.45, rBot: 0.55, h: 1.0, y: 1.7, x: -0.95, rotZ: 1.4, material }),
        cylinder({ rTop: 0.45, rBot: 0.55, h: 1.0, y: 1.7, x: 0.95, rotZ: -1.4, material }),
        sphere({ r: 0.22, y: 2.3, material: neutralHead() }),
      ];
    default:
      // Generic capsule-ish proxy
      return [
        cylinder({ rTop: 0.55, rBot: 0.6, h: 1.6, y: 1.2, material }),
        sphere({ r: 0.22, y: 2.2, material: neutralHead() }),
      ];
  }
}

function cylinder({
  rTop,
  rBot,
  h,
  y,
  x = 0,
  z = 0,
  rotZ = 0,
  material,
}: {
  rTop: number;
  rBot: number;
  h: number;
  y: number;
  x?: number;
  z?: number;
  rotZ?: number;
  material: THREE.MeshStandardMaterial;
}): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 32, 1, false);
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.z = rotZ;
  return m;
}

function sphere({
  r,
  y,
  material,
}: {
  r: number;
  y: number;
  material: THREE.Material;
}): THREE.Mesh {
  const geo = new THREE.SphereGeometry(r, 32, 32);
  const m = new THREE.Mesh(geo, material);
  m.position.set(0, y, 0);
  return m;
}

// Head/body parts shouldn't pick up the sketch texture — they use a neutral
// matte material so the eye reads the garment as the focal point.
function neutralHead(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xeadfd4, roughness: 0.95 });
}
