"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Renders the DNA double-helix model the person supplied
 * (public/models/dna-helix.glb -- a procedurally generated, explicitly
 * decorative asset, not a real gene or sequence) for the Genetics page hero,
 * replacing the earlier flat SVG DnaHelix illustration.
 *
 * Unlike components/VitalsHoloModel.tsx, this file's node graph already
 * references all 135 of its meshes correctly (confirmed by inspecting the
 * glTF JSON directly -- no orphaned-mesh bug here), so gltf.scene can be
 * used as-is. Each mesh carries its own baked COLOR_0 vertex colors (blue
 * one strand, cyan the other) and no material, so GLTFLoader's default
 * material already reads those colors; this file swaps that default for an
 * unlit MeshBasicMaterial per mesh so the strands read as a glowing
 * hologram rather than a flat-lit PBR surface, consistent with the rest of
 * this app's "hologram" visual language (see VitalsHoloModel.tsx).
 *
 * Self-contained like RealisticCelestialBody.tsx / VitalsHoloModel.tsx:
 * builds its own scene/renderer/controls, disposes everything on unmount,
 * and skips auto-rotation (still rendering, still interactive) under
 * prefers-reduced-motion.
 */
export default function GeneticsDnaModel({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;

    const width = container.clientWidth || 220;
    const height = 420;

    const scene = new THREE.Scene();
    const fovDeg = 30;
    const camera = new THREE.PerspectiveCamera(fovDeg, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 2.4;
    controls.target.set(0, 0, 0);

    // Unlit materials don't need scene lights, but a faint ambient keeps
    // things sane if a mesh ever falls back to the loader's own default.
    scene.add(new THREE.AmbientLight(0x6fa8dc, 0.6));

    const group = new THREE.Group();
    scene.add(group);

    const loader = new GLTFLoader();
    loader.load(
      "/models/dna-helix.glb",
      (gltf) => {
        if (disposed) return;

        const model = gltf.scene;

        // Source data is Z-up with the helix's long axis along Z (trimesh
        // export, same convention as public/models/astronaut-hologram.glb
        // -- confirmed via each mesh accessor's min/max bounds). Rotate
        // -90 deg about X into three.js's Y-up convention so the helix
        // stands vertically instead of lying flat toward the camera.
        model.rotation.x = -Math.PI / 2;

        model.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          const prevMats = Array.isArray(obj.material) ? obj.material : [obj.material];
          const hasVertexColors = !!obj.geometry.getAttribute("color");
          obj.material = prevMats.map(
            () =>
              new THREE.MeshBasicMaterial({
                vertexColors: hasVertexColors,
                color: hasVertexColors ? 0xffffff : 0x6fd8ff,
                transparent: true,
                opacity: 0.92,
                side: THREE.DoubleSide,
              })
          )[0];
          prevMats.forEach((m) => m.dispose());
        });

        group.add(model);

        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const sizeVec = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
        const scale = 4.2 / maxDim;
        group.scale.setScalar(scale);
        group.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        group.updateMatrixWorld(true);

        // Frame the camera from the model's actual (post-scale) bounding
        // sphere instead of a guessed fixed distance.
        const framedBox = new THREE.Box3().setFromObject(group);
        const boundingSphere = framedBox.getBoundingSphere(new THREE.Sphere());
        const fitDistance = (boundingSphere.radius / Math.sin((fovDeg * Math.PI) / 360)) * 1.15;
        camera.position.set(0, 0, fitDistance);
        controls.minDistance = fitDistance;
        controls.maxDistance = fitDistance;
        controls.update();
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.error("Failed to load DNA helix model", err);
      }
    );

    let frameId = 0;
    function render() {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className={`relative mx-auto ${className}`} style={{ width: "100%", maxWidth: 220, height: 420 }}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
