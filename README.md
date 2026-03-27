# Artoria Zero

Grandmaster-Level Chess Without Search. A decoder-only transformer that plays chess through pure pattern recognition — no MCTS, no Alpha-Beta, no search tree.

Based on [arXiv:2402.04494](https://arxiv.org/abs/2402.04494).

## Architecture

```
FEN String -> [ASCII Tokenizer, 79 tokens]
  -> Token Embedding + Positional Embedding
  -> N x Transformer Block (RMSNorm + Bidirectional Attention + SwiGLU)
  -> Mean Pooling
  -> Policy Head (move classification, ~4544 classes)
  -> Value Head (position eval, tanh [-1, 1])
```

## Model Variants

| Variant | d_model | Layers | Heads | Params | HF Path |
|---------|---------|--------|-------|--------|---------|
| Small | 256 | 8 | 8 | ~19M | `small/checkpoint.pt` |
| Mid | 512 | 16 | 8 | ~100M | `mid/checkpoint.pt` |
| Large | 1024 | 40 | 32 | ~500M | `large/checkpoint.pt` |

Models: [Shinapri/artoria-zero](https://huggingface.co/Shinapri/artoria-zero)

## Project Structure

```
artoria/
├── artoria/           # Core Python package
│   ├── model.py       # Model architecture (RMSNorm, SwiGLU, Transformer)
│   ├── tokenizer.py   # FEN tokenizer + move vocabulary
│   ├── data.py        # Dataset processors (Lichess, Angeluriot)
│   ├── train.py       # Training pipeline
│   └── evaluate.py    # Evaluation pipeline
├── api/               # HF Space backend (FastAPI + Docker)
│   ├── app.py
│   ├── Dockerfile
│   └── requirements.txt
├── web/               # Frontend (Next.js + Tailwind)
│   └── src/app/
│       ├── page.tsx        # Landing page
│       ├── play/page.tsx   # Play against AI
│       ├── arena/page.tsx  # Model vs Model
│       └── about/page.tsx  # Architecture docs
└── models/            # Local checkpoints (git-ignored)
    ├── small/
    ├── mid/
    └── large/
```

## Quick Start

### Training

```bash
# Streaming from Lichess
python -m artoria.train --config models/small/config.json --max_steps 10000 --out_dir ./checkpoints

# Local PGN file
python -m artoria.train --config models/small/config.json --data_path games.pgn --out_dir ./checkpoints

# Resume training
python -m artoria.train --config models/small/config.json --resume_from ./checkpoints/checkpoint_final.pt
```

### Evaluation

```bash
python -m artoria.evaluate --config models/small/config.json --checkpoint ./checkpoints --test_games 1000
```

### Inference API

```bash
cd api
uvicorn app:app --host 0.0.0.0 --port 7860
```

```bash
curl -X POST http://localhost:7860/predict \
  -H "Content-Type: application/json" \
  -d '{"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "model_size": "small"}'
```

### Frontend

```bash
cd web
bun install
bun dev
```

### Docker (HF Space)

```bash
docker build -f api/Dockerfile -t artoria-api .
docker run -p 7860:7860 artoria-api
```

## Links

- Models: [huggingface.co/Shinapri/artoria-zero](https://huggingface.co/Shinapri/artoria-zero)
- Paper: [arXiv:2402.04494](https://arxiv.org/abs/2402.04494)

## License

MIT
