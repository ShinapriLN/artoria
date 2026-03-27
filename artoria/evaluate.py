import torch
import argparse
import json
import os
from torch.utils.data import DataLoader

from artoria.model import ChessModelConfig, GrandmasterChessModel
from artoria.tokenizer import ChessTokenizer
from artoria.train import ChessIterableDataset, load_config


def evaluate(args):
    print(f"Loading configuration from {args.config}...")
    config = load_config(args.config)

    print("Initializing Tokenizer and Model...")
    tokenizer = ChessTokenizer()
    print(f"Tokenizer Actions: {tokenizer.num_actions}")
    config.num_classes = tokenizer.num_actions

    model = GrandmasterChessModel(config)
    device = torch.device(args.device if args.device else ("cuda" if torch.cuda.is_available() else "cpu"))
    model.to(device)
    model.eval()

    skip_games = 0
    checkpoint_path = args.checkpoint

    if os.path.isdir(args.checkpoint):
        state_path = os.path.join(args.checkpoint, "training_state.json")
        if os.path.exists(state_path):
            print(f"Found training state at {state_path}")
            with open(state_path, 'r') as f:
                state = json.load(f)
                checkpoint_path = state.get('latest_checkpoint')
                skip_games = state.get('games_seen', 0)
                print(f"Auto-detected latest checkpoint: {checkpoint_path}")
                print(f"Auto-detected games processed: {skip_games}")
        else:
            print(f"Error: Directory {args.checkpoint} does not contain training_state.json")
            return
    elif not (args.checkpoint and os.path.exists(args.checkpoint)):
        print(f"Error: Invalid checkpoint path: {args.checkpoint}")
        return

    if os.path.exists(checkpoint_path):
        print(f"Loading checkpoint from {checkpoint_path}...")
        checkpoint = torch.load(checkpoint_path, map_location=device)

        state_dict = None
        if 'model_state_dict' in checkpoint:
            state_dict = checkpoint['model_state_dict']
            if skip_games == 0 and 'games_seen' in checkpoint:
                skip_games = checkpoint['games_seen']
                print(f"Checkpoint indicates {skip_games} games processed.")
        else:
            state_dict = checkpoint

        try:
            model.load_state_dict(state_dict)
            print("Checkpoint loaded successfully.")
        except RuntimeError:
            print("Warning: Strict load failed. Attempting partial load...")
            model_state = model.state_dict()
            filtered_state = {k: v for k, v in state_dict.items() if k in model_state and v.size() == model_state[k].size()}
            model.load_state_dict(filtered_state, strict=False)
            print("Checkpoint loaded (Partial Match).")

    if args.skip_games > 0:
        print(f"Manually overriding skip_games to {args.skip_games}")
        skip_games = args.skip_games

    print(f"Preparing Evaluation Dataset (Skipping first {skip_games} games)...")
    dataset = ChessIterableDataset(tokenizer, max_games=args.test_games, skip_games=skip_games)
    dataloader = DataLoader(dataset, batch_size=args.batch_size)

    print(f"Starting Evaluation on {args.test_games} games...")

    total_loss = 0
    total_batches = 0

    with torch.no_grad():
        for i, (input_ids, targets, val_targets, game_idx) in enumerate(dataloader):
            input_ids = input_ids.to(device)
            targets = targets.to(device)

            logits, value = model(input_ids)
            loss = torch.nn.functional.cross_entropy(logits, targets)

            total_loss += loss.item()
            total_batches += 1

            if i % 10 == 0:
                print(f"Batch {i}: Loss = {loss.item():.4f}")

    avg_loss = total_loss / total_batches if total_batches > 0 else 0
    print(f"\nEvaluation Complete.")
    print(f"Processed Batches: {total_batches}")
    print(f"Average Loss: {avg_loss:.4f}")


def main():
    parser = argparse.ArgumentParser(description="Evaluate Chess Model")
    parser.add_argument("--config", type=str, default="models/small/config.json", help="Path to config file")
    parser.add_argument("--checkpoint", type=str, required=True, help="Path to model checkpoint")
    parser.add_argument("--test_games", type=int, default=100, help="Number of games to evaluate on")
    parser.add_argument("--skip_games", type=int, default=0, help="Manual override for games to skip")
    parser.add_argument("--batch_size", type=int, default=4, help="Batch size")
    parser.add_argument("--device", type=str, default=None, help="Device to use")

    args = parser.parse_args()
    evaluate(args)


if __name__ == "__main__":
    main()
