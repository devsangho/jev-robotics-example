export type Task = {
  id: string;
  title: string;
  instruction: string;
  object: string;
  color: string;
  target: [number, number];
  suite: string;
};
export const tasks: Task[] = [
  {
    id: "spatial-01",
    title: "Pick & place",
    instruction: "Pick up the red cube and place it in the bowl.",
    object: "red cube",
    color: "#dd644b",
    target: [0.58, 0.28],
    suite: "Spatial",
  },
  {
    id: "object-01",
    title: "Object selection",
    instruction: "Pick up the blue cube and place it in the bowl.",
    object: "blue cube",
    color: "#547ea7",
    target: [0.58, 0.28],
    suite: "Object",
  },
  {
    id: "goal-01",
    title: "Goal transfer",
    instruction: "Move the green cube onto the circular tray.",
    object: "green cube",
    color: "#729579",
    target: [0.65, -0.24],
    suite: "Goal",
  },
];
export type Action = "approach" | "grasp" | "lift" | "transfer" | "release";
export const actions: Action[] = [
  "approach",
  "grasp",
  "lift",
  "transfer",
  "release",
];
export const actionText: Record<Action, string> = {
  approach: "Move gripper above the target object",
  grasp: "Close gripper around the target object",
  lift: "Lift the grasped object above the table",
  transfer: "Move the held object over the destination",
  release: "Open gripper to release the object",
};
let episodeId = 0;
export type World = {
  id: number;
  settling: boolean;
  obstacle?: [number, number];
  blocked?: string;
  changes?: string[];
  phase: number;
  step: number;
  object: [number, number, number];
  home: [number, number, number];
  grip: [number, number, number];
  holding: boolean;
  success: boolean;
  seed: number;
};
export function initialWorld(seed: number): World {
  const x = -0.35 + Math.sin(seed * 17.3) * 0.12,
    z = 0.34 + Math.cos(seed * 9.1) * 0.1;
  return {
    id: ++episodeId,
    settling: false,
    phase: 0,
    step: 0,
    object: [x, 0.875, z],
    home: [x, 0.875, z],
    grip: [0.15, 1.4, 0.02],
    holding: false,
    success: false,
    seed,
  };
}
export function advance(w: World, a: Action, task: Task): World {
  const n: World = {
    ...w,
    step: w.step + 1,
    blocked: undefined,
    grip: [...w.grip],
    object: [...w.object],
  };
  if (a === "transfer" && w.phase === 3 && transferBlocked(w, task)) {
    return {
      ...n,
      blocked:
        "Transfer path blocked. Move the destination or remove the obstacle; this staged controller has no avoidance action.",
    };
  }
  if (a === actions[w.phase]) {
    n.phase++;
    if (a === "approach") n.grip = [w.object[0], 1.3, w.object[2]];
    if (a === "grasp") {
      n.grip = [w.object[0], 1.09, w.object[2]];
      n.holding = true;
    }
    if (a === "lift") {
      n.grip = [w.object[0], 1.5, w.object[2]];
      n.object = [w.object[0], 1.3, w.object[2]];
    }
    if (a === "transfer") {
      n.grip = [task.target[0], 1.5, task.target[1]];
      n.object = [task.target[0], 1.3, task.target[1]];
    }
    if (a === "release") {
      n.holding = false;
      n.settling = true;
    }
  }
  return n;
}
export function transferBlocked(w: World, t: Task) {
  if (!w.obstacle) return false;
  const [x, z] = w.obstacle;
  const dx = t.target[0] - w.grip[0],
    dz = t.target[1] - w.grip[2];
  const length = dx * dx + dz * dz;
  const u = length
    ? Math.max(
        0,
        Math.min(1, ((x - w.grip[0]) * dx + (z - w.grip[2]) * dz) / length),
      )
    : 0;
  return Math.hypot(x - w.grip[0] - u * dx, z - w.grip[2] - u * dz) < 0.22;
}
export function freshWorld(w: World): World {
  return { ...structuredClone(w), id: initialWorld(w.seed).id };
}
export function premise(w: World, t: Task) {
  const observations = [
    "The object rests on the table. The open gripper is away from the object.",
    "The open gripper is directly above the target object. The object has not been grasped.",
    "The gripper is closed around the target object, which is still at table height.",
    "The gripper holds the lifted object above the table, away from the destination.",
    "The gripper holds the object directly above the destination.",
    "The object has been released and is settling under gravity.",
  ];
  return `Task: ${t.instruction} Observation: ${observations[w.phase]}. Object position: ${w.object.map((v) => v.toFixed(2))}. Gripper position: ${w.grip.map((v) => v.toFixed(2))}. Destination: ${t.target}. ${w.obstacle ? `Obstacle at ${w.obstacle}, height 0.60 m above the table. ${transferBlocked(w, t) ? "The straight transfer path is obstructed." : "The straight transfer path is clear."}` : "No added obstacle."}${w.blocked ? ` Last action: ${w.blocked}` : ""}`;
}
export function demoScores(w: World): number[] {
  return actions.map((_, i) =>
    i === w.phase ? 0.94 : Math.max(0.02, 0.16 - Math.abs(i - w.phase) * 0.035),
  );
}
export type Decision = {
  action: Action;
  scores: number[];
  latency: number;
  source: string;
  observation?: string;
  world?: World;
  task?: Task;
};
export type RunRecord = {
  id: string;
  task: string;
  mode: string;
  seed: number;
  success: boolean;
  steps: number;
  latency: number;
  date: string;
  decisions: Decision[];
  comparisonId?: string;
  comparisonRole?: "baseline" | "model";
  taskConfig?: Task;
  initial?: World;
};
