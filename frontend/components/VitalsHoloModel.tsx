"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MetricStatus, VitalsCategory } from "@/types/api";

/**
 * Renders the holographic astronaut anatomy model the person supplied
 * (public/models/astronaut-hologram.glb -- a procedurally generated,
 * explicitly-labelled "hologram" asset, not real medical imaging) and pins
 * six HUD-style annotation callouts to the model's own named anatomical
 * meshes (heart, lung, abdomen, pelvis, thigh, head), each colored by that
 * category's worst metric status. Each anchor's world-space centroid is
 * computed once after the model is loaded and scaled, then re-projected to
 * screen space every frame, so the callouts track correctly as the camera
 * auto-rotates or the person drags to look around the (stationary) model.
 *
 * Self-contained like RealisticCelestialBody.tsx: builds its own
 * scene/renderer/controls, disposes everything on unmount, and skips
 * auto-rotation (still rendering, still interactive) under
 * prefers-reduced-motion.
 */
const TONE: Record<MetricStatus | "idle", string> = {
  normal: "#6fe3a3",
  attention: "#f5c26b",
  alert: "#ff8a8a",
  idle: "#5fb4ff",
};

const STATUS_LABEL: Record<MetricStatus | "idle", string> = {
  normal: "NORMAL",
  attention: "ATTENTION",
  alert: "ALERT",
  idle: "NO DATA",
};

/** Node names as exported in the glTF (see public/models -- generated via trimesh). */
const ANCHORS: { category: VitalsCategory; nodeName: string; label: string }[] = [
  { category: "sleep_fatigue", nodeName: "head", label: "SLEEP/FATIGUE" },
  { category: "cardiac", nodeName: "heart", label: "CARDIAC" },
  { category: "respiratory", nodeName: "lung", label: "RESP." },
  { category: "temperature", nodeName: "abdomen", label: "TEMP" },
  { category: "hydration_other", nodeName: "pelvis", label: "HYDRATION" },
  { category: "activity_muscle", nodeName: "thigh", label: "ACTIVITY/MUSCLE" },
];

interface Callout {
  category: VitalsCategory;
  el: HTMLDivElement;
  dot: HTMLDivElement;
  /** World-space centroid of the anchor mesh, computed once after layout --
   * see the note below on why this isn't the mesh's own transform. */
  worldPos: THREE.Vector3;
  tone: string;
}

