# Playground

**English** | [한국어](README.ko.md)

An independent robotics playground built with Three.js, React, TypeScript, and Vite. Run Kotoba's Open-Jev DeBERTa typed-decision model entirely in your browser, and deploy the frontend to GitHub Pages. This project is not an official JEV, OpenJEV, or LIBERO service.

**[Open the playground](https://devsangho.github.io/jev-robotics-example/)**

## Use it without a server

1. [Open Playground](https://devsangho.github.io/jev-robotics-example/).
2. Click **Load Open-Jev · 480 MB**. Weights download once and are cached by your browser.
3. Watch candidate probabilities and measured decision latency as the robot takes actions.

No Python, local server, or API key is required. The quantized model runs in a Web Worker on WebGPU, using WebGPU. This quantized model requires WebGPU; the scripted preview also works without it. The loading panel reports actual download progress and supports cancellation. The no-download scripted preview remains available.

The browser model is **Kotoba's Open-Jev DeBERTa**, not AlexWortega's Qwen 4B. It scores all five choices in one forward pass without generating text. Robotics is outside its training domains; displayed probabilities are not a guarantee of successful robot control.

## Developer quick start

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Open http://localhost:5173. Use `npm run build` to create `dist/` and `npm run preview` to preview the production build.

## What works—and what is being simulated

| Feature | Implementation |
| --- | --- |
| Interactive 3D scene | Procedural arm and cameras, Rapier rigid-body contacts, gripper grasp constraint, visible release, and gravity |
| Scripted policy | Five deterministic manipulation stages and demonstration scores; no trained model |
| Local OpenJEV | The actual AlexWortega Qwen 4B NLI checkpoint, served through a local Python bridge |
| Browser model | Open-Jev DeBERTa q4, actual typed-decision probabilities via Transformers.js, WebGPU, no server |
| Experiments | Three tasks, seeded initial positions, play/pause/single-step/reset, and repeated episodes |
| History | Up to 50 episodes in localStorage, measured client round-trip latency, action scores, and JSON export |
| Real LIBERO integration | A separate Python rollout client for MuJoCo and a user-provided VLA candidate endpoint |

The browser scene is a **LIBERO-inspired physics playground**, not the official benchmark. Rapier simulates the object, table, bowl, and gripper contacts. Grasping uses a fixed joint, the fingers visibly open before release, and success requires the object to settle inside the target. The arm follows staged motion rather than faithful Franka joint dynamics or a pretrained VLA. Demo completion rates are not benchmark scores.

Browser model mode receives text observations from the simulator; it is an integration demonstration, not a visual generalization evaluation. The scene-camera preview is not sent to the model. The original OpenJEV 4B checkpoint has not been converted to a browser runtime here.

Browser DeBERTa scores use a softmax over candidate logits at the source model’s temperature of 1.05. These probabilities sum to one but are not calibrated on robotics. The optional AlexWortega bridge returns independent NLI entailment probabilities, which need not sum to one.

## GitHub Pages

The workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) tests, builds, and deploys on pushes to `main` or manual dispatch.

1. In repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
2. Push the project to `main`.
3. Check **Actions → Deploy Playground to GitHub Pages**.

The current repository is configured for:

```text
https://devsangho.github.io/jev-robotics-example/
```

The workflow reads `GITHUB_REPOSITORY` to set Vite's repository base path. A `username.github.io` repository uses `/`. For a custom domain, change the base to `/` and add `public/CNAME`.

Preview the Pages path locally:

```bash
GITHUB_PAGES=true GITHUB_REPOSITORY=devsangho/jev-robotics-example npm run build
npm run preview
# http://localhost:4173/jev-robotics-example/
```

GitHub Pages serves the static frontend; it cannot run the Python model server. The demo and actual Open-Jev DeBERTa model run on the hosted frontend, on the user’s own device. Only the optional AlexWortega Qwen bridge needs a separate process. Connecting from HTTPS to loopback HTTP depends on browser local-network permissions and policies. If blocked, run the frontend locally or use a trusted local HTTPS proxy.

## Optional developer bridge: AlexWortega OpenJEV 4B

Python 3.11 or newer is recommended. The bridge automatically selects CUDA, Apple MPS, or CPU. Allow approximately 9 GB or more of disk space for model weights and sufficient memory for weights and inference buffers. CPU mode loads float32 weights and therefore needs more RAM.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
uvicorn server.app:app --host 127.0.0.1 --port 8000
```

The first start downloads `AlexWortega/openjev`, subfolder `qwen3.5-4b-nli-v2`. Wait for model loading to finish, then select **Model runtime → Connect OpenJEV**. No API key is required.

Optional environment variables:

```bash
OPENJEV_DEVICE=cpu                        # cuda / mps / cpu
OPENJEV_SUBFOLDER=qwen3.5-4b-nli-v2        # default checkpoint
OPENJEV_REVISION=<hugging-face-commit>     # pin a revision for reproducibility
JEV_ALLOWED_ORIGIN=https://YOURNAME.github.io
```

CORS allows the local development origins and the configured Pages origin. An origin must not include a repository path. Bind the bridge to loopback. The bridge uses standard Transformers classification classes without enabling arbitrary remote Python code.

### Bridge API

`GET /health` returns `{service, ready, model, device}`.

`POST /score` accepts:

```json
{
  "premise": "The gripper is above the red block and is open.",
  "hypotheses": [
    "The appropriate next action is: close the gripper.",
    "The appropriate next action is: release the object."
  ]
}
```

The response contains `scores` in candidate order and `probabilities` as `[contradiction, entailment, neutral]` per candidate. Requests accept 1–16 candidates and truncate inputs to 2048 tokens. The browser demo uses five candidates.

## Browser model implementation

The browser downloads [`onnx-community/open-jev-deberta-v3-large-ONNX`](https://huggingface.co/onnx-community/open-jev-deberta-v3-large-ONNX), a Transformers.js-ready conversion of Kotoba's typed-decision model. The q4 graph and external data total approximately 478 MB, plus tokenizer and runtime assets.

`src/decision.worker.ts` constructs state/question/option span inputs, runs one forward pass, and applies the model's temperature-scaled softmax. Inputs stay on the device. The 512-token context limits the state to 256 tokens. No text decoding or synthetic scores are used in model mode.

Model execution uses a worker so rendering and controls remain responsive. The ONNX WebAssembly bridge uses one thread because GitHub Pages cannot set COOP/COEP headers. Quantized GatherBlockQuantized operators require WebGPU and do not have a working CPU fallback in the tested runtime. Browser cache availability depends on storage settings; clearing browser data removes cached weights. Loading failures and invalid outputs are shown explicitly, without silently switching to the scripted policy.

## Real LIBERO + VLA integration

[`server/run_libero.py`](server/run_libero.py) is an integration runner using the real LIBERO API. It does **not** bundle LIBERO assets, pretrained VLA weights, or a VLA server. Use separate Python environments/processes for LIBERO, OpenJEV, and your VLA model because their dependencies differ.

1. Follow the [official LIBERO installation guide](https://github.com/Lifelong-Robot-Learning/LIBERO) and prepare BDDL files and initial states. NumPy and Pillow are also required.
2. Start the OpenJEV bridge in its own environment.
3. Supply a VLA `/candidates` endpoint matching the contract below, backed by a trained LIBERO policy.
4. Run this client in the LIBERO environment:

```bash
python server/run_libero.py \
  --vla-url http://127.0.0.1:9000/candidates \
  --suite libero_spatial --task 0 --episodes 5 \
  --seed 42 --max-steps 300 --output runs/jev.json

# Matched baseline: execute candidate 0 without OpenJEV reranking.
python server/run_libero.py \
  --vla-url http://127.0.0.1:9000/candidates \
  --suite libero_spatial --task 0 --episodes 5 \
  --seed 42 --max-steps 300 --baseline --output runs/baseline.json
```

The CLI writes real LIBERO results to JSON. The web history currently displays browser episodes only. The runner uses official task initial states in order and `env.check_success()` for success detection. This custom candidate-reranking protocol is not directly comparable to published leaderboard scores. A controlled comparison requires matching preprocessing, seeds, candidates, rollout horizons, and sufficient episodes across the suite.

### VLA endpoint contract

Requests include `instruction`, `suite`, `episode`, `reset`, `seed`, `image_png_base64`, `wrist_png_base64`, `proprio`, and `action_convention`. Images are 256×256 RGB PNGs with both MuJoCo image axes flipped. The VLA adapter must perform model-specific resizing/cropping, action unnormalization, and gripper conversion. Reset policy caches on `reset: true` and use the supplied seed.

Example response, illustrating the format rather than trained policy output:

```json
{
  "observation_text": "The open gripper is immediately above the red cube.",
  "candidates": [
    {
      "description": "Close the gripper to grasp the red cube.",
      "actions": [[0, 0, 0, 0, 0, 0, 1]]
    },
    {
      "description": "Move the empty gripper away from the cube.",
      "actions": [[0.1, 0, 0, 0, 0, 0, -1]]
    }
  ]
}
```

Supply 1–16 candidates, each with a semantic description and a chunk of 1–32 seven-dimensional actions. Actions must be converted to LIBERO's OSC_POSE controller convention: normalized `[-1, 1]` delta xyz / rotation axis-angle / gripper, with -1=open and +1=closed. Do not send raw model-normalized outputs.

OpenJEV evaluates **text observations and candidate descriptions supplied by the VLA adapter**. Grounding and description quality are the adapter's responsibility; NLI scores do not verify the physical success of raw actions. Candidate 0 is treated as the VLA baseline. The endpoint implementation depends on your chosen model and serving stack.

## Validation

```bash
npm run build
npx playwright install chromium
npm test
python3 -m unittest discover -s server -p 'test_*.py'
```

Playwright covers the WebGL canvas, episode completion/reset/history/export, repeated seeds, mobile layout, and bridge response/error handling. Bridge browser tests use HTTP fixtures, not actual model inference. The optional `node scripts/browser-model-smoke.mjs` test downloads the real browser model and runs one decision against `npm run preview`. Model inference and MuJoCo/VLA end-to-end execution require separate validation on a machine with the necessary weights and environments installed.

The requested MapMyVisitors script loads from an external service for tracking only; its visual widget is hidden. It is separate from local model inference; automated tests do not contribute to its visitor count.

## References

- [AlexWortega OpenJEV model and NLI interface](https://huggingface.co/AlexWortega/openjev)
- [LIBERO](https://github.com/Lifelong-Robot-Learning/LIBERO)
- [OpenVLA LIBERO evaluation](https://github.com/openvla/openvla/blob/main/experiments/robot/libero/run_libero_eval.py)
- [Browser Open-Jev model card and input contract](https://huggingface.co/onnx-community/open-jev-deberta-v3-large-ONNX)
- [Transformers.js](https://github.com/huggingface/transformers.js)
