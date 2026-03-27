import torch
from torch.utils.data import IterableDataset, DataLoader
from datasets import load_dataset
import chess.pgn
import io
import sys
import os
import json
import argparse
import gc

from artoria.model import ChessModelConfig, GrandmasterChessModel
from artoria.tokenizer import ChessTokenizer
from artoria.data import AngeluriotProcessor, GamePreprocessor, LichessProcessor

DATASET_NAME = "Lichess/standard-chess-games"


class ChessIterableDataset(IterableDataset):
    def __init__(self, tokenizer, max_games=None, skip_games=0, data_path=None, preprocessor: GamePreprocessor = None):
        self.tokenizer = tokenizer
        self.data_path = data_path
        self.max_games = max_games
        self.skip_games = skip_games
        self.skip_games_offset = skip_games
        self.preprocessor = preprocessor

        if data_path:
            if not os.path.exists(data_path):
                raise FileNotFoundError(f"Data path {data_path} not found.")
            print(f"Using local PGN file: {data_path}")
            self.dataset = None
        else:
            print(f"Streaming from Hugging Face: {DATASET_NAME}")
            dataset = load_dataset(DATASET_NAME, split="train", streaming=True)
            if skip_games > 0:
                print(f"Skipping first {skip_games} games...")
                dataset = dataset.skip(skip_games)
            self.dataset = dataset

    def __iter__(self):
        count = 0

        def game_generator():
            nonlocal count
            if self.data_path:
                with open(self.data_path, 'r') as pgn_file:
                    if self.skip_games_offset > 0:
                        print(f"Skipping {self.skip_games_offset} games in local file...")
                        for _ in range(self.skip_games_offset):
                            if chess.pgn.skip_game(pgn_file):
                                continue
                            else:
                                break

                    while True:
                        try:
                            game = chess.pgn.read_game(pgn_file)
                        except Exception:
                            continue
                        if game is None:
                            break

                        if self.preprocessor:
                            game = self.preprocessor.process(game)
                            if game is None:
                                continue

                        yield game
            else:
                while True:
                    for data in self.dataset:
                        game = None

                        if self.preprocessor:
                            try:
                                game = self.preprocessor.process(data)
                            except Exception:
                                continue
                        elif 'movetext' in data:
                            pgn_text = data['movetext']
                            try:
                                pgn_io = io.StringIO(pgn_text)
                                game = chess.pgn.read_game(pgn_io)
                            except Exception:
                                continue

                        if game:
                            yield game

                    print("Dataset epoch complete. Restarting stream...", file=sys.stderr)

        for game in game_generator():
            if self.max_games is not None and count >= self.max_games:
                break

            current_game_idx = self.skip_games_offset + count

            res_str = game.headers.get("Result", "*")
            if res_str == "1-0":
                val_target = 1.0
            elif res_str == "0-1":
                val_target = -1.0
            elif res_str == "1/2-1/2":
                val_target = 0.0
            else:
                val_target = 0.0

            board = game.board()

            for move in game.mainline_moves():
                try:
                    tokens = self.tokenizer.tokenize(board.fen())
                    action_uci = move.uci()
                    target_idx = self.tokenizer.action_to_class(action_uci)

                    if target_idx == -1:
                        board.push(move)
                        continue

                    yield tokens, torch.tensor(target_idx, dtype=torch.long), torch.tensor(val_target, dtype=torch.float), torch.tensor(current_game_idx)
                    board.push(move)
                except ValueError:
                    continue

            count += 1


def load_config(config_path):
    with open(config_path, 'r') as f:
        config_dict = json.load(f)
    return ChessModelConfig(**config_dict)


