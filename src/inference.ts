import {
  actions,
  actionText,
  demoScores,
  premise,
  type World,
  type Task,
  type Decision,
} from "./simulation";
export type Mode = "demo" | "openjev" | "browser";
let engine: import("@mlc-ai/web-llm").MLCEngineInterface | undefined;
export async function loadBrowser(onProgress: (text: string) => void) {
  if (!("gpu" in navigator))
    throw new Error(
      "WebGPU is unavailable. Use Chrome or Edge with hardware acceleration, or connect local OpenJEV.",
    );
  const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
  engine = await CreateMLCEngine("Qwen3-0.6B-q4f16_1-MLC", {
    initProgressCallback: (p) => onProgress(p.text),
  });
}
export async function decide(
  mode: Mode,
  w: World,
  t: Task,
  endpoint: string,
  signal: AbortSignal,
): Promise<Decision> {
  const start = performance.now();
  let scores: number[], source: string;
  if (mode === "demo") {
    scores = demoScores(w);
    source = "Scripted policy · no model";
  } else if (mode === "openjev") {
    const res = await fetch(`${endpoint.replace(/\/$/, "")}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        premise: premise(w, t),
        hypotheses: actions.map(
          (a) => `The appropriate next action is: ${actionText[a]}.`,
        ),
      }),
      signal,
    });
    if (!res.ok)
      throw new Error(
        `OpenJEV returned ${res.status}. Check the local bridge terminal.`,
      );
    const data = await res.json();
    scores = data.scores;
    source = data.model || "Local OpenJEV";
  } else {
    if (!engine)
      throw new Error("Load the browser model in Runtime settings first.");
    const result = await engine.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You select the next robot manipulation stage. Return a JSON object with an action field from the allowed actions. /no_think",
        },
        {
          role: "user",
          content: `${premise(w, t)}\nAllowed actions: ${actions.join(", ")}. Return {"action":"..."}.`,
        },
      ],
      temperature: 0,
      max_tokens: 128,
      response_format: { type: "json_object" },
    });
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const parsed = JSON.parse(result.choices[0].message.content || "{}");
    const index = actions.indexOf(parsed.action);
    if (index < 0)
      throw new Error(
        "Browser model did not return a valid action. Try resetting the episode.",
      );
    scores = actions.map((_, i) => (i === index ? 1 : 0));
    source = "Qwen3 0.6B · generated choice (not OpenJEV)";
  }
  if (
    !Array.isArray(scores) ||
    scores.length !== actions.length ||
    scores.some(
      (n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1,
    )
  )
    throw new Error(
      "Invalid model response: expected five scores between 0 and 1.",
    );
  return {
    action: actions[scores.indexOf(Math.max(...scores))],
    scores,
    latency: performance.now() - start,
    source,
  };
}
