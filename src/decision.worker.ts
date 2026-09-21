import {
  AutoModel,
  AutoTokenizer,
  Tensor,
  env,
} from "@huggingface/transformers";

// These are Kotoba's typed-decision weights, not AlexWortega's Qwen checkpoint.
const repository = "onnx-community/open-jev-deberta-v3-large-ONNX";
env.allowLocalModels = false;
env.backends.onnx.wasm!.numThreads = 1; // GitHub Pages cannot set COOP/COEP headers.
let model: Awaited<ReturnType<typeof AutoModel.from_pretrained>> | undefined;
let tokenizer:
  Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | undefined;
const device = "webgpu";
let queue = Promise.resolve();

async function processRequest(data: {
  id: number;
  type: string;
  state?: string;
  options?: string[];
}) {
  const { id, type } = data;
  const progress = (text: string) => self.postMessage({ id, progress: text });
  try {
    if (type === "load") {
      const started = performance.now();
      let assetsReady = started;
      const reused = !!model;
      if (!model) {
        const gpu = (
          self.navigator as Navigator & {
            gpu?: { requestAdapter: () => Promise<unknown> };
          }
        ).gpu;
        if (!gpu || !(await gpu.requestAdapter()))
          throw new Error(
            "WebGPU is required for this quantized model. Enable hardware acceleration in Chrome or Edge. The scripted demo works without WebGPU.",
          );
        progress("Preparing WebGPU runtime…");
        const options = {
          progress_callback: (p: {
            status: string;
            file?: string;
            progress?: number;
          }) => {
            if (p.status === "progress")
              progress(
                `Downloading ${p.file || "model"} · ${Math.round(p.progress || 0)}%`,
              );
            else if (p.status === "done") {
              assetsReady = performance.now();
              progress("Preparing model weights…");
            }
          },
        };
        tokenizer = await AutoTokenizer.from_pretrained(repository, options);
        assetsReady = performance.now();
        model = await AutoModel.from_pretrained(repository, {
          ...options,
          dtype: "q4",
          device: "webgpu",
        });
      }
      const finished = performance.now();
      self.postMessage({
        id,
        result: {
          device,
          repository,
          timing: {
            totalMs: finished - started,
            assetMs: assetsReady - started,
            prepareMs: finished - assetsReady,
            reused,
          },
        },
      });
      return;
    }
    if (!model || !tokenizer)
      throw new Error("Load Open-Jev in this browser first.");
    const options = data.options!;
    const encode = (text: string) =>
      Array.from(
        tokenizer!(text, { add_special_tokens: false }).input_ids.data,
        Number,
      );
    const marker = (text: string) => {
      const ids = encode(text);
      if (ids.length !== 1) throw new Error(`Invalid tokenizer marker ${text}`);
      return ids[0];
    };
    const tokens = [
      marker("[CLS]"),
      marker("[STATE]"),
      ...encode(data.state!).slice(0, 256),
    ];
    const segments = tokens.map(() => -1);
    const question = encode(
      "Which action should the robot take next to complete the task?",
    );
    const n = options.length;
    tokens.push(marker("[Q]"), ...question);
    segments.push(-1, ...question.map(() => n));
    for (let i = 0; i < n; i++) {
      const text = encode(options[i]);
      tokens.push(marker("[OPT]"), ...text);
      segments.push(-1, ...text.map(() => i));
    }
    tokens.push(marker("[SEP]"));
    segments.push(-1);
    if (tokens.length > 512)
      throw new Error("Input exceeds the model’s 512-token context.");
    const int64 = (v: number[], dims: number[]) =>
      new Tensor("int64", BigInt64Array.from(v, BigInt), dims);
    const output = await model({
      input_ids: int64(tokens, [1, tokens.length]),
      attention_mask: int64(
        tokens.map(() => 1),
        [1, tokens.length],
      ),
      seg: int64(segments, [1, segments.length]),
      pair_q: int64(
        options.map(() => n),
        [1, n],
      ),
      pair_opt: int64(
        options.map((_, i) => i),
        [1, n],
      ),
    });
    const logits = Array.from(output.logits.to("float32").data, Number);
    if (logits.length !== n || logits.some((x) => !Number.isFinite(x)))
      throw new Error("The model returned invalid logits.");
    const maximum = Math.max(...logits),
      exps = logits.map((x) => Math.exp((x - maximum) / 1.05)),
      total = exps.reduce((a, b) => a + b, 0);
    self.postMessage({
      id,
      result: { scores: exps.map((x) => x / total), device, repository },
    });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
self.onmessage = (event) => {
  queue = queue.then(() => processRequest(event.data));
};