def train(args):
    print(f"Loading configuration from {args.config}...")
    config = load_config(args.config)
    print(f"Model config: {config}")

    print("Initializing Tokenizer and Model...")
    tokenizer = ChessTokenizer()

    print(f"Tokenizer Actions: {tokenizer.num_actions}")
    config.num_classes = tokenizer.num_actions

    final_config_path = os.path.join(args.out_dir, "final_config.json")
    os.makedirs(args.out_dir, exist_ok=True)

    with open(final_config_path, 'w') as f:
        json.dump(config.__dict__, f, indent=4)
    print(f"Saved adapted configuration to {final_config_path}")

    model = GrandmasterChessModel(config)

    device_name = args.device if args.device else ("cuda" if torch.cuda.is_available() else "cpu")
    device = torch.device(device_name)
    print(f"Using device: {device}")
    model.to(device)

    start_step = 0
    games_seen = 0
    if args.resume_from:
        if os.path.exists(args.resume_from):
            print(f"Resuming from checkpoint: {args.resume_from}")
            checkpoint = torch.load(args.resume_from, map_location=device)

            state_dict = None
            if 'model_state_dict' in checkpoint:
                state_dict = checkpoint['model_state_dict']
                if 'step' in checkpoint:
                    start_step = checkpoint['step']
                    print(f"Resuming from step {start_step}")
                if 'games_seen' in checkpoint:
                    games_seen = checkpoint['games_seen']
                    print(f"Already processed {games_seen} games.")
                    if args.skip_games < games_seen:
                        print(f"Overriding --skip_games to {games_seen}")
                        args.skip_games = games_seen
            else:
                state_dict = checkpoint

            try:
                model.load_state_dict(state_dict)
                print("Checkpoint loaded successfully (Strict Match).")
            except RuntimeError:
                print("Warning: Strict load failed. Attempting partial load...")
                model_state = model.state_dict()
                filtered_state = {k: v for k, v in state_dict.items() if k in model_state and v.size() == model_state[k].size()}
                ignored = set(state_dict.keys()) - set(filtered_state.keys())
                print(f"Ignored keys (mismatch/missing): {list(ignored)}")
                model.load_state_dict(filtered_state, strict=False)
                print("Checkpoint loaded successfully (Partial Match).")
        else:
            print(f"Warning: Checkpoint {args.resume_from} not found. Starting from scratch.")

    state_json_path = os.path.join(args.out_dir, "training_state.json")
    if os.path.exists(state_json_path):
        try:
            with open(state_json_path, 'r') as f:
                state = json.load(f)
                json_games = state.get('games_seen', 0)
                if args.skip_games < json_games:
                    print(f"Found training_state.json. Overriding skip_games to {json_games}")
                    args.skip_games = json_games
        except Exception as e:
            print(f"Error reading training_state.json: {e}")

    print("Setting up Dataset (Streaming/Local)...")

    if "Lichess" in DATASET_NAME:
        print("Using LichessProcessor (standard-chess-games)...")
        preprocessor = LichessProcessor()
    else:
        print(f"Using AngeluriotProcessor ({DATASET_NAME})...")
        preprocessor = AngeluriotProcessor(filter_checkmate=args.filter_checkmate)

    dataset = ChessIterableDataset(tokenizer, max_games=args.max_games, skip_games=args.skip_games, data_path=args.data_path, preprocessor=preprocessor)
    dataloader = DataLoader(dataset, batch_size=args.batch_size)

    print(f"Optimizer Learning Rate: {args.lr}")
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    print(f"Starting Training Loop...")
    print(f"Batch Size: {args.batch_size}, Max Steps: {args.max_steps}, Max Games: {args.max_games}")
    print(f"Save Interval: {args.save_every}, Output Directory: {args.out_dir}")

    model.train()

    use_amp = (args.precision != "fp32")
    amp_dtype = torch.bfloat16 if args.precision == "bf16" else torch.float16
    scaler = torch.cuda.amp.GradScaler(enabled=(args.precision == "fp16"))

    print(f"Precision: {args.precision} (AMP: {use_amp}, Dtype: {amp_dtype})")

    step = start_step
    max_game_idx_seen = args.skip_games

    try:
        for batch_idx, (input_ids, targets, val_targets, game_indices) in enumerate(dataloader):
            input_ids = input_ids.to(device)
            targets = targets.to(device)
            val_targets = val_targets.to(device)

            try:
                current_max_game = game_indices.max().item()
                if current_max_game > max_game_idx_seen:
                    max_game_idx_seen = current_max_game
            except Exception:
                pass

            optimizer.zero_grad(set_to_none=True)

            with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=use_amp):
                logits, value_pred = model(input_ids)
                loss_policy = torch.nn.functional.cross_entropy(logits, targets)
                loss_value = torch.nn.functional.mse_loss(value_pred.squeeze(-1), val_targets)
                loss = loss_policy + 1.0 * loss_value

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            if step % args.log_every == 0:
                print(f"Step {step}: Loss = {loss.item():.4f} (Pol={loss_policy.item():.4f}, Val={loss_value.item():.4f}) | Games: {max_game_idx_seen}")

            if step > 0 and step % args.save_every == 0:
                save_path = os.path.join(args.out_dir, f"checkpoint_step_{step}.pt")
                state = {
                    'step': step,
                    'model_state_dict': model.state_dict(),
                    'optimizer_state_dict': optimizer.state_dict(),
                    'games_seen': max_game_idx_seen + 1
                }
                torch.save(state, save_path)

                with open(state_json_path, 'w') as f:
                    json.dump({
                        'step': step,
                        'games_seen': max_game_idx_seen + 1,
                        'latest_checkpoint': save_path
                    }, f, indent=4)

                print(f"Saved checkpoint to {save_path} (Games: {max_game_idx_seen + 1})")

            step += 1

            if args.max_steps is not None and step >= args.max_steps:
                print("Reached max steps.")
                break

    except KeyboardInterrupt:
        print("Training interrupted.")

    final_save_path = os.path.join(args.out_dir, "checkpoint_final.pt")
    state = {
        'step': step,
        'model_state_dict': model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'games_seen': max_game_idx_seen + 1
    }
    torch.save(state, final_save_path)

    with open(state_json_path, 'w') as f:
        json.dump({
            'step': step,
            'games_seen': max_game_idx_seen + 1,
            'latest_checkpoint': final_save_path
        }, f, indent=4)

    print(f"Saved final checkpoint to {final_save_path} (Games: {max_game_idx_seen + 1})")
    print("Training script finished successfully.")


def main():
    parser = argparse.ArgumentParser(description="Train Chess Model")
    parser.add_argument("--config", type=str, default="models/small/config.json", help="Path to model config JSON")
    parser.add_argument("--batch_size", type=int, default=4, help="Batch size")
    parser.add_argument("--device", type=str, default=None, help="Device (cpu, cuda, mps)")
    parser.add_argument("--max_steps", type=int, default=100, help="Maximum training steps")
    parser.add_argument("--max_games", type=int, default=None, help="Maximum number of games to parse")
    parser.add_argument("--skip_games", type=int, default=0, help="Number of games to skip")
    parser.add_argument("--data_path", type=str, default=None, help="Path to local PGN file")
    parser.add_argument("--out_dir", type=str, default="./checkpoints", help="Output directory for checkpoints")
    parser.add_argument("--save_every", type=int, default=1000, help="Steps interval to save checkpoint")
    parser.add_argument("--log_every", type=int, default=10, help="Steps interval to log training loss")
    parser.add_argument("--resume_from", type=str, default=None, help="Path to checkpoint to resume from")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning Rate")
    parser.add_argument("--filter_checkmate", action="store_true", help="Filter dataset to only checkmate games")
    parser.add_argument("--precision", type=str, default="fp32", choices=["fp32", "fp16", "bf16"], help="Training precision")

    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
