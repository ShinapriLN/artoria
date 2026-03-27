"use client";

import { useState, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { predictMove } from "@/lib/api";

type ModelSize = "small" | "mid" | "large";

export default function PlayPage() {
  const [game, setGame] = useState(new Chess());
  const [modelSize, setModelSize] = useState<ModelSize>("small");
  const [status, setStatus] = useState("Your turn (White)");
  const [evalScore, setEvalScore] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);

  const makeAIMove = useCallback(
    async (currentGame: Chess) => {
      if (currentGame.isGameOver()) {
        if (currentGame.isCheckmate()) setStatus("Checkmate!");
        else if (currentGame.isDraw()) setStatus("Draw!");
        else setStatus("Game over!");
        return;
      }

      setThinking(true);
      setStatus("AI is thinking...");

      try {
        const data = await predictMove(currentGame.fen(), modelSize);
        if (data.move) {
          currentGame.move(data.move);
          setGame(new Chess(currentGame.fen()));
          setEvalScore(data.eval);

          if (currentGame.isGameOver()) {
            if (currentGame.isCheckmate()) setStatus("Checkmate!");
            else if (currentGame.isDraw()) setStatus("Draw!");
            else setStatus("Game over!");
          } else {
            setStatus("Your turn");
          }
        } else {
          setStatus("AI returned no move");
        }
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : "API unavailable"}`);
      } finally {
        setThinking(false);
      }
    },
    [modelSize]
  );

  function onDrop({
    sourceSquare,
    targetSquare,
  }: {
    piece: { pieceType: string; isSparePiece: boolean; position: string };
    sourceSquare: string;
    targetSquare: string | null;
  }) {
    if (thinking || !targetSquare) return false;

    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    });

    if (move === null) return false;

    setGame(new Chess(gameCopy.fen()));
    makeAIMove(gameCopy);
    return true;
  }

  function resetGame() {
    setGame(new Chess());
    setStatus("Your turn (White)");
    setEvalScore(null);
    setThinking(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-center">Play Against Artoria</h1>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
        <div className="w-full max-w-[480px]">
          <Chessboard
            options={{
              position: game.fen(),
              onPieceDrop: onDrop,
              boardOrientation: "white",
              boardStyle: {
                borderRadius: "8px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              },
              darkSquareStyle: { backgroundColor: "#779952" },
              lightSquareStyle: { backgroundColor: "#edeed1" },
            }}
          />
        </div>

        <div className="flex flex-col gap-4 min-w-[200px]">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <p className="text-sm text-zinc-400 mb-1">Status</p>
            <p className="font-medium">{status}</p>
          </div>

          {evalScore !== null && (
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
              <p className="text-sm text-zinc-400 mb-1">Evaluation</p>
              <p className="font-mono text-lg">
                {evalScore > 0 ? "+" : ""}
                {evalScore.toFixed(3)}
              </p>
            </div>
          )}

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <p className="text-sm text-zinc-400 mb-2">Model</p>
            <div className="flex gap-2">
              {(["small", "mid", "large"] as ModelSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setModelSize(size)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    modelSize === size
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={resetGame}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors"
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}
