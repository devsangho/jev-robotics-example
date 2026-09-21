import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  Code2,
  Cpu,
  Crosshair,
  ExternalLink,
  FlaskConical,
  Layers3,
  LoaderCircle,
  Maximize2,
  Monitor,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Terminal,
  Workflow,
  X,
} from "lucide-react";
import Scene from "./Scene";
import {
  actions,
  advance,
  initialWorld,
  tasks,
  type Decision,
  type RunRecord,
  type World,
} from "./simulation";
import { decide, loadBrowser, cancelBrowserLoad, type Mode } from "./inference";

function download(data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `robotics-playground-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function readHistory(): RunRecord[] {
  try {
    const h = JSON.parse(localStorage.getItem("jev-runs") || "[]");
    return Array.isArray(h)
      ? h
          .filter(
            (r) =>
              typeof r.id === "string" &&
              typeof r.task === "string" &&
              Array.isArray(r.decisions),
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
const modeNames: Record<Mode, string> = {
  demo: "Scripted demo",
  openjev: "OpenJEV · local",
  browser: "Open-Jev DeBERTa · browser",
};
export default function App() {
  const [tab, setTab] = useState("Playground"),
    [taskId, setTaskId] = useState(tasks[0].id),
    [mode, setMode] = useState<Mode>("demo");
  const [seed, setSeed] = useState(42),
    [world, setWorld] = useState<World>(() => initialWorld(42)),
    [running, setRunning] = useState(false),
    [sceneReady, setSceneReady] = useState(false),
    [busy, setBusy] = useState(false),
    [decision, setDecision] = useState<Decision | null>(null),
    [decisions, setDecisions] = useState<Decision[]>([]);
  const [history, setHistory] = useState<RunRecord[]>(readHistory),
    [modal, setModal] = useState<"runtime" | "docs" | null>(null),
    [endpoint, setEndpoint] = useState("http://127.0.0.1:8000"),
    [connection, setConnection] = useState("Not connected"),
    [loading, setLoading] = useState(false),
    [browserReady, setBrowserReady] = useState(false),
    [browserDevice, setBrowserDevice] = useState(""),
    [progress, setProgress] = useState(""),
    [error, setError] = useState("");
  const [view, setView] = useState("Orbit"),
    [cameraReset, setCameraReset] = useState(0),
    [speed, setSpeed] = useState("1"),
    [frame, setFrame] = useState(""),
    [showScores, setShowScores] = useState(true),
    [batchRemaining, setBatchRemaining] = useState(0),
    [batchSize, setBatchSize] = useState("5"),
    [gpu, setGpu] = useState(false);
  const task = tasks.find((t) => t.id === taskId)!;
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const stepLock = useRef(false);
  const saved = useRef(false);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const gpu = (
      navigator as Navigator & {
        gpu?: { requestAdapter: () => Promise<unknown> };
      }
    ).gpu;
    gpu
      ?.requestAdapter()
      .then((a) => setGpu(!!a))
      .catch(() => setGpu(false));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("jev-runs", JSON.stringify(history));
    } catch {
      /* private mode storage is optional */
    }
  }, [history]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input, select",
        ) || [],
      );
    focusable()[0]?.focus();
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const elements = focusable();
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      previous?.focus();
    };
  }, [modal]);
  function reset(nextSeed = seed) {
    generation.current++;
    controller.current?.abort();
    setRunning(false);
    setBusy(false);
    stepLock.current = false;
    setSceneReady(false);
    setWorld(initialWorld(nextSeed));
    setDecision(null);
    setDecisions([]);
    setError("");
    saved.current = false;
    setBatchRemaining(0);
  }
  function switchTask(id: string) {
    reset();
    setTaskId(id);
  }
  async function step() {
    if (
      stepLock.current ||
      world.success ||
      world.step >= 20 ||
      !sceneReady ||
      world.settling
    )
      return;
    stepLock.current = true;
    setBusy(true);
    const g = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    try {
      const d = await decide(mode, world, task, endpoint, abort.signal);
      if (g !== generation.current) return;
      setSceneReady(false);
      setDecision(d);
      setDecisions((ds) => [...ds, d]);
      setWorld((w) => advance(w, d.action, task));
    } catch (e) {
      if (g === generation.current) {
        setError(e instanceof Error ? e.message : String(e));
        setRunning(false);
        setBatchRemaining(0);
      }
    } finally {
      if (g === generation.current) {
        stepLock.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    if (
      !running ||
      busy ||
      world.success ||
      world.step >= 20 ||
      !sceneReady ||
      world.settling
    )
      return;
    const timer = setTimeout(() => void step(), 950 / Number(speed));
    return () => clearTimeout(timer);
  }, [running, busy, world, mode, taskId, speed, sceneReady]);
  useEffect(() => {
    if ((world.success || world.step >= 20) && !saved.current) {
      saved.current = true;
      setRunning(false);
      const record: RunRecord = {
        id: crypto.randomUUID(),
        task: task.title,
        mode: modeNames[mode],
        seed: world.seed,
        success: world.success,
        steps: world.step,
        latency:
          decisions.reduce((a, d) => a + d.latency, 0) /
          Math.max(decisions.length, 1),
        date: new Date().toISOString(),
        decisions,
      };
      setHistory((h) => [record, ...h].slice(0, 50));
    }
  }, [world.success, world.step, batchRemaining]);
  useEffect(() => {
    if (!world.success && world.step < 20) return;
    if (batchRemaining <= 1) {
      setBatchRemaining(0);
      return;
    }
    const timer = setTimeout(() => {
      const next = seed + 1;
      reset(next);
      setSeed(next);
      setBatchRemaining(batchRemaining - 1);
      setRunning(true);
    }, 900);
    return () => clearTimeout(timer);
  }, [world.success, world.step, batchRemaining]);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  async function connect() {
    setLoading(true);
    setConnection("Connecting…");
    try {
      const r = await fetch(`${endpoint.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data.service !== "robotics-playground")
        throw new Error("This is not a Playground bridge");
      if (!data.ready) throw new Error("OpenJEV model is not loaded");
      setConnection(`Connected · ${data.device}`);
      reset();
      setMode("openjev");
    } catch (e) {
      setConnection(
        `Connection failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setLoading(false);
    }
  }
  async function load(startEpisode = false) {
    setLoading(true);
    setError("");
    setProgress("Preparing browser runtime…");
    try {
      const runtime = await loadBrowser(setProgress);
      setBrowserDevice(runtime.device);
      setBrowserReady(true);
      reset();
      setMode("browser");
      if (startEpisode) setRunning(true);
      setProgress("Ready. Inference runs on this device.");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setProgress(message);
      if (!message.includes("cancelled")) setError(message);
    } finally {
      setLoading(false);
    }
  }
  const completed = history.length,
    successes = history.filter((h) => h.success).length;
  const exportAll = () =>
    download({
      schema: "robotics-playground/v1",
      environment: "rapier-threejs-playground",
      officialLibero: false,
      records: history,
    });
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="nav-label">DEMO</div>
        <nav>
          {[
            { name: "Playground", icon: Box },
            { name: "Experiments", icon: FlaskConical },
            { name: "Benchmarks", icon: Layers3 },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={tab === name ? "nav-item selected" : "nav-item"}
              onClick={() => {
                setRunning(false);
                setBatchRemaining(0);
                setTab(name);
              }}
            >
              <Icon size={18} />
              {name}
              {name === "Experiments" && (
                <span className="nav-count">{completed}</span>
              )}
              {name === "Playground" && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="nav-label second">RESOURCES</div>
        <button className="nav-item" onClick={() => setModal("runtime")}>
          <Cpu size={18} />
          Model runtime
        </button>
        <button className="nav-item" onClick={() => setModal("docs")}>
          <Code2 size={18} />
          Documentation
          <ArrowUpRight size={14} className="push" />
        </button>
        <a
          className="nav-item"
          href="https://huggingface.co/onnx-community/open-jev-deberta-v3-large-ONNX"
          target="_blank"
          rel="noreferrer"
        >
          <Workflow size={18} />
          Browser model
          <ArrowUpRight size={14} className="push" />
        </a>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Robotics demo <ChevronRight size={13} /> <span>{tab}</span>
          </div>
          <div className="topbar-right">
            <a
              href="https://github.com/devsangho/jev-robotics-example"
              target="_blank"
              rel="noreferrer"
            >
              View source <ArrowUpRight size={13} />
            </a>
            <button
              className="help-button"
              onClick={() => setModal("docs")}
              aria-label="Help"
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>
                {tab === "Playground"
                  ? "Robotics playground"
                  : tab === "Experiments"
                    ? "Run history"
                    : "Evaluate across seeds"}
              </h1>
              <p>
                {tab === "Playground"
                  ? "Choose a task, run the robot, and compare action scores and decision latency."
                  : tab === "Experiments"
                    ? "Inspect and export the episodes you have run on this device."
                    : "Repeat tasks across seeds and inspect local evaluation results."}
              </p>
            </div>
            <button className="button light" onClick={() => setModal("docs")}>
              <Code2 size={15} /> Quick start <ArrowUpRight size={14} />
            </button>
          </div>
          {tab === "Playground" ? (
            <>
              <section
                className="browser-onboarding"
                aria-label="Run locally in your browser"
              >
                <div>
                  <strong>Run Open-Jev in your browser</strong>
                  <p>
                    Open-Jev DeBERTa · 480 MB download · WebGPU required.
                    Evaluate actions in one forward pass, without a local
                    server.
                  </p>
                  {progress && (
                    <p className="browser-progress" role="status">
                      {progress}
                    </p>
                  )}
                </div>
                {loading ? (
                  <button
                    className="button light"
                    onClick={() => cancelBrowserLoad()}
                  >
                    Cancel download
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={running || busy || !gpu}
                    onClick={() => {
                      if (browserReady) {
                        reset();
                        setMode("browser");
                        setRunning(true);
                      } else void load(true);
                    }}
                  >
                    {browserReady ? (
                      <Play size={14} />
                    ) : (
                      <ArrowDownToLine size={14} />
                    )}{" "}
                    {browserReady
                      ? "Run with Open-Jev"
                      : gpu
                        ? "Load Open-Jev · 480 MB"
                        : "WebGPU required"}
                  </button>
                )}
              </section>
              <div className="config-strip">
                <div className="config-item">
                  <span className="field-icon">
                    <Layers3 size={18} />
                  </span>
                  <label>
                    ENVIRONMENT
                    <select
                      aria-label="Environment task"
                      value={taskId}
                      onChange={(e) => switchTask(e.target.value)}
                      disabled={running || busy}
                    >
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          LIBERO-style · {t.suite}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="config-item">
                  <span className="field-icon">
                    <Workflow size={18} />
                  </span>
                  <label>
                    POLICY
                    <select
                      aria-label="Policy"
                      value={mode}
                      onChange={(e) => {
                        if (
                          (e.target.value === "openjev" &&
                            !connection.startsWith("Connected")) ||
                          (e.target.value === "browser" && !browserReady)
                        ) {
                          setModal("runtime");
                          return;
                        }
                        reset();
                        setMode(e.target.value as Mode);
                      }}
                      disabled={running || busy}
                    >
                      <option value="demo">Scripted candidate policy</option>
                      <option value="openjev">OpenJEV · Qwen 4B</option>
                      <option value="browser">
                        Open-Jev DeBERTa · Browser
                      </option>
                    </select>
                  </label>
                </div>
                <div className="config-item engine">
                  <span className="field-icon">
                    <Cpu size={18} />
                  </span>
                  <div>
                    <label>RUNTIME</label>
                    <span>
                      {mode === "demo"
                        ? "Browser · Three.js"
                        : mode === "openjev"
                          ? "Local Python bridge"
                          : "Browser · WebGPU"}{" "}
                      <i className="small-dot" />
                    </span>
                  </div>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setModal("runtime")}
                  aria-label="Configure runtime"
                >
                  <SlidersHorizontal size={18} />
                </button>
              </div>
              <div className="playground-grid">
                <section className="simulation-panel panel">
                  <div className="panel-heading">
                    <div className="panel-title">
                      <span className="live-dot" />
                      Simulation <span className="tag">LIVE VIEW</span>
                    </div>
                    <div className="heading-actions">
                      <span className="subtle">
                        {running ? "Episode running" : "Interactive scene"}
                      </span>
                      <button
                        className="icon-button"
                        aria-label="Fullscreen simulation"
                        onClick={() => {
                          if (document.fullscreenElement)
                            void document.exitFullscreen();
                          else
                            void viewport.current
                              ?.requestFullscreen()
                              .catch(() =>
                                setError(
                                  "Fullscreen is not available in this browser.",
                                ),
                              );
                        }}
                      >
                        <Maximize2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="viewport" ref={viewport}>
                    <Scene
                      world={world}
                      task={task}
                      cameraView={view}
                      resetCamera={cameraReset}
                      onFrame={setFrame}
                      onMotionComplete={(position) => {
                        setSceneReady(true);
                        setWorld((w) => ({ ...w, object: position }));
                      }}
                      onSettled={(success, position) => {
                        setWorld((w) => ({
                          ...w,
                          object: position,
                          settling: false,
                          success,
                          step: success ? w.step : 20,
                        }));
                        setSceneReady(true);
                      }}
                    />
                    <div className="scene-top">
                      <span className="scene-label">
                        <span className="small-dot" /> {task.title}{" "}
                        <span>/</span> {task.id}
                      </span>
                      <span className="scene-label mono">SEED {seed}</span>
                    </div>
                    <div className="scene-note">
                      <span className="scene-status">
                        {world.success ? (
                          <>
                            <Check size={12} /> TASK COMPLETE
                          </>
                        ) : (
                          <>
                            <span className="small-dot" />{" "}
                            {world.settling
                              ? "RELEASING & SETTLING"
                              : world.holding
                                ? "GRIPPER CLOSED"
                                : running
                                  ? "EXECUTING"
                                  : "READY TO EXPLORE"}
                          </>
                        )}
                      </span>
                      <div>
                        Rapier physics <span>•</span> Franka-inspired arm
                      </div>
                    </div>
                    <div className="camera-tools">
                      <div className="segmented">
                        {["Orbit", "Top", "Front"].map((v) => (
                          <button
                            key={v}
                            className={view === v ? "active" : ""}
                            onClick={() => setView(v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <button
                        className="camera-reset"
                        aria-label="Reset camera"
                        onClick={() => setCameraReset((n) => n + 1)}
                      >
                        <Crosshair size={16} />
                      </button>
                    </div>
                    <div className="axis">
                      <span className="axis-y">Y</span>
                      <span className="axis-z">Z</span>
                      <span className="axis-x">X</span>
                      <i />
                    </div>
                  </div>
                  <div className="instruction">
                    <span className="instruction-icon">
                      <Terminal size={17} />
                    </span>
                    <div>
                      <label>LANGUAGE INSTRUCTION</label>
                      <p>{task.instruction}</p>
                    </div>
                    <span className="tag">{task.suite.toUpperCase()}</span>
                  </div>
                  <div className="transport">
                    <div className="transport-left">
                      <button
                        className="button primary"
                        disabled={
                          (busy && !running) ||
                          world.success ||
                          world.step >= 20
                        }
                        onClick={() => setRunning((v) => !v)}
                      >
                        {running ? (
                          <Pause size={15} />
                        ) : (
                          <Play size={15} fill="currentColor" />
                        )}
                        {running ? "Pause episode" : "Run episode"}
                      </button>
                      <button
                        className="icon-button bordered"
                        aria-label="Step once"
                        title="Step once"
                        disabled={
                          running ||
                          busy ||
                          !sceneReady ||
                          world.settling ||
                          world.success ||
                          world.step >= 20
                        }
                        onClick={() => void step()}
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={16} />
                        ) : (
                          <ChevronRight size={19} />
                        )}
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Reset episode"
                        onClick={() => reset()}
                      >
                        <RotateCcw size={16} />
                      </button>
                      <span className="transport-divider" />
                      <label className="speed-label">
                        <select
                          aria-label="Playback speed"
                          value={speed}
                          onChange={(e) => setSpeed(e.target.value)}
                        >
                          <option value="0.5">0.5×</option>
                          <option value="1">1×</option>
                          <option value="2">2×</option>
                        </select>{" "}
                        speed
                      </label>
                    </div>
                    <span className="step-count">
                      STEP{" "}
                      <strong>{String(world.step).padStart(3, "0")}</strong>
                      <span>/ 020</span>
                    </span>
                  </div>
                </section>
                <aside className="decision-panel panel">
                  <div className="panel-heading">
                    <div className="panel-title">
                      <span className="orange-symbol">
                        <Workflow size={17} />
                      </span>
                      Decision engine
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Decision engine settings"
                      onClick={() => setModal("runtime")}
                    >
                      <MoreHorizontal size={19} />
                    </button>
                  </div>
                  <div className="decision-content">
                    <div className="model-title">
                      <span className="model-icon">
                        <Cpu size={20} />
                      </span>
                      <div>
                        <strong>
                          {mode === "demo"
                            ? "Scripted preview"
                            : mode === "openjev"
                              ? "OpenJEV · Qwen 4B"
                              : "Open-Jev · DeBERTa"}
                          <span className="tag orange">
                            {mode === "demo"
                              ? "DEMO"
                              : mode === "openjev"
                                ? "LOCAL"
                                : "ON-DEVICE"}
                          </span>
                        </strong>
                        <p>
                          {mode === "demo"
                            ? "Scripted scores · no model loaded"
                            : mode === "openjev"
                              ? "NLI candidate action scoring"
                              : "Typed decisions · no text generation"}
                        </p>
                      </div>
                    </div>
                    <div className="pipeline">
                      <span>Observe</span>
                      <ChevronRight size={12} />
                      <span className="pipeline-active">Evaluate</span>
                      <ChevronRight size={12} />
                      <span>Act</span>
                    </div>
                    <div className="section-label">
                      OBSERVATION <span>SCENE CAMERA</span>
                    </div>
                    <div className="observation">
                      {frame ? (
                        <img
                          src={frame}
                          alt="Current rendered simulation observation"
                        />
                      ) : (
                        <Box size={30} />
                      )}
                      <span className="camera-caption">scene_view</span>
                      <span className="camera-live">
                        <i /> LIVE
                      </span>
                    </div>
                    <div className="section-label score-heading">
                      CANDIDATE ACTIONS
                      <button
                        className="text-button"
                        onClick={() => setShowScores((v) => !v)}
                      >
                        {showScores ? "Hide scores" : "Show scores"}
                      </button>
                    </div>
                    <div className="candidates">
                      {actions.map((a, i) => {
                        const score = decision?.scores[i];
                        return (
                          <div
                            className={`candidate ${decision?.action === a ? "chosen" : ""}`}
                            key={a}
                          >
                            <div className="candidate-line">
                              <span className="candidate-number">0{i + 1}</span>
                              <span>
                                {a.charAt(0).toUpperCase() + a.slice(1)}{" "}
                                {a === "approach"
                                  ? "object"
                                  : a === "transfer"
                                    ? "to target"
                                    : a === "release"
                                      ? "object"
                                      : ""}
                              </span>
                              {showScores && (
                                <strong>
                                  {score === undefined
                                    ? "—"
                                    : `${(score * 100).toFixed(1)}%`}
                                </strong>
                              )}
                              {decision?.action === a && <Check size={12} />}
                            </div>
                            {showScores && (
                              <div className="score-track">
                                <i
                                  style={{ width: `${(score || 0) * 100}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="decision-foot">
                      <span>
                        <Activity size={13} />{" "}
                        {mode === "browser"
                          ? "Option probability"
                          : "Candidate score"}
                      </span>
                      <strong>
                        {decision
                          ? `${decision.latency.toFixed(1)} ms`
                          : "Awaiting first step"}
                      </strong>
                    </div>
                  </div>
                </aside>
              </div>
              {error && (
                <div className="error-banner" role="alert">
                  {error}
                  <button
                    aria-label="Dismiss error"
                    onClick={() => setError("")}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <div className="bottom-grid">
                <section className="telemetry panel">
                  <div className="panel-heading">
                    <div className="panel-title">
                      <Activity size={16} />
                      Episode overview
                    </div>
                    <span className="subtle">{modeNames[mode]}</span>
                  </div>
                  <div className="metric-grid">
                    <div className="metric">
                      <label>
                        {mode === "demo"
                          ? "Scripted latency"
                          : "Decision latency"}
                      </label>
                      <strong>
                        {decision ? decision.latency.toFixed(1) : "—"}
                        <small>ms</small>
                      </strong>
                      <span className="metric-caption">
                        Measured on this device
                      </span>
                    </div>
                    <div className="metric">
                      <label>Task progress</label>
                      <strong>
                        {world.phase}
                        <small>/ 5 stages</small>
                      </strong>
                      <div className="mini-progress">
                        {actions.map((a, i) => (
                          <i
                            key={a}
                            className={i < world.phase ? "done" : ""}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="metric">
                      <label>Episode status</label>
                      <strong className="status-value">
                        {world.success
                          ? "Complete"
                          : world.step >= 20
                            ? "Timed out"
                            : running
                              ? "Running"
                              : world.step
                                ? "Paused"
                                : "Ready"}
                        <span
                          className={
                            world.success ? "status-dot success" : "status-dot"
                          }
                        />
                      </strong>
                      <span className="metric-caption">
                        {world.success
                          ? "Object reached its destination"
                          : `${20 - world.step} steps remaining`}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
              <div className="honesty-note">
                <p>
                  LIBERO-inspired scene · {modeNames[mode]} · not an official
                  LIBERO evaluation.
                </p>
                <button onClick={() => setModal("docs")}>
                  How it works <ArrowUpRight size={12} />
                </button>
              </div>
            </>
          ) : tab === "Experiments" ? (
            <section className="panel records-panel">
              <div className="panel-heading">
                <div className="panel-title">
                  Episode history{" "}
                  <span className="tag">{history.length} RUNS</span>
                </div>
                <button
                  className="button light small"
                  disabled={!history.length}
                  onClick={exportAll}
                >
                  <ArrowDownToLine size={14} />
                  Export JSON
                </button>
              </div>
              {history.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Task / environment</th>
                        <th>Policy</th>
                        <th>Seed</th>
                        <th>Result</th>
                        <th>Steps</th>
                        <th>Mean latency</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td>
                            <strong>{h.task}</strong>
                            <small>{new Date(h.date).toLocaleString()}</small>
                          </td>
                          <td>{h.mode}</td>
                          <td className="mono">{h.seed}</td>
                          <td>
                            <span
                              className={`result-tag ${h.success ? "ok" : ""}`}
                            >
                              {h.success ? "Completed" : "Timed out"}
                            </span>
                          </td>
                          <td>{h.steps}</td>
                          <td>{h.latency.toFixed(1)} ms</td>
                          <td>
                            <button
                              className="icon-button"
                              aria-label={`Export run ${h.id}`}
                              onClick={() =>
                                download({
                                  environment: "rapier-threejs-playground",
                                  officialLibero: false,
                                  ...h,
                                })
                              }
                            >
                              <ArrowDownToLine size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <FlaskConical size={38} />
                  <h2>Your first experiment starts here.</h2>
                  <p>
                    Complete an episode to save its actions, scores, and timing.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setTab("Playground")}
                  >
                    Open playground <ArrowRight size={15} />
                  </button>
                </div>
              )}
              <p className="table-note">
                Stored in this browser. Demo completions are not model benchmark
                results.
              </p>
            </section>
          ) : (
            <>
              <div className="benchmark-summary">
                <div className="panel">
                  <label>RECORDED EPISODES</label>
                  <strong>{completed}</strong>
                </div>
                <div className="panel">
                  <label>DEMO COMPLETIONS · ALL MODES</label>
                  <strong>
                    {completed
                      ? `${Math.round((successes / completed) * 100)}%`
                      : "—"}
                  </strong>
                </div>
                <div className="panel">
                  <label>AVAILABLE TASK FAMILIES</label>
                  <strong>03</strong>
                </div>
              </div>
              <div className="benchmark-grid">
                {tasks.map((t, i) => (
                  <button
                    className={`benchmark-card panel ${taskId === t.id ? "is-selected" : ""}`}
                    key={t.id}
                    onClick={() => switchTask(t.id)}
                    disabled={running || busy}
                  >
                    <div className={`task-illustration task-${i}`}>
                      <span className="illustration-cube" />
                      <span className="illustration-target" />
                      <span className="illustration-line" />
                    </div>
                    <div className="benchmark-card-body">
                      <span className="eyebrow">
                        0{i + 1} / {t.suite.toUpperCase()}
                      </span>
                      <h2>
                        {t.title}
                        <ArrowUpRight size={18} />
                      </h2>
                      <p>{t.instruction}</p>
                      <span className="tag">LIBERO-INSPIRED</span>
                    </div>
                  </button>
                ))}
              </div>
              <section className="panel batch-panel">
                <div>
                  <h3>Run a local evaluation</h3>
                  <p>
                    Repeat <strong>{task.title}</strong> across consecutive
                    seeds with {modeNames[mode].toLowerCase()}.
                  </p>
                </div>
                <label>
                  Starting seed
                  <input
                    aria-label="Starting seed"
                    type="number"
                    min="0"
                    max="999999"
                    value={seed}
                    disabled={running || busy}
                    onChange={(e) => {
                      const n = Math.max(
                        0,
                        Math.min(999999, Number(e.target.value) || 0),
                      );
                      setSeed(n);
                      reset(n);
                    }}
                  />
                </label>
                <label>
                  Episodes
                  <select
                    aria-label="Number of episodes"
                    value={batchSize}
                    onChange={(e) => setBatchSize(e.target.value)}
                    disabled={running || busy}
                  >
                    <option>5</option>
                    <option>10</option>
                    <option>20</option>
                  </select>
                </label>
                <button
                  className="button primary"
                  disabled={running || busy}
                  onClick={() => {
                    reset();
                    setBatchRemaining(Number(batchSize));
                    setRunning(true);
                    setTab("Playground");
                  }}
                >
                  <Play size={14} /> Run evaluation
                </button>
              </section>
              <div className="benchmark-disclosure">
                <CircleHelp size={19} />
                <div>
                  <strong>Looking for the real LIBERO benchmark?</strong>
                  <p>
                    This browser environment uses staged arm motion and Rapier
                    rigid-body physics. Official LIBERO needs MuJoCo, its task
                    assets, and a trained VLA policy. The included Python runner
                    connects your VLA candidate endpoint to OpenJEV for real
                    evaluation.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setModal("docs")}
                  >
                    Read the integration guide <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "runtime"
                ? "Model runtime settings"
                : "Quick start guide"
            }
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">
                  PLAYGROUND / {modal === "runtime" ? "RUNTIME" : "GUIDE"}
                </div>
                <h2>
                  {modal === "runtime"
                    ? "Bring your own intelligence."
                    : "A small lab. A clear starting point."}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            {modal === "runtime" ? (
              <div className="modal-body">
                <div className="runtime-option">
                  <div className="runtime-title">
                    <Monitor size={19} />
                    <h3>Browser demo</h3>
                    <span className="tag">READY</span>
                  </div>
                  <p>
                    Three.js scene and deterministic action scores. No download
                    or model inference.
                  </p>
                  <button
                    className="button light"
                    onClick={() => {
                      reset();
                      setMode("demo");
                      setModal(null);
                    }}
                  >
                    Use scripted demo <ArrowRight size={14} />
                  </button>
                </div>
                <div className="runtime-option">
                  <div className="runtime-title">
                    <Box size={19} />
                    <h3>Open-Jev · DeBERTa</h3>
                    <span className="tag">NO SERVER</span>
                  </div>
                  <p>
                    A real typed-decision model from Kotoba, running entirely on
                    your device through Transformers.js. Approximately 480 MB on
                    first load, then cached. This is not AlexWortega’s Qwen 4B
                    checkpoint. Robotics is an experimental, out-of-domain task.
                  </p>
                  <div className="runtime-actions">
                    <button
                      className="button light"
                      disabled={loading || !gpu || running || busy}
                      onClick={() => {
                        if (browserReady) {
                          reset();
                          setMode("browser");
                          setModal(null);
                        } else void load();
                      }}
                    >
                      {loading ? (
                        <LoaderCircle size={14} className="spin" />
                      ) : (
                        <ArrowDownToLine size={14} />
                      )}{" "}
                      {browserReady
                        ? "Use browser model"
                        : "Load browser model"}
                    </button>
                    <span>
                      {browserDevice
                        ? `Running on ${browserDevice}`
                        : gpu
                          ? "WebGPU detected"
                          : "Enable WebGPU to load the model"}
                    </span>
                  </div>
                  {progress && (
                    <p className="load-progress" role="status">
                      {progress}
                    </p>
                  )}
                </div>
                <details className="advanced-runtime">
                  <summary>
                    Advanced: optional AlexWortega Qwen 4B bridge
                  </summary>{" "}
                  <div className="runtime-option featured">
                    <div className="runtime-title">
                      <Cpu size={19} />
                      <h3>OpenJEV · Qwen 4B</h3>
                      <span className="tag orange">LOCAL PYTHON</span>
                    </div>
                    <p>
                      AlexWortega’s actual NLI checkpoint. Start the included
                      bridge on your machine; the first start downloads model
                      weights.
                    </p>
                    <code>
                      uvicorn server.app:app --host 127.0.0.1 --port 8000
                    </code>
                    <label className="input-label">
                      Bridge URL
                      <input
                        aria-label="OpenJEV bridge URL"
                        value={endpoint}
                        onChange={(e) => {
                          setEndpoint(e.target.value);
                          setConnection("Not connected");
                        }}
                        placeholder="http://127.0.0.1:8000"
                      />
                    </label>
                    <div className="runtime-actions">
                      <button
                        className="button primary"
                        disabled={loading || running || busy}
                        onClick={() => void connect()}
                      >
                        {loading ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : (
                          <Plus size={14} />
                        )}
                        Connect OpenJEV
                      </button>
                      <span role="status">{connection}</span>
                    </div>
                  </div>
                </details>
              </div>
            ) : (
              <div className="modal-body docs">
                <p>
                  Choose a task, run an episode, and inspect the selected action
                  at each stage. Drag to orbit, scroll to zoom, or switch camera
                  views.
                </p>
                <h3>01 / The browser playground</h3>
                <p>
                  The arm follows five staged motions; Rapier handles rigid-body
                  contact and release. There are five manipulation stages. Demo
                  scores are deterministic. OpenJEV mode scores text
                  descriptions of those stages; the preview image is for
                  observation only and is not sent to the model.
                </p>
                <h3>02 / On-device Open-Jev</h3>
                <p>
                  Click Load Open-Jev to download the 4-bit DeBERTa
                  typed-decision model. Inference runs in a browser worker using
                  WebGPU. No server, Python installation, or API key is needed.
                  Weights are cached by your browser. Candidate probabilities
                  come from the actual model.
                </p>
                <h3>03 / VLA + official LIBERO</h3>
                <p>
                  The optional <code>server/run_libero.py</code> runner consumes
                  action-chunk candidates from your VLA endpoint, asks OpenJEV
                  to rerank their descriptions, and steps the real MuJoCo
                  environment. Setup and the endpoint contract are documented in
                  the repository README.
                </p>
                <div className="docs-note">
                  The browser uses Kotoba’s Open-Jev DeBERTa model, not
                  AlexWortega’s Qwen 4B. The optional Qwen bridge is for
                  developers only. Neither this simplified scene nor its
                  completion rate is an official LIBERO benchmark.
                </div>
                <a
                  href="https://huggingface.co/onnx-community/open-jev-deberta-v3-large-ONNX"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenJEV model card <ExternalLink size={13} />
                </a>
                <a
                  href="https://github.com/Lifelong-Robot-Learning/LIBERO"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official LIBERO repository <ExternalLink size={13} />
                </a>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
