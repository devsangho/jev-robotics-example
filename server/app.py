"""Local-only AlexWortega OpenJEV bridge. Start with uvicorn server.app:app."""
import os
import threading
from contextlib import asynccontextmanager
from time import perf_counter

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODEL_ID = "AlexWortega/openjev"
SUBFOLDER = os.getenv("OPENJEV_SUBFOLDER", "qwen3.5-4b-nli-v2")
model = tokenizer = None
device = "unloaded"
lock = threading.Lock()


@asynccontextmanager
async def lifespan(app):
    global model, tokenizer, device
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    device = os.getenv("OPENJEV_DEVICE") or (
        "cuda" if torch.cuda.is_available() else
        "mps" if torch.backends.mps.is_available() else "cpu"
    )
    dtype = torch.float32 if device == "cpu" else torch.bfloat16
    kwargs = {"subfolder": SUBFOLDER}
    if os.getenv("OPENJEV_REVISION"):
        kwargs["revision"] = os.environ["OPENJEV_REVISION"]
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, **kwargs)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID, dtype=dtype, **kwargs)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    model.config.get_text_config().pad_token_id = tokenizer.pad_token_id
    model.to(device).eval()
    yield
    model = tokenizer = None


app = FastAPI(title="Playground local inference", lifespan=lifespan)
# Allow only local development and this project's deployed frontend by default.
# Set JEV_ALLOWED_ORIGIN for your own fork's Pages URL (origin, without path).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:4173", "http://127.0.0.1:4173",
                   os.getenv("JEV_ALLOWED_ORIGIN", "https://devsangho.github.io")],
    allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
)


@app.middleware("http")
async def local_network_preflight(request, call_next):
    response = await call_next(request)
    # Chromium versions using Private Network Access preflight.
    if request.headers.get("access-control-request-private-network") == "true":
        if response.headers.get("access-control-allow-origin"):
            response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


class ScoreRequest(BaseModel):
    premise: str = Field(min_length=1, max_length=12000)
    hypotheses: list[str] = Field(min_length=1, max_length=16)


@app.get("/health")
def health():
    return {"service": "robotics-playground", "ready": model is not None,
            "model": f"{MODEL_ID}/{SUBFOLDER}", "device": device}


@app.post("/score")
def score(request: ScoreRequest):
    if model is None:
        raise HTTPException(503, "Model is not loaded")
    if any(not h.strip() or len(h) > 2000 for h in request.hypotheses):
        raise HTTPException(422, "Hypotheses must contain 1–2000 characters")
    import torch
    start = perf_counter()
    template = getattr(model.config, "nli_template", None) or "Premise: {premise}\nHypothesis: {hypothesis}"
    texts = [template.format(premise=request.premise, hypothesis=h) for h in request.hypotheses]
    with lock, torch.inference_mode():
        encoded = tokenizer(texts, padding=True, truncation=True, max_length=2048, return_tensors="pt").to(device)
        probabilities = model(**encoded).logits.float().softmax(-1).cpu().tolist()
    return {"scores": [row[1] for row in probabilities], "probabilities": probabilities,
            "labels": ["contradiction", "entailment", "neutral"],
            "model": f"{MODEL_ID}/{SUBFOLDER}", "latency_ms": (perf_counter() - start) * 1000}