export default function VitalsHoloModel({
  statusByCategory,
}: {
  statusByCategory: Partial<Record<VitalsCategory, MetricStatus>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(statusByCategory);
  statusRef.current = statusByCategory;
  const calloutsRef = useRef<Callout[]>([]);

  // The WebGL scene is built once (see the effect below, empty dep array,
  // to avoid reloading the model and recreating the GL context on every
  // evaluation). Status changes instead update the already-built callout
  // DOM elements in place here.
  useEffect(() => {
    for (const c of calloutsRef.current) {
      const status = statusByCategory[c.category] ?? "idle";
      const tone = TONE[status];
      c.tone = tone;
      c.dot.style.background = tone;
      c.dot.style.boxShadow = `0 0 8px 2px ${tone}`;
      const labelSpan = c.el.querySelector("span:last-child") as HTMLSpanElement | null;
      if (labelSpan) {
        labelSpan.style.color = tone;
        labelSpan.textContent = `[${STATUS_LABEL[status]}]`;
      }
    }
  }, [statusByCategory]);

  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;

    const width = container.clientWidth || 360;
    const height = 380;

    const scene = new THREE.Scene();
    const fovDeg = 32;
    const camera = new THREE.PerspectiveCamera(fovDeg, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 1.1;
    controls.target.set(0, 0, 0);

    const key = new THREE.DirectionalLight(0x9fd8ff, 2.2);
    key.position.set(-2, 2, 3);
    scene.add(key);
    const ambient = new THREE.AmbientLight(0x5f8fc9, 1.3);
    scene.add(ambient);
    const rim = new THREE.PointLight(0x7cc8ff, 1.4, 12);
    rim.position.set(1.5, 1, -2);
    scene.add(rim);
    // Light that follows the camera, so the translucent hologram material
    // (alphaMode BLEND, 37% base opacity) reads clearly as a body silhouette
    // from whatever angle auto-rotate or a drag has turned it to, instead of
    // only being lit well from the one fixed angle above.
    const headlamp = new THREE.PointLight(0xbfe6ff, 1.6, 14);
    camera.add(headlamp);
    scene.add(camera);

    const callouts: Callout[] = [];
    calloutsRef.current = callouts;
    const group = new THREE.Group();
    scene.add(group);

    const loader = new GLTFLoader();
    loader.load(
      "/models/astronaut-hologram.glb",
      async (gltf) => {
        if (disposed) return;

        // The glTF's own node graph only wires up 30 of the file's 213
        // meshes (one representative part per name -- e.g. one "shoulder",
        // one "finger" -- leaving the second arm/leg, most fingers, the
        // rest of the rib/vertebra chain, and most of the decorative scan
        // traces completely unreferenced and so invisible through
        // gltf.scene). Every mesh's vertex data is already baked into one
        // shared coordinate space (confirmed via each accessor's min/max),
        // so every node's local transform is identity -- meaning we can
        // recover the complete body by pulling every mesh directly from
        // the parser instead of walking the incomplete node tree.
        const model = new THREE.Group();
        model.name = "astronaut-full-body";
        const allMeshes = (await gltf.parser.getDependencies("mesh")) as THREE.Object3D[];
        for (const mesh of allMeshes) {
          model.add(mesh);
        }

        // Source data is Z-up (trimesh export, head at max Z, feet at min
        // Z); rotate -90 deg about X into three.js's Y-up convention so the
        // figure stands upright. (+90 deg was tried and renders it
        // upside-down, confirming the direction.)
        model.rotation.x = -Math.PI / 2;
        model.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const mat of mats) {
            if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
            mat.side = THREE.DoubleSide;
            if (mat.name === "Translucent cyan hologram") {
              // Source opacity (0.37) reads as nearly invisible against a
              // near-black console background; boost it so the body
              // silhouette itself is legible, not just its bright seams.
              mat.opacity = Math.min(0.72, mat.opacity * 1.9);
            }
            if (mat.emissive && !mat.emissive.equals(new THREE.Color(0, 0, 0))) {
              mat.emissiveIntensity = 1.6;
            }
          }
        });
        group.add(model);

        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const sizeVec = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
        const scale = 3.2 / maxDim;
        group.scale.setScalar(scale);
        group.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        group.updateMatrixWorld(true);

        // Frame the camera from the model's actual (post-scale) bounding
        // sphere instead of a guessed fixed distance, so it fills the
        // canvas consistently regardless of this asset's proportions.
        const framedBox = new THREE.Box3().setFromObject(group);
        const boundingSphere = framedBox.getBoundingSphere(new THREE.Sphere());
        const fitDistance = (boundingSphere.radius / Math.sin((fovDeg * Math.PI) / 360)) * 1.25;
        camera.position.set(0, boundingSphere.center.y * 0.15, fitDistance);
        controls.minDistance = fitDistance * 0.6;
        controls.maxDistance = fitDistance * 1.6;
        controls.update();

        for (const anchor of ANCHORS) {
          const object = model.getObjectByName(anchor.nodeName);
          if (!object) continue;
          // The mesh's own transform is identity (its shape is baked
          // straight into vertex positions, not into object.position --
          // confirmed by every node sharing an identity transform in the
          // source file), so getWorldPosition() on the object itself would
          // return the same point for every anchor. The actual anatomical
          // location is the geometric centroid of its vertices instead.
          const worldPos = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
          const tone = (() => {
            const status = statusRef.current[anchor.category];
            return status ? TONE[status] : TONE.idle;
          })();

          const el = document.createElement("div");
          el.style.position = "absolute";
          el.style.transform = "translate(-50%, -50%)";
          el.style.pointerEvents = "none";
          el.style.whiteSpace = "nowrap";
          el.style.fontFamily = "var(--font-mono)";
          el.style.fontSize = "9px";
          el.style.letterSpacing = "0.05em";
          el.style.padding = "2px 6px";
          el.style.borderRadius = "3px";
          el.style.background = "rgba(5,8,16,0.82)";
          el.innerHTML = `<span style="color:#d7e6ff;font-weight:700">${anchor.label}</span> <span style="color:${tone}">[${STATUS_LABEL[statusRef.current[anchor.category] ?? "idle"]}]</span>`;
          overlay.appendChild(el);

          const dot = document.createElement("div");
          dot.style.position = "absolute";
          dot.style.width = "6px";
          dot.style.height = "6px";
          dot.style.borderRadius = "50%";
          dot.style.transform = "translate(-50%, -50%)";
          dot.style.pointerEvents = "none";
          dot.style.boxShadow = `0 0 8px 2px ${tone}`;
          dot.style.background = tone;
          overlay.appendChild(dot);

          callouts.push({ category: anchor.category, el, dot, worldPos, tone });
        }
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.error("Failed to load astronaut hologram model", err);
      }
    );

    const projected = new THREE.Vector3();

    function updateCallouts() {
      for (const c of callouts) {
        projected.copy(c.worldPos);
        projected.project(camera);
        const x = (projected.x * 0.5 + 0.5) * width;
        const y = (-projected.y * 0.5 + 0.5) * height;
        const behind = projected.z > 1;
        c.el.style.left = `${x}px`;
        c.el.style.top = `${y - 16}px`;
        c.el.style.opacity = behind ? "0.25" : "1";
        c.dot.style.left = `${x}px`;
        c.dot.style.top = `${y}px`;
        c.dot.style.opacity = behind ? "0.2" : "1";
      }
    }

    let frameId = 0;
    function render() {
      if (disposed) return;
      controls.update();
      updateCallouts();
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
      overlay.replaceChildren();
    };
    // Re-running this effect would reload the whole model and recreate the
    // WebGL context, so status changes update callout colors imperatively
    // below instead of through this dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="vitals-card relative overflow-hidden rounded-xl p-2">
      <div ref={containerRef} className="relative mx-auto" style={{ width: "100%", maxWidth: 360, height: 380 }}>
        <div ref={overlayRef} className="pointer-events-none absolute inset-0" />
      </div>
      <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-[var(--faint)]">
        Illustrative hologram — drag to rotate, not real imaging data
      </p>
    </div>
  );
}
