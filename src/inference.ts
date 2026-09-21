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
import { scoreBrowser } from "./browserRuntime";
export { loadBrowser, cancelBrowserLoad } from "./browserRuntime";
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
    const result = await scoreBrowser(
      premise(w, t),
      actions.map((a) => actionText[a]),
      signal,
    );
    scores = result.scores!;
    source = `Open-Jev DeBERTa · ${result.device} · on-device`;
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
