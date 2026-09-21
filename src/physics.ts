import RAPIER from "@dimforge/rapier3d-compat";
import type { Task, World } from "./simulation";
const initialized = RAPIER.init();
export async function createPhysics(
  bowlVertices: Float32Array,
  bowlIndices: Uint32Array,
) {
  await initialized;
  let physics: RAPIER.World,
    cube: RAPIER.RigidBody,
    palm: RAPIER.RigidBody,
    fingers: RAPIER.RigidBody[],
    joint: RAPIER.ImpulseJoint | undefined;
  function reset(state: World, task: Task) {
    physics?.free();
    joint = undefined;
    physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    physics.timestep = 1 / 120;
    const fixed = (
      shape: RAPIER.ColliderDesc,
      x: number,
      y: number,
      z: number,
    ) => physics.createCollider(shape.setTranslation(x, y, z).setFriction(0.8));
    fixed(RAPIER.ColliderDesc.cuboid(1.29, 0.0125, 0.89), 0, 0.795, 0);
    fixed(RAPIER.ColliderDesc.cuboid(10, 0.025, 10), 0, -0.055, 0);
    fixed(
      RAPIER.ColliderDesc.trimesh(bowlVertices, bowlIndices),
      0.58,
      0.815,
      0.28,
    );
    if (task.suite === "Goal")
      fixed(RAPIER.ColliderDesc.cylinder(0.009, 0.21), 0.65, 0.824, -0.24);
    fixed(RAPIER.ColliderDesc.cuboid(0.055, 0.055, 0.055), 0.08, 0.87, -0.22);
    fixed(RAPIER.ColliderDesc.cylinder(0.08, 0.055), 0.57, 0.89, -0.46);
    cube = physics.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(
          ...(state.holding
            ? ([state.grip[0], state.grip[1] - 0.215, state.grip[2]] as [
                number,
                number,
                number,
              ])
            : state.object),
        )
        .setCcdEnabled(true)
        .setLinearDamping(0.8)
        .setAngularDamping(1),
    );
    physics.createCollider(
      RAPIER.ColliderDesc.cuboid(0.065, 0.065, 0.065)
        .setMass(0.2)
        .setFriction(0.9)
        .setRestitution(0.03),
      cube,
    );
    palm = physics.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        state.grip[0],
        state.grip[1] - 0.11,
        state.grip[2],
      ),
    );
    physics.createCollider(
      RAPIER.ColliderDesc.cuboid(0.09, 0.0375, 0.0425),
      palm,
    );
    fingers = [-1, 1].map((sign) => {
      const body = physics.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          state.grip[0] + sign * 0.12,
          state.grip[1] - 0.19,
          state.grip[2],
        ),
      );
      physics.createCollider(
        RAPIER.ColliderDesc.cuboid(0.012, 0.07, 0.0185).setFriction(0.9),
        body,
      );
      return body;
    });
    if (state.holding) {
      joint = physics.createImpulseJoint(
        RAPIER.JointData.fixed(
          { x: 0, y: -0.105, z: 0 },
          { x: 0, y: 0, z: 0, w: 1 },
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0, w: 1 },
        ),
        palm,
        cube,
        true,
      );
      joint.setContactsEnabled(false);
    }
  }
  function update(
    tip: { x: number; y: number; z: number },
    aperture: number,
    grasp: boolean,
    atTarget: boolean,
  ) {
    palm.setNextKinematicTranslation({ x: tip.x, y: tip.y - 0.11, z: tip.z });
    fingers.forEach((f, i) =>
      f.setNextKinematicTranslation({
        x: tip.x + (i ? 1 : -1) * aperture,
        y: tip.y - 0.19,
        z: tip.z,
      }),
    );
    if (grasp && !joint && atTarget && aperture < 0.079) {
      const position = cube.translation();
      if (
        Math.hypot(position.x - tip.x, position.z - tip.z) < 0.04 &&
        Math.abs(position.y - (tip.y - 0.215)) < 0.035
      ) {
        joint = physics.createImpulseJoint(
          RAPIER.JointData.fixed(
            { x: 0, y: -0.105, z: 0 },
            { x: 0, y: 0, z: 0, w: 1 },
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0, w: 1 },
          ),
          palm,
          cube,
          true,
        );
        joint.setContactsEnabled(false);
      }
    }
    if (!grasp && joint && aperture > 0.105) {
      physics.removeImpulseJoint(joint, true);
      joint = undefined;
    }
    physics.step();
  }
  return {
    reset,
    update,
    get position() {
      return cube.translation();
    },
    get rotation() {
      return cube.rotation();
    },
    get velocity() {
      const v = cube.linvel();
      return Math.hypot(v.x, v.y, v.z);
    },
    get holding() {
      return !!joint;
    },
    free() {
      physics?.free();
    },
  };
}
export type RobotPhysics = Awaited<ReturnType<typeof createPhysics>>;
