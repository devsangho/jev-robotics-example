import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Task, World } from "./simulation";
import { createPhysics, type RobotPhysics } from "./physics";

export default function Scene({
  world,
  task,
  cameraView,
  resetCamera,
  onFrame,
  onMotionComplete,
  onSettled,
}: {
  world: World;
  task: Task;
  cameraView: string;
  resetCamera: number;
  onFrame?: (url: string) => void;
  onMotionComplete: (position: [number, number, number]) => void;
  onSettled: (success: boolean, position: [number, number, number]) => void;
}) {
  const mount = useRef<HTMLDivElement>(null),
    latest = useRef({ world, task }),
    frame = useRef(onFrame);
  const callbacks = useRef({ onMotionComplete, onSettled });
  callbacks.current = { onMotionComplete, onSettled };
  const view = useRef(cameraView);
  const reset = useRef(resetCamera);
  const [error, setError] = useState("");
  useEffect(() => {
    latest.current = { world, task };
    frame.current = onFrame;
  }, [world, task, onFrame]);
  useEffect(() => {
    view.current = cameraView;
    reset.current = resetCamera;
  }, [cameraView, resetCamera]);
  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setError(
        "3D rendering needs WebGL. Enable hardware acceleration and reload.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor("#ebeeec");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#ebeeec", 9, 18);
    const camera = new THREE.PerspectiveCamera(37, 1, 0.05, 50);
    camera.position.set(3.5, 3.05, 4.4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.95, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 2;
    controls.maxDistance = 9;
    controls.enablePan = true;
    scene.add(new THREE.HemisphereLight("#ffffff", "#a9aea5", 3));
    const sun = new THREE.DirectionalLight("#fff8ec", 4);
    sun.position.set(-3, 6, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -4;
    sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 4;
    sun.shadow.camera.bottom = -4;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const mat = (color: string, roughness = 0.65, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const white = mat("#eef0e9", 0.32, 0.1),
      black = mat("#303631", 0.38, 0.3),
      metal = mat("#8b9290", 0.3, 0.7),
      wood = mat("#b6a58c"),
      orange = mat("#e76536");
    const mesh = (
      g: THREE.BufferGeometry,
      m: THREE.Material,
      p: number[],
      parent: THREE.Object3D = scene,
    ) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(p[0], p[1], p[2]);
      o.castShadow = true;
      o.receiveShadow = true;
      parent.add(o);
      return o;
    };
    mesh(
      new THREE.PlaneGeometry(200, 200),
      mat("#e6e9e6"),
      [0, -0.03, 0],
    ).rotation.x = -Math.PI / 2;
    const grid = new THREE.GridHelper(30, 100, "#cbd1cb", "#d9ded8");
    grid.position.y = -0.02;
    scene.add(grid);
    mesh(new THREE.BoxGeometry(2.55, 0.12, 1.75), wood, [0, 0.72, 0]);
    mesh(
      new THREE.BoxGeometry(2.58, 0.025, 1.78),
      mat("#d3c5ae"),
      [0, 0.795, 0],
    );
    for (const x of [-1.08, 1.08])
      for (const z of [-0.65, 0.65])
        mesh(new THREE.BoxGeometry(0.085, 0.72, 0.085), black, [x, 0.34, z]);
    mesh(new THREE.BoxGeometry(2.2, 0.06, 0.045), black, [0, 0.35, -0.65]);
    // A procedural laminated work surface: understated, no external textures.
    for (let i = 0; i < 42; i++) {
      const line = mesh(
        new THREE.BoxGeometry(2.54, 0.0005, 0.0015),
        mat(i % 3 ? "#bcaf99" : "#c5b8a2"),
        [0, 0.809, -0.86 + i * 0.042],
      );
      line.castShadow = false;
    }
    const base = new THREE.Vector3(-0.7, 0.83, -0.42);
    mesh(
      new THREE.CylinderGeometry(0.22, 0.25, 0.08, 48),
      black,
      [-0.7, 0.85, -0.42],
    );
    mesh(
      new THREE.CylinderGeometry(0.17, 0.2, 0.18, 48),
      white,
      [-0.7, 0.96, -0.42],
    );
    mesh(
      new THREE.CylinderGeometry(0.174, 0.174, 0.022, 48),
      orange,
      [-0.7, 1.005, -0.42],
    );
    const joints: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++)
      joints.push(
        mesh(
          new THREE.SphereGeometry(i === 3 ? 0.082 : 0.115, 32, 20),
          black,
          [0, 0, 0],
        ),
      );
    const links: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++)
      links.push(
        mesh(
          new THREE.CylinderGeometry(
            i === 2 ? 0.065 : 0.09,
            i === 2 ? 0.085 : 0.11,
            1,
            32,
          ),
          white,
          [0, 0, 0],
        ),
      );
    const collar = mesh(
      new THREE.CylinderGeometry(0.075, 0.085, 0.105, 32),
      metal,
      [0, 0, 0],
    );
    const hand = mesh(
      new THREE.BoxGeometry(0.18, 0.075, 0.085),
      black,
      [0, 0, 0],
    );
    const fingers = [
      mesh(new THREE.BoxGeometry(0.024, 0.14, 0.037), metal, [0, 0, 0]),
      mesh(new THREE.BoxGeometry(0.024, 0.14, 0.037), metal, [0, 0, 0]),
    ];
    const cube = mesh(
      new THREE.BoxGeometry(0.13, 0.13, 0.13),
      mat(latest.current.task.color, 0.4),
      latest.current.world.object,
    );
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(cube.geometry),
      new THREE.LineBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.2,
      }),
    );
    cube.add(edge);
    mesh(
      new THREE.BoxGeometry(0.11, 0.11, 0.11),
      mat("#d4b966"),
      [0.08, 0.87, -0.22],
    );
    mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.16, 32),
      mat("#73919a"),
      [0.57, 0.89, -0.46],
    );
    const bowl = new THREE.Group();
    scene.add(bowl);
    bowl.position.set(0.58, 0.815, 0.28);
    const points = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.14, 0),
      new THREE.Vector2(0.205, 0.1),
      new THREE.Vector2(0.22, 0.14),
      new THREE.Vector2(0.201, 0.14),
      new THREE.Vector2(0.18, 0.105),
      new THREE.Vector2(0.13, 0.018),
      new THREE.Vector2(0, 0.018),
    ];
    const bowlMesh = mesh(
      new THREE.LatheGeometry(points, 64),
      mat("#f2eee4", 0.3),
      [0, 0, 0],
      bowl,
    );
    const ring = mesh(
      new THREE.TorusGeometry(0.265, 0.003, 8, 80),
      orange,
      [0.58, 0.817, 0.28],
    );
    ring.rotation.x = -Math.PI / 2;
    const tray = mesh(
      new THREE.CylinderGeometry(0.21, 0.22, 0.018, 64),
      mat("#c5b49a"),
      [0.65, 0.824, -0.24],
    );
    const path = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: "#e67948",
        dashSize: 0.035,
        gapSize: 0.025,
        transparent: true,
        opacity: 0.7,
      }),
    );
    scene.add(path);
    const tip = new THREE.Vector3(...latest.current.world.grip);
    let physics: RobotPhysics | undefined,
      disposed = false,
      lastEpisode = -1,
      lastTime = 0,
      accumulator = 0,
      aperture = 0.12,
      motionKey = "",
      observedMotionKey = "",
      motionSeconds = 0,
      settledFor = 0,
      releaseFor = 0,
      reportedSettlement = false;
    createPhysics(
      new Float32Array(bowlMesh.geometry.attributes.position.array),
      new Uint32Array(bowlMesh.geometry.index!.array),
    )
      .then((p) => {
        if (disposed) {
          p.free();
          return;
        }
        physics = p;
      })
      .catch((e) => setError(`Physics could not start: ${String(e)}`));
    let lastView = "",
      lastReset = -1,
      lastShot = 0,
      lastPath = "",
      raf = 0;
    function animate(time: number) {
      raf = requestAnimationFrame(animate);
      const { world: w, task: t } = latest.current;
      if (lastView !== view.current || lastReset !== reset.current) {
        lastView = view.current;
        lastReset = reset.current;
        if (lastView === "Top") camera.position.set(0.01, 5, 0.01);
        else if (lastView === "Front") camera.position.set(0, 2, 5);
        else camera.position.set(2.9, 2.7, 3.6);
        controls.target.set(0, 0.95, 0);
      }
      const delta = Math.min((time - lastTime) / 1000 || 1 / 60, 0.05);
      lastTime = time;
      const goal = new THREE.Vector3(...w.grip);
      if (physics) {
        if (lastEpisode !== w.id) {
          setError("");
          physics.reset(w, t);
          lastEpisode = w.id;
          tip.copy(goal);
          aperture = 0.12;
          motionKey = "";
          reportedSettlement = false;
          releaseFor = 0;
          settledFor = 0;
          accumulator = 0;
        }
        accumulator += delta;
        while (accumulator >= 1 / 120) {
          tip.lerp(goal, 1 - Math.exp(-8 / 120));
          const near = tip.distanceTo(goal) < 0.006;
          const targetAperture =
            w.holding && (w.phase > 2 || near) ? 0.077 : 0.12;
          aperture += (targetAperture - aperture) * (1 - Math.exp(-10 / 120));
          physics.update(tip, aperture, w.holding, near);
          accumulator -= 1 / 120;
        }
        cube.position.copy(physics.position);
        cube.quaternion.copy(physics.rotation);
        host.dataset.physics = "rapier";
        host.dataset.objectPosition = JSON.stringify([
          cube.position.x,
          cube.position.y,
          cube.position.z,
        ]);
        host.dataset.gripperAperture = String(aperture);
        host.dataset.holding = String(physics.holding);
        const key = `${w.id}:${w.step}`;
        if (observedMotionKey !== key) {
          observedMotionKey = key;
          motionSeconds = 0;
        }
        if (motionKey !== key && !w.settling && !w.success) {
          motionSeconds += delta;
          if (motionSeconds > 8 && !reportedSettlement) {
            reportedSettlement = true;
            setError("Motion could not finish. Reset the episode to retry.");
            callbacks.current.onSettled(false, [
              cube.position.x,
              cube.position.y,
              cube.position.z,
            ]);
          }
        }
        const atTarget = tip.distanceTo(goal) < 0.006;
        const handReady = w.holding
          ? physics.holding && aperture < 0.079
          : !physics.holding && aperture > 0.118;
        if (atTarget && handReady && motionKey !== key && !w.settling) {
          motionKey = key;
          callbacks.current.onMotionComplete([
            cube.position.x,
            cube.position.y,
            cube.position.z,
          ]);
        }
        if (w.settling && !physics.holding) {
          releaseFor += delta;
          settledFor = physics.velocity < 0.035 ? settledFor + delta : 0;
          if (!reportedSettlement && (settledFor > 0.45 || releaseFor > 5)) {
            reportedSettlement = true;
            const onTarget =
              Math.hypot(
                cube.position.x - t.target[0],
                cube.position.z - t.target[1],
              ) < 0.13 &&
              cube.position.y > 0.83 &&
              cube.position.y < 1.02;
            callbacks.current.onSettled(onTarget && settledFor > 0.45, [
              cube.position.x,
              cube.position.y,
              cube.position.z,
            ]);
          }
        }
      }
      (cube.material as THREE.MeshStandardMaterial).color.set(t.color);
      const shoulder = new THREE.Vector3(base.x, 1.18, base.z);
      const elbow = new THREE.Vector3(-1.05, 1.85, 0.15);
      const wrist = new THREE.Vector3(tip.x, tip.y + 0.22, tip.z);
      const pts = [shoulder, elbow, wrist, tip];
      joints.forEach((j, i) => j.position.copy(pts[i]));
      links.forEach((l, i) => {
        const a = pts[i],
          b = pts[i + 1];
        l.position.copy(a).add(b).multiplyScalar(0.5);
        l.scale.y = a.distanceTo(b);
        l.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          b.clone().sub(a).normalize(),
        );
      });
      collar.position.copy(tip).add(new THREE.Vector3(0, -0.04, 0));
      hand.position.copy(tip).add(new THREE.Vector3(0, -0.11, 0));
      fingers.forEach((f, i) =>
        f.position
          .copy(tip)
          .add(new THREE.Vector3((i ? 1 : -1) * aperture, -0.19, 0)),
      );
      ring.position.x = t.target[0];
      ring.position.z = t.target[1];
      tray.visible = t.suite === "Goal";
      const pathKey = `${w.seed}:${t.id}`;
      if (lastPath !== pathKey) {
        lastPath = pathKey;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(...w.home).add(new THREE.Vector3(0, 0.18, 0)),
          new THREE.Vector3(w.home[0], 1.4, w.home[2]),
          new THREE.Vector3(t.target[0], 1.4, t.target[1]),
          new THREE.Vector3(t.target[0], 0.94, t.target[1]),
        ]);
        path.geometry.dispose();
        path.geometry = new THREE.BufferGeometry().setFromPoints(
          curve.getPoints(48),
        );
        path.computeLineDistances();
      }
      controls.update();
      renderer.render(scene, camera);
      if (frame.current && time - lastShot > 800) {
        lastShot = time;
        frame.current(renderer.domElement.toDataURL("image/jpeg", 0.55));
      }
    }
    const resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.zoom = width < 500 ? 0.75 : 1;
      camera.updateProjectionMatrix();
    });
    resize.observe(host);
    raf = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      physics?.free();
      cancelAnimationFrame(raf);
      resize.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);
  return (
    <div ref={mount} className="scene-canvas">
      {error && <p className="scene-error">{error}</p>}
    </div>
  );
}
