import chess
import chess.pgn
import io


class GamePreprocessor:
    def process(self, game):
        return game


class AngeluriotProcessor(GamePreprocessor):
    def __init__(self, filter_checkmate=False):
        self.filter_checkmate = filter_checkmate

    def process(self, data):
        if isinstance(data, chess.pgn.Game):
            return data

        if self.filter_checkmate:
            if data.get('end_type') != 'checkmate':
                return None

        moves_san = data.get('moves_san')
        if not moves_san:
            return None

        if isinstance(moves_san, str):
            import ast
            try:
                moves_san = ast.literal_eval(moves_san)
            except Exception:
                moves_san = moves_san.split()

        if not isinstance(moves_san, list):
            return None

        game = chess.pgn.Game()

        if 'result' in data and data['result']:
            game.headers["Result"] = data['result']
        elif 'winner' in data:
            w = data['winner']
            if w:
                w = w.lower()
                if w == 'white':
                    game.headers["Result"] = '1-0'
                elif w == 'black':
                    game.headers["Result"] = '0-1'
                else:
                    game.headers["Result"] = '1/2-1/2'
            else:
                game.headers["Result"] = '1/2-1/2'

        if 'white_elo' in data:
            game.headers["WhiteElo"] = str(data['white_elo'])
        if 'black_elo' in data:
            game.headers["BlackElo"] = str(data['black_elo'])

        node = game
        board = chess.Board()

        try:
            for san in moves_san:
                move = board.push_san(san)
                node = node.add_variation(move)
        except ValueError:
            if len(game.errors) > 0 or board.move_stack == []:
                return None

        return game


class LichessProcessor(GamePreprocessor):
    def process(self, data):
        if isinstance(data, chess.pgn.Game):
            return data

        pgn_text = data.get('movetext')
        if not pgn_text:
            return None

        try:
            pgn_io = io.StringIO(pgn_text)
            game = chess.pgn.read_game(pgn_io)

            if 'result' in data:
                game.headers["Result"] = data['result']

            if not game.mainline_moves():
                return None

            return game
        except Exception:
            return None
