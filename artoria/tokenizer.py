import torch
import chess


class ChessTokenizer:
    """
    Tokenizer for Grandmaster-Level Chess Model.
    Ref: Appendix A.1 of arXiv:2402.04494v1
    """
    def __init__(self):
        self.BOARD_LEN = 64
        self.move_to_id = {}
        self.id_to_move = {}
        self._build_action_vocab()

    def _build_action_vocab(self):
        valid_moves = []
        for f in range(64):
            for t in range(64):
                if f == t:
                    continue
                m = chess.Move(f, t).uci()
                valid_moves.append(m)
                if t >= 56 and f >= 48 and f <= 55:
                    for p in ['q', 'r', 'b', 'n']:
                        valid_moves.append(m + p)
                if t <= 7 and f >= 8 and f <= 15:
                    for p in ['q', 'r', 'b', 'n']:
                        valid_moves.append(m + p)

        valid_moves = sorted(list(set(valid_moves)))

        self.action_offset = 256
        for idx, uci in enumerate(valid_moves):
            self.move_to_id[uci] = idx + self.action_offset
            self.id_to_move[idx + self.action_offset] = uci

        self.vocab_size = self.action_offset + len(valid_moves)
        self.num_actions = len(valid_moves)

        self.move_to_class = {uci: idx for idx, uci in enumerate(valid_moves)}
        self.class_to_move = {idx: uci for idx, uci in enumerate(valid_moves)}

    def tokenize(self, fen: str) -> torch.Tensor:
        parts = fen.split(' ')

        piece_placement = parts[0]
        active_color = parts[1]
        castling = parts[2]
        en_passant = parts[3]
        halfmove = parts[4]
        fullmove = parts[5]

        board_rows = piece_placement.split('/')
        expanded_board = ""
        for row in board_rows:
            for char in row:
                if char.isdigit():
                    expanded_board += '.' * int(char)
                else:
                    expanded_board += char

        castling_str = castling.ljust(4, '.') if castling != '-' else "...."
        ep_str = en_passant if en_passant != '-' else "-."
        halfmove_str = halfmove.rjust(2, '.')
        fullmove_str = fullmove.rjust(3, '.')

        token_str = (
            expanded_board +
            active_color +
            castling_str +
            ep_str +
            halfmove_str +
            fullmove_str
        )

        tokens = [ord(c) for c in token_str]

        MAX_LEN = 79
        if len(tokens) > MAX_LEN:
            tokens = tokens[:MAX_LEN]
        elif len(tokens) < MAX_LEN:
            tokens += [46] * (MAX_LEN - len(tokens))

        return torch.tensor(tokens, dtype=torch.long)

    def encode_action(self, uci_move: str) -> int:
        return self.move_to_id.get(uci_move, 0)

    def decode_action(self, action_id: int) -> str:
        return self.id_to_move.get(action_id, None)

    def action_to_class(self, uci_move: str) -> int:
        return self.move_to_class.get(uci_move, -1)

    def class_to_action(self, class_idx: int) -> str:
        return self.class_to_move.get(class_idx, None)
