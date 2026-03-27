import os
import sys
import json
import gc
import torch
import chess
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from huggingface_hub import hf_hub_download

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from artoria.model import ChessModelConfig, GrandmasterChessModel
from artoria.tokenizer import ChessTokenizer

HF_REPO = "Shinapri/artoria-zero"
MODEL_SIZES = ["small", "mid", "large"]
CACHE_DIR = os.environ.get("MODEL_CACHE_DIR", "/tmp/artoria-models")

tokenizer = ChessTokenizer()
device = "cuda" if torch.cuda.is_available() else "cpu"
models: dict[str, GrandmasterChessModel | None] = {}


def load_model(size: str) -> GrandmasterChessModel | None:
    try:
        config_path = hf_hub_download(HF_REPO, f"{size}/config.json", cache_dir=CACHE_DIR)
        checkpoint_path = hf_hub_download(HF_REPO, f"{size}/checkpoint.pt", cache_dir=CACHE_DIR)

        with open(config_path) as f:
            config = ChessModelConfig(**json.load(f))
        config.num_classes = tokenizer.num_actions

        model = GrandmasterChessModel(config)
        checkpoint = torch.load(checkpoint_path, map_location=device)
        state_dict = checkpoint.get("model_state_dict", checkpoint)

        try:
            model.load_state_dict(state_dict)
        except RuntimeError:
            model_state = model.state_dict()
            filtered = {k: v for k, v in state_dict.items() if k in model_state and v.size() == model_state[k].size()}
            model.load_state_dict(filtered, strict=False)

        del checkpoint
        gc.collect()

        model.to(device)
        model.eval()
        print(f"Loaded {size} model")
        return model
    except Exception as e:
        print(f"Failed to load {size}: {e}")
        return None


app = FastAPI(title="Artoria Zero API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    fen: str
    model_size: str = "small"
    temperature: float = 1.0


@app.on_event("startup")
async def startup():
    load_on_start = os.environ.get("PRELOAD_MODELS", "small").split(",")
    for size in load_on_start:
        size = size.strip()
        if size in MODEL_SIZES:
            models[size] = load_model(size)


@app.get("/health")
async def health():
    loaded = [k for k, v in models.items() if v is not None]
    return {"status": "ok", "device": device, "loaded_models": loaded}


@app.get("/models")
async def list_models():
    return {"models": MODEL_SIZES, "loaded": [k for k, v in models.items() if v is not None]}


@app.post("/predict")
async def predict(req: PredictRequest):
    size = req.model_size
    if size not in MODEL_SIZES:
        return {"error": f"Invalid model size. Choose from: {MODEL_SIZES}"}

    if size not in models or models[size] is None:
        models[size] = load_model(size)

    model = models.get(size)
    if model is None:
        board = chess.Board(req.fen)
        legal = list(board.legal_moves)
        if not legal:
            return {"move": None, "game_over": True, "status": "No legal moves"}
        import random
        return {"move": random.choice(legal).uci(), "status": "random (no model)", "eval": 0.0}

    try:
        tokens = tokenizer.tokenize(req.fen).unsqueeze(0).to(device)
        board = chess.Board(req.fen)
        legal_moves = list(board.legal_moves)

        if not legal_moves:
            return {"move": None, "game_over": True, "status": "No legal moves"}

        with torch.no_grad():
            logits, value = model(tokens)

        eval_score = value.item()
        temp = max(0.01, req.temperature)

        # Mask logits to legal moves only, then sample
        legal_indices = []
        legal_ucis = []
        for m in legal_moves:
            idx = tokenizer.action_to_class(m.uci())
            if idx != -1:
                legal_indices.append(idx)
                legal_ucis.append(m.uci())

        if not legal_indices:
            import random
            return {"move": random.choice(legal_moves).uci(), "status": "random (policy failed)", "eval": eval_score}

        legal_logits = logits[0][legal_indices] / temp
        probs = torch.softmax(legal_logits, dim=0)
        chosen_idx = int(torch.multinomial(probs, num_samples=1).item())
        best_move = legal_ucis[chosen_idx]

        return {"move": best_move, "status": f"ai ({size})", "eval": eval_score}

    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
