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
    grip: [...w.grip],
    object: [...w.object],
  };
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
export function premise(w: World, t: Task) {
  const observations = [
    "The object rests on the table. The open gripper is away from the object.",
    "The open gripper is directly above the target object. The object has not been grasped.",
    "The gripper is closed around the target object, which is still at table height.",
    "The gripper holds the lifted object above the table, away from the destination.",
    "The gripper holds the object directly above the clear destination.",
    "The object has been released and is settling under gravity.",
  ];
  return `Task: ${t.instruction} Observation: ${observations[w.phase]}. Object position: ${w.object.map((v) => v.toFixed(2))}. Gripper position: ${w.grip.map((v) => v.toFixed(2))}. Destination: ${t.target}.`;
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
};
