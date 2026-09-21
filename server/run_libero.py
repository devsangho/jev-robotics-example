"""Optional real LIBERO rollout client. Requires separate LIBERO/VLA installations.

The VLA adapter must supply candidate action chunks and descriptions.
This runner does not contain pretrained VLA weights or a VLA model server.
"""
import argparse
import base64
import io
import json
import math
import os
from pathlib import Path
from urllib.request import Request, urlopen


def post(url, body):
    request = Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=180) as response:
        return json.load(response)


def validate_candidates(data):
    candidates = data.get("candidates")
    if not isinstance(candidates, list) or not 1 <= len(candidates) <= 16:
        raise ValueError("Expected 1–16 candidates")
    for candidate in candidates:
        if not isinstance(candidate.get("description"), str) or not candidate["description"].strip():
            raise ValueError("Every candidate needs a semantic description")
        chunk = candidate.get("actions")
        if not isinstance(chunk, list) or not 1 <= len(chunk) <= 32:
            raise ValueError("Expected action chunks of length 1–32")
        for action in chunk:
            if not isinstance(action, list) or len(action) != 7 or any(
                isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or abs(v) > 1
                for v in action
            ):
                raise ValueError("Actions must contain 7 finite controller-normalized values in [-1, 1]")
    if not isinstance(data.get("observation_text"), str) or not data["observation_text"].strip():
        raise ValueError("The VLA adapter must provide a grounded observation_text for text NLI")
    return candidates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vla-url", required=True, help="Your VLA adapter's /candidates endpoint")
    parser.add_argument("--jev-url", default="http://127.0.0.1:8000/score")
    parser.add_argument("--suite", choices=["libero_spatial", "libero_object", "libero_goal", "libero_10", "libero_90"], default="libero_spatial")
    parser.add_argument("--task", type=int, default=0)
    parser.add_argument("--episodes", type=int, default=5)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-steps", type=int, default=300)
    parser.add_argument("--baseline", action="store_true", help="Execute candidate 0 without OpenJEV for a matched baseline")
    parser.add_argument("--output", default="runs/libero.json")
    args = parser.parse_args()
    if args.episodes < 1 or args.max_steps < 1:
        parser.error("episodes and max-steps must be positive")
    import numpy as np
    from PIL import Image
    from libero.libero import benchmark, get_libero_path
    from libero.libero.envs import OffScreenRenderEnv

    suite = benchmark.get_benchmark_dict()[args.suite]()
    if not 0 <= args.task < suite.n_tasks:
        parser.error("task index outside suite")
    task = suite.get_task(args.task)
    initial_states = suite.get_task_init_states(args.task)
    if args.episodes > len(initial_states):
        parser.error("episodes exceeds available initial states")
    env = OffScreenRenderEnv(bddl_file_name=os.path.join(get_libero_path("bddl_files"), task.problem_folder, task.bddl_file), camera_heights=256, camera_widths=256)
    records = []
    def image_b64(array):
        buffer = io.BytesIO()
        Image.fromarray(np.ascontiguousarray(array[::-1, ::-1])).save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()
    try:
        for episode in range(args.episodes):
            env.seed(args.seed + episode)
            env.reset()
            obs = env.set_init_state(initial_states[episode])
            for _ in range(10):
                obs, _, _, _ = env.step([0, 0, 0, 0, 0, 0, -1])
            success, step, trace = False, 0, []
            while step < args.max_steps and not success:
                payload = {
                    "instruction": task.language, "suite": args.suite,
                    "episode": episode, "reset": step == 0, "seed": args.seed + episode,
                    "image_png_base64": image_b64(obs["agentview_image"]),
                    "wrist_png_base64": image_b64(obs["robot0_eye_in_hand_image"]),
                    "proprio": {key: np.asarray(obs[key]).tolist() for key in
                                ["robot0_eef_pos", "robot0_eef_quat", "robot0_gripper_qpos"]},
                    "action_convention": "LIBERO OSC_POSE normalized delta xyz/axis-angle/gripper; gripper -1=open,+1=closed",
                }
                proposal = post(args.vla_url, payload)
                candidates = validate_candidates(proposal)
                chosen, scores = 0, None
                if not args.baseline:
                    scored = post(args.jev_url, {"premise": f"Instruction: {task.language}\nObservation: {proposal['observation_text']}",
                                  "hypotheses": [f"The appropriate next action is: {c['description']}" for c in candidates]})
                    scores = scored.get("scores")
                    if not isinstance(scores, list) or len(scores) != len(candidates) or any(not isinstance(v, (float, int)) or not math.isfinite(v) or not 0 <= v <= 1 for v in scores):
                        raise ValueError("Invalid OpenJEV scores")
                    chosen = int(np.argmax(scores))
                trace.append({"step": step, "selected": chosen, "scores": scores,
                              "observation_text": proposal["observation_text"], "candidates": candidates})
                for action in candidates[chosen]["actions"]:
                    obs, _, _, _ = env.step(action)
                    step += 1
                    success = bool(env.check_success())
                    if success or step >= args.max_steps:
                        break
            records.append({"episode": episode, "seed": args.seed + episode, "initial_state_index": episode,
                            "success": success, "steps": step, "trace": trace})
            output = {"environment": "LIBERO/MuJoCo", "suite": args.suite, "task": task.name,
                      "protocol": "custom candidate-reranking experiment; not a published leaderboard score",
                      "baseline": args.baseline, "max_steps": args.max_steps,
                      "success_rate": sum(r["success"] for r in records) / len(records), "records": records}
            path = Path(args.output)
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(".tmp")
            temporary.write_text(json.dumps(output, indent=2))
            temporary.replace(path)
            print(f"Episode {episode}: success={success}, steps={step}", flush=True)
    finally:
        env.close()


if __name__ == "__main__":
    main()
