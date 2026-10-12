"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * A real, lit, slowly-rotating 3D sphere (WebGL via three.js) textured with
 * an actual planetary surface map -- replaces the earlier flat CSS gradient
 * circles. See public/textures/CREDITS.md for exactly what each texture is
 * (the Moon map is real lunar imagery; the Mars map is an honestly-labelled
 * procedural stand-in, not a photograph).
 *
 * Self-contained and defensive: builds its own scene/renderer, disposes
 * everything on unmount, caps the pixel ratio for performance, and skips the
 * rotation animation (still rendering one static frame) under
 * prefers-reduced-motion.
 */
export default function RealisticCelestialBody({
  textureSrc,
  size,
  glowColor,
  rotationSpeed = 0.055,
  tiltDeg = 12,
}: {
  textureSrc: string;
  size: number;
  glowColor: string;
  rotationSpeed?: number;
  tiltDeg?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 10);
    // Pulled back enough that the sphere (radius 1) sits comfortably inside
    // the frame with transparent margin around it -- too close and the
    // sphere overfills the square canvas edge-to-edge, which (with no
    // visible transparent background left) reads as a filled square/rounded
    // square instead of a circle.
    camera.position.z = 4.1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(1, 48, 48);
    const loader = new THREE.TextureLoader();
    const texture = loader.load(textureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0.0 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.rotation.z = (tiltDeg * Math.PI) / 180;
    scene.add(sphere);

    // One hard key light (sunlight) from the upper-left, plus a faint
    // overall ambient so the dark side isn't pure black, matching the
    // "mission console" look of the rest of the hero imagery.
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-2.2, 1.4, 2.2);
    scene.add(key);
    const ambient = new THREE.AmbientLight(0xffffff, 0.22);
    scene.add(ambient);
    const rim = new THREE.DirectionalLight(glowColor, 0.5);
    rim.position.set(2, -0.5, -1.5);
    scene.add(rim);

    let frameId = 0;
    let disposed = false;

    function render() {
      if (disposed) return;
      if (!reduceMotion) {
        sphere.rotation.y += rotationSpeed * 0.016;
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textureSrc, size, rotationSpeed, tiltDeg]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        overflow: "hidden",
        filter: `drop-shadow(0 0 ${Math.round(size * 0.3)}px ${glowColor})`,
      }}
    />
  );
}
