import { useEffect, useRef, useState } from "react";
import Scene from "./Scene";
import {
  actions,
  actionText,
  premise,
  type Decision,
  type RunRecord,
  type Task,
  type World,
} from "./simulation";
import { decide, type Mode } from "./inference";

export type LoadTiming = {
  totalMs: number;
  assetMs: number;
  prepareMs: number;
  reused: boolean;
};
export function saveJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function summarize(samples: number[]) {
  if (!samples.length) return { median: 0, p95: 0 };
  const sorted = [...samples].sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2);
  return {
    median:
      sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
  };
}
export function Timeline({
  decisions,
  label = "Current episode",
}: {
  decisions: Decision[];
  label?: string;
}) {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [open, setOpen] = useState(false);
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [label]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setIndex((i) => {
          if (i >= decisions.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      1200,
    );
    return () => clearInterval(timer);
  }, [playing, decisions.length]);
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, decisions.length - 1)));
    if (!decisions.length) setPlaying(false);
  }, [decisions.length]);
  const current = decisions[Math.min(index, Math.max(0, decisions.length - 1))];
  return (
    <section className="panel research-panel" aria-label="Decision timeline">
      <div className="tool-heading">
        <h2>Decision timeline</h2>
        <span>
          {label} · {decisions.length} decisions
        </span>
      </div>
      {!decisions.length ? (
        <p>
          Run a step to record the observation, scene state, scores and timing.
        </p>
      ) : (
        <>
          <div className="tool-actions">
            <button
              className="button light"
              onClick={() => {
                setOpen(!open);
                setPlaying(false);
              }}
            >
              {open ? "Hide replay" : "Inspect timeline"}
            </button>
            <button
              className="button light"
              onClick={() =>
                saveJson("decision-trace", {
                  schema: "robotics-playground/trace-v2",
                  decisions,
                })
              }
            >
              Export trace
            </button>
          </div>
          {open && (
            <>
              <div className="timeline-steps">
                {decisions.map((d, i) => (
                  <button
                    key={i}
                    className={index === i ? "selected" : ""}
                    aria-label={`Inspect decision ${i + 1}`}
                    aria-pressed={index === i}
                    onClick={() => {
                      setIndex(i);
                      setPlaying(false);
                    }}
                  >
                    {i + 1}. {d.action}
                  </button>
                ))}
              </div>
              <div className="tool-actions">
                <button
                  className="button light"
                  onClick={() => {
                    if (index >= decisions.length - 1) setIndex(0);
                    setPlaying(!playing);
                  }}
                >
                  {playing ? "Pause replay" : "Play replay"}
                </button>
                <span>
                  State before decision {Math.min(index + 1, decisions.length)}{" "}
                  · {current.latency.toFixed(1)} ms · {current.source}
                </span>
              </div>
              <div className="replay-grid">
                {current.world && current.task ? (
                  <div className="replay-scene">
                    <Scene
                      preview
                      world={current.world}
                      task={current.task}
                      cameraView="Orbit"
                      resetCamera={0}
                      onMotionComplete={() => {}}
                      onSettled={() => {}}
                    />
                  </div>
                ) : (
                  <p>This older run has no saved scene state.</p>
                )}
                <div>
                  <h3>Model text input</h3>
                  <p className="observation-text">
                    {current.observation || "Not recorded in this older run."}
                  </p>
                  {current.world?.changes?.length ? (
                    <p>Edits: {current.world.changes.join(" · ")}</p>
                  ) : null}
                  <ul className="trace-scores">
                    {actions.map((a, i) => (
                      <li key={a}>
                        <span>
                          {a === current.action ? "✓ " : ""}
                          {actionText[a]}
                        </span>
                        <strong>{(current.scores[i] * 100).toFixed(1)}%</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p>
                Replay reconstructs saved decision states; it does not rerun
                inference or simulate a continuous trajectory. Camera images are
                not model inputs.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

export function EnvironmentEditor({
  world,
  disabled,
  onEdit,
}: {
  world: World;
  disabled: boolean;
  onEdit: (kind: "object" | "target" | "obstacle") => void;
}) {
  return (
    <section className="panel research-panel" aria-label="Change environment">
      <div className="tool-heading">
        <h2>Change environment</h2>
        <span>Edits pause the episode</span>
      </div>
      <p>
        Move the cube or destination, or toggle a physical obstacle. Resume to
        evaluate the updated text observation. Edits are available between
        motions.
      </p>
      <div className="tool-actions">
        <button
          className="button light"
          disabled={disabled || world.holding}
          onClick={() => onEdit("object")}
        >
          Move object
        </button>
        <button
          className="button light"
          disabled={disabled}
          onClick={() => onEdit("target")}
        >
          Move destination
        </button>
        <button
          className="button light"
          disabled={disabled}
          onClick={() => onEdit("obstacle")}
        >
          {world.obstacle ? "Remove obstacle" : "Add obstacle"}
        </button>
      </div>
      {world.blocked && <p role="status">{world.blocked}</p>}
      {!!world.changes?.length && (
        <p>{world.changes[world.changes.length - 1]}</p>
      )}
      <p>
        The five staged actions have no obstacle-avoidance route. Blocked
        transfers stop safely; change the layout to continue.
      </p>
    </section>
  );
}

export function ComparisonPanel({
  history,
  active,
  status,
  disabled,
  modelReady,
  model,
  onModel,
  onStart,
  onCancel,
}: {
  history: RunRecord[];
  active: boolean;
  status: string;
  disabled: boolean;
  modelReady: boolean;
  model: Mode;
  onModel: (mode: Mode) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  const ids = [
    ...new Set(
      history.filter((h) => h.comparisonId).map((h) => h.comparisonId!),
    ),
  ].slice(0, 5);
  return (
    <section className="panel research-panel" aria-label="A/B comparison">
      <div className="tool-heading">
        <h2>A/B comparison</h2>
        <span>Same task, seed and starting layout</span>
      </div>
      <p>
        Run the scripted baseline, then the selected model from an identical
        initial state. Uses the current object home position, destination and
        obstacle. No layout edits during comparison.
      </p>
      <div className="tool-actions">
        <label>
          Model{" "}
          <select
            aria-label="Comparison model"
            value={model}
            disabled={active || disabled}
            onChange={(e) => onModel(e.target.value as Mode)}
          >
            <option value="browser">Open-Jev · browser</option>
            <option value="openjev">OpenJEV · local bridge</option>
          </select>
        </label>
        <button
          className="button primary"
          disabled={disabled || active || !modelReady}
          onClick={onStart}
        >
          Run A/B comparison
        </button>
        {active && (
          <button className="button light" onClick={onCancel}>
            Cancel comparison
          </button>
        )}
      </div>
      {!modelReady && (
        <p>
          Load the browser model or connect the selected bridge in Model runtime
          first.
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {!!ids.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pair / seed</th>
                <th>Policy</th>
                <th>Result</th>
                <th>Actions</th>
                <th>Median / p95</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ids.flatMap((id) =>
                (["baseline", "model"] as const).map((role) => {
                  const h = history.find(
                    (r) => r.comparisonId === id && r.comparisonRole === role,
                  );
                  const stats = summarize(
                    h?.decisions.map((d) => d.latency) || [],
                  );
                  return (
                    <tr key={id + role}>
                      <td>
                        {id.slice(0, 8)} / {h?.seed ?? "—"}
                      </td>
                      <td>{h?.mode || role}</td>
                      <td>
                        {h
                          ? h.success
                            ? "Completed"
                            : "Timed out"
                          : "No completed run"}
                      </td>
                      <td>{h?.decisions.length ?? "—"}</td>
                      <td>
                        {h
                          ? `${stats.median.toFixed(1)} / ${stats.p95.toFixed(1)} ms`
                          : "—"}
                      </td>
                      <td>
                        {role === "baseline" && (
                          <button
                            className="button light"
                            onClick={() =>
                              saveJson("comparison", {
                                schema: "robotics-playground/comparison-v2",
                                records: history.filter(
                                  (r) => r.comparisonId === id,
                                ),
                              })
                            }
                          >
                            Export pair
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}
      <p>
        The baseline is a hand-coded policy, not a VLA. These are staged
        simulation results, not official LIBERO scores. Timing includes
        first-use overhead when present; use the speed test for warm
        measurements.
      </p>
    </section>
  );
}

type SpeedResult = {
  date: string;
  mode: Mode;
  source: string;
  observation: string;
  task: Task;
  world: World;
  warmupMs: number[];
  samplesMs: number[];
  median: number;
  p95: number;
  loadTiming: LoadTiming | null;
  device: Record<string, unknown>;
};
export function SpeedPanel({
  mode,
  world,
  task,
  endpoint,
  disabled,
  loadTiming,
  onBusy,
}: {
  mode: Mode;
  world: World;
  task: Task;
  endpoint: string;
  disabled: boolean;
  loadTiming: LoadTiming | null;
  onBusy: (busy: boolean) => void;
}) {
  const [count, setCount] = useState("10"),
    [active, setActive] = useState(false),
    [progress, setProgress] = useState(""),
    [result, setResult] = useState<SpeedResult | null>(null),
    [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
      onBusy(false);
    };
  }, [onBusy]);
  async function run() {
    const controller = new AbortController();
    abort.current = controller;
    setActive(true);
    onBusy(true);
    setError("");
    setResult(null);
    const snapshot = structuredClone(world),
      taskSnapshot = structuredClone(task),
      warmupMs: number[] = [],
      samplesMs: number[] = [];
    try {
      let source = "";
      for (let i = 0; i < Number(count) + 2; i++) {
        if (controller.signal.aborted)
          throw new DOMException("Cancelled", "AbortError");
        setProgress(
          i < 2 ? `Warm-up ${i + 1}/2` : `Measuring ${i - 1}/${count}`,
        );
        const d = await decide(
          mode,
          snapshot,
          taskSnapshot,
          endpoint,
          controller.signal,
        );
        source = d.source;
        if (i < 2) warmupMs.push(d.latency);
        else samplesMs.push(d.latency);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (!controller.signal.aborted && mounted.current) {
        setResult({
          date: new Date().toISOString(),
          mode,
          source,
          observation: premise(snapshot, taskSnapshot),
          task: taskSnapshot,
          world: snapshot,
          warmupMs,
          samplesMs,
          ...summarize(samplesMs),
          loadTiming: mode === "browser" ? loadTiming : null,
          device: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            logicalCores: navigator.hardwareConcurrency,
            deviceMemoryGB:
              (navigator as Navigator & { deviceMemory?: number })
                .deviceMemory ?? null,
            webgpuExposed: !!(navigator as Navigator & { gpu?: unknown }).gpu,
          },
        });
        setProgress("Measurement complete.");
      }
    } catch (e) {
      if (mounted.current) {
        setError(
          controller.signal.aborted
            ? "Measurement cancelled; partial results discarded."
            : String(e),
        );
        setProgress("");
      }
    } finally {
      if (mounted.current) {
        setActive(false);
        onBusy(false);
      }
    }
  }
  return (
    <section className="panel research-panel" aria-label="Speed measurement">
      <div className="tool-heading">
        <h2>Speed measurement</h2>
        <span>Fixed observation · 2 warm-ups excluded</span>
      </div>
      <p>
        Measures end-to-end decision latency, including input processing and
        worker or bridge overhead. The robot does not move during this test.
      </p>
      <div className="tool-actions">
        <label>
          Samples{" "}
          <select
            aria-label="Speed samples"
            value={count}
            disabled={active}
            onChange={(e) => setCount(e.target.value)}
          >
            <option>5</option>
            <option>10</option>
            <option>20</option>
          </select>
        </label>
        <button
          className="button primary"
          disabled={disabled || active}
          onClick={() => void run()}
        >
          Measure decision speed
        </button>
        {active && (
          <button
            className="button light"
            onClick={() => abort.current?.abort()}
          >
            Cancel measurement
          </button>
        )}
      </div>
      {progress && <p role="status">{progress}</p>}
      {error && <p role="alert">{error}</p>}
      {loadTiming && (
        <p>
          Browser model setup: {(loadTiming.totalMs / 1000).toFixed(2)} s total
          · asset/tokenizer phase {(loadTiming.assetMs / 1000).toFixed(2)} s ·
          session preparation {(loadTiming.prepareMs / 1000).toFixed(2)} s.{" "}
          {loadTiming.reused
            ? "Already loaded session."
            : "Asset phase includes cache reads; it is not a network-only measurement."}
        </p>
      )}
      {result && (
        <div className="speed-result">
          <h3>{result.source}</h3>
          {result.mode === "demo" && (
            <p>Scripted policy timing only — no model inference.</p>
          )}
          <dl>
            <div>
              <dt>Median</dt>
              <dd>{result.median.toFixed(2)} ms</dd>
            </div>
            <div>
              <dt>p95</dt>
              <dd>{result.p95.toFixed(2)} ms</dd>
            </div>
            <div>
              <dt>Measured samples</dt>
              <dd>{result.samplesMs.length}</dd>
            </div>
          </dl>
          <p>
            Warm-ups: {result.warmupMs.map((n) => n.toFixed(2)).join(", ")} ms.
            p95 uses the nearest-rank method; small samples are exploratory.
          </p>
          <details>
            <summary>Samples, observation and device</summary>
            <p>{result.samplesMs.map((n) => n.toFixed(2)).join(", ")} ms</p>
            <p className="observation-text">{result.observation}</p>
            <pre>{JSON.stringify(result.device, null, 2)}</pre>
          </details>
          <button
            className="button light"
            onClick={() => saveJson("speed-measurement", result)}
          >
            Export speed results
          </button>
        </div>
      )}
    </section>
  );
}
