"use client";

import { useState, useCallback, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { predictMove } from "@/lib/api";

type ModelSize = "small" | "mid" | "large";

export default function ArenaPage() {
  const [game, setGame] = useState(new Chess());
  const [whiteModel, setWhiteModel] = useState<ModelSize>("small");
  const [blackModel, setBlackModel] = useState<ModelSize>("mid");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Pick models and press Start");
  const [moves, setMoves] = useState<string[]>([]);
  const stopRef = useRef(false);

  const runMatch = useCallback(async () => {
    const g = new Chess();
    setGame(new Chess(g.fen()));
    setMoves([]);
    setRunning(true);
    stopRef.current = false;
    setStatus("Match in progress...");

    let moveCount = 0;
    const maxMoves = 200;

    while (!g.isGameOver() && moveCount < maxMoves && !stopRef.current) {
      const currentModel = g.turn() === "w" ? whiteModel : blackModel;
      try {
        const data = await predictMove(g.fen(), currentModel);
        if (data.move) {
          const m = g.move(data.move);
          if (m) {
            setMoves((prev) => [...prev, m.san]);
            setGame(new Chess(g.fen()));
            moveCount++;
          } else {
            break;
          }
        } else {
          break;
        }
      } catch {
        setStatus("API error — match stopped");
        break;
      }

      // Small delay so the board animates
      await new Promise((r) => setTimeout(r, 300));
    }

    if (g.isCheckmate()) {
      const winner = g.turn() === "w" ? "Black" : "White";
      const winnerModel = g.turn() === "w" ? blackModel : whiteModel;
      setStatus(`Checkmate! ${winner} (${winnerModel}) wins`);
    } else if (g.isDraw()) {
      setStatus("Draw!");
    } else if (stopRef.current) {
      setStatus("Match stopped");
    } else {
      setStatus(`Match ended after ${moveCount} moves`);
    }

    setRunning(false);
  }, [whiteModel, blackModel]);

  function stopMatch() {
    stopRef.current = true;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-center">Arena</h1>
      <p className="text-center text-zinc-400 mb-8">
        Watch two Artoria models battle each other
      </p>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
        <div className="w-full max-w-[480px]">
          <Chessboard
            options={{
              position: game.fen(),
              allowDragging: false,
              boardStyle: {
                borderRadius: "8px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              },
              darkSquareStyle: { backgroundColor: "#779952" },
              lightSquareStyle: { backgroundColor: "#edeed1" },
            }}
          />
        </div>

        <div className="flex flex-col gap-4 min-w-[220px]">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <p className="text-sm text-zinc-400 mb-1">Status</p>
            <p className="font-medium">{status}</p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <p className="text-sm text-zinc-400 mb-2">White</p>
            <div className="flex gap-2">
              {(["small", "mid", "large"] as ModelSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => !running && setWhiteModel(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    whiteModel === s
                      ? "bg-white text-black"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <p className="text-sm text-zinc-400 mb-2">Black</p>
            <div className="flex gap-2">
              {(["small", "mid", "large"] as ModelSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => !running && setBlackModel(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    blackModel === s
                      ? "bg-zinc-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {!running ? (
              <button
                onClick={runMatch}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
              >
                Start Match
              </button>
            ) : (
              <button
                onClick={stopMatch}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors"
              >
                Stop
              </button>
            )}
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 max-h-48 overflow-y-auto">
            <p className="text-sm text-zinc-400 mb-2">
              Moves ({moves.length})
            </p>
            <p className="text-xs font-mono text-zinc-300 break-all">
              {moves
                .reduce<string[]>((acc, m, i) => {
                  if (i % 2 === 0) acc.push(`${Math.floor(i / 2) + 1}. ${m}`);
                  else acc[acc.length - 1] += ` ${m}`;
                  return acc;
                }, [])
                .join(" ")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
