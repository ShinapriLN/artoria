# Artoria Zero ♟️

**Artoria Zero** is a deep learning chess engine prototype based on the research paper **"Grandmaster-Level Chess Without Search"** ([arXiv:2402.04494](https://arxiv.org/abs/2402.04494)).

Unlike traditional engines (Stockfish) that rely on Alpha-Beta search, or AlphaZero which uses MCTS, Artoria Zero is a **Decoder-Only Transformer** trained via Behavioral Cloning to predict the next best move directly from the board state (FEN), similar to how an LLM predicts the next token.

<p align="center">
  <img src="board/static/style.css" alt="Artoria Chess Playground" width="600">
  <br>
  <em>Artoria Web Playground (Glassmorphism UI)</em>
</p>

## ✨ Features

- **Transformer Architecture**: RMSNorm, SwiGLU, and Learned Positional Embeddings (Context Len 79).
- **Behavioral Cloning**: Predicts the next move (UCI format) as a classification task (~4544 classes).
- **HPC-Ready Pipeline**:
  - Streaming support (Hugging Face `Lichess/standard-chess-games`).
  - Local PGN file support avoiding memory bottlenecks.
- **Robust Training**: Supports partial checkpoint loading (Transfer Learning / Architecture evolution).
- **Web Playground**: Includes a Flask-based web interface with a beautiful glassmorphism UI for testing.

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/your-username/artoria.git
cd artoria

# Install dependencies
pip install -r requirements.txt
```

**Requirements:** `torch`, `python-chess`, `datasets`, `numpy`, `flask`.

## 🚀 Usage

### 1. Training

You can train on streaming data (internet required) or a local PGN file.

**Streaming (Hugging Face):**

```bash
python train.py --max_games 100000 --out_dir ./checkpoints --log_every 100
```

**Local PGN (Offline / HPC):**

```bash
python train.py --data_path /path/to/grandmaster_games.pgn --out_dir ./checkpoints
```

**Key Arguments:**

- `--resume_from <path>`: Resume training or Transfer Learn from a checkpoint.
- `--save_every <steps>`: Checkpoint interval.
- `--config <path>`: Path to JSON config (default: `model_config.json`).

### 2. Evaluation

To evaluate the model's perplexity and loss on **unseen games** (automatically skips games seen during training if `training_state.json` is present):

```bash
python evaluate.py --checkpoint ./checkpoints --test_games 1000
```

### 3. Web Playground

Test your model interactively!

```bash
cd board
python app.py
```

Open **http://localhost:8888** in your browser.  
_The playground automatically masks illegal moves to ensure a smooth experience during early training._

## ⚙️ Configuration

The model architecture is defined in `model_config.json`:

```json
{
  "vocab_size": 5000,
  "d_model": 256,
  "n_layers": 8,
  "n_heads": 8,
  "max_seq_len": 79,
  "num_classes": 5000,
  "dropout": 0.0
}
```

_(Default is a lightweight prototype. Scale `n_layers` to 16+ and `d_model` to 512+ for Grandmaster performance)._

## 📈 Status

- **Phase 1 (Current)**: Pre-training on ~2000 ELO Lichess games (Behavioral Cloning / Policy Only).
- **Phase 2 (Planned)**: Fine-tuning on Grandmaster datasets (>2500 ELO).
  - _Note_: The model currently predicts _moves_ (Policy). Future versions will include a **State-Value Head** (Win Probability) trained via transfer learning on top of this pre-trained base.

## License

MIT
