let worker: Worker | undefined;
let nextId = 0;
type Result = {
  device: string;
  repository: string;
  scores?: number[];
  timing?: {
    totalMs: number;
    assetMs: number;
    prepareMs: number;
    reused: boolean;
  };
};
const pending = new Map<
  number,
  {
    resolve: (r: Result) => void;
    reject: (e: Error) => void;
    progress?: (s: string) => void;
    cleanup: () => void;
  }
>();
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./decision.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      const request = pending.get(data.id);
      if (!request) return;
      if (data.progress) {
        request.progress?.(data.progress);
        return;
      }
      request.cleanup();
      pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.result);
    };
    worker.onerror = () => {
      cancelBrowserLoad(
        "Browser inference failed. Reload the model or try another browser.",
      );
    };
  }
  return worker;
}
function request(
  type: string,
  payload: object,
  progress?: (s: string) => void,
  signal?: AbortSignal,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = ++nextId;
    const abort = () => {
      pending.get(id)?.cleanup();
      pending.delete(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(
      () => {
        pending.get(id)?.cleanup();
        pending.delete(id);
        reject(
          new Error(
            type === "load"
              ? "Model download timed out. Check your connection and retry."
              : "Inference timed out. Try resetting the episode.",
          ),
        );
      },
      type === "load" ? 900000 : 180000,
    );
    pending.set(id, {
      resolve,
      reject,
      progress,
      cleanup: () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      },
    });
    signal?.addEventListener("abort", abort, { once: true });
    getWorker().postMessage({ id, type, ...payload });
  });
}
export function loadBrowser(progress: (s: string) => void) {
  return request("load", {}, progress);
}
export function scoreBrowser(
  state: string,
  options: string[],
  signal: AbortSignal,
) {
  return request("score", { state, options }, undefined, signal);
}
export function cancelBrowserLoad(message = "Model loading cancelled.") {
  worker?.terminate();
  worker = undefined;
  for (const p of pending.values()) {
    p.cleanup();
    p.reject(new Error(message));
  }
  pending.clear();
}
