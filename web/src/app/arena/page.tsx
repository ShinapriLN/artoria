"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { predictMove } from "@/lib/api";

type ModelSize = "small" | "mid" | "large";

type MoveRecord = {
  san: string;
  fen: string;
  color: "w" | "b";
  eval?: number;
};

export default function ArenaPage() {
  const [game, setGame] = useState(new Chess());
  const [whiteModel, setWhiteModel] = useState<ModelSize>("small");
  const [blackModel, setBlackModel] = useState<ModelSize>("mid");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Pick models and press Start");
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [viewingMoveIdx, setViewingMoveIdx] = useState<number | null>(null);
  const [evalScore, setEvalScore] = useState<number | null>(null);
  const [lockedWhite, setLockedWhite] = useState<ModelSize | null>(null);
  const [lockedBlack, setLockedBlack] = useState<ModelSize | null>(null);
  const [temperature, setTemperature] = useState(1.0);
  const [highlights, setHighlights] = useState<Record<string, React.CSSProperties>>({});
  const stopRef = useRef(false);
  const moveListRef = useRef<HTMLDivElement>(null);
  const temperatureRef = useRef(temperature);
  useEffect(() => { temperatureRef.current = temperature; }, [temperature]);

  useEffect(() => {
    if (viewingMoveIdx === null && moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [moveHistory, viewingMoveIdx]);

  const runMatch = useCallback(async () => {
    const g = new Chess();
    const white = whiteModel;
    const black = blackModel;
    setLockedWhite(white);
    setLockedBlack(black);
    setGame(new Chess());
    setMoveHistory([]);
    setEvalScore(null);
    setViewingMoveIdx(null);
    setRunning(true);
    stopRef.current = false;
    setStatus("Match in progress...");

    const history: MoveRecord[] = [];
    let moveCount = 0;
    const maxMoves = 200;

    while (!g.isGameOver() && moveCount < maxMoves && !stopRef.current) {
      const currentModel = g.turn() === "w" ? white : black;
      try {
        const data = await predictMove(g.fen(), currentModel, temperatureRef.current);
        if (!data.move) break;

        let m;
        try { m = g.move(data.move); } catch { break; }
        if (!m) break;

        const record: MoveRecord = {
          san: m.san,
          fen: g.fen(),
          color: m.color as "w" | "b",
          eval: typeof data.eval === "number" ? data.eval : undefined,
        };
        history.push(record);
        setMoveHistory([...history]);
        setGame(new Chess(g.fen()));
        setEvalScore(record.eval ?? null);
        setViewingMoveIdx(null);
        moveCount++;
      } catch {
        setStatus("API error — match stopped");
        break;
      }

      await new Promise((r) => setTimeout(r, 400));
    }

    if (g.isCheckmate()) {
      const winner = g.turn() === "w" ? "Black" : "White";
      const winnerModel = g.turn() === "w" ? black : white;
      setStatus(`Checkmate! ${winner} (${winnerModel}) wins`);
    } else if (g.isDraw()) {
      setStatus("Draw!");
    } else if (stopRef.current) {
      setStatus("Match stopped");
    } else {
      setStatus(`Ended after ${moveCount} moves`);
    }

    setRunning(false);
    setLockedWhite(null);
    setLockedBlack(null);
  }, [whiteModel, blackModel]);

  function stopMatch() {
    stopRef.current = true;
  }

  function onRightClick({ square }: { piece: { pieceType: string } | null; square: string }) {
    setHighlights((prev) => {
      if (prev[square]) {
        const next = { ...prev };
        delete next[square];
        return next;
      }
      return { ...prev, [square]: { background: "rgba(220, 38, 38, 0.5)" } };
    });
  }

  // Value head outputs tanh: [-1, 1] where +1 = white winning, -1 = black winning
  function evalToWhitePercent(): number {
    if (evalScore === null) return 50;
    return ((Math.max(-1, Math.min(1, evalScore)) + 1) / 2) * 100;
  }

  const boardFen = viewingMoveIdx !== null ? moveHistory[viewingMoveIdx].fen : game.fen();
  const whitePercent = evalToWhitePercent();
  const isLocked = running;

  const movePairs: Array<[MoveRecord, MoveRecord | undefined]> = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push([moveHistory[i], moveHistory[i + 1]]);
  }

  function ModelSelector({ color, value, locked }: { color: "white" | "black"; value: ModelSize; locked: ModelSize | null }) {
    const activeVal = locked ?? value;
    const setter = color === "white" ? setWhiteModel : setBlackModel;
    return (
      <div className="px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500 flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded-full border ${color === "white" ? "bg-white border-zinc-400" : "bg-zinc-900 border-zinc-500"}`} />
            {color === "white" ? "White" : "Black"}
          </span>
        </div>
        <div className="flex gap-1.5">
          {(["small", "mid", "large"] as ModelSize[]).map((s) => (
            <button
              key={s}
              onClick={() => !isLocked && setter(s)}
              disabled={isLocked}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                activeVal === s
                  ? color === "white" ? "bg-white text-black" : "bg-zinc-600 text-white"
                  : isLocked ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2 text-center">Arena</h1>
      <p className="text-center text-zinc-400 mb-6 text-sm">Watch two Artoria models battle each other</p>

      <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">

        {/* Eval bar + Board */}
        <div className="flex gap-2 w-full max-w-[560px] lg:max-w-none lg:w-auto">
          {/* Vertical eval bar */}
          <div className="flex flex-col w-4 shrink-0 rounded-md overflow-hidden border border-zinc-700 self-stretch" title={`White: ${whitePercent.toFixed(0)}%`}>
            <div style={{ flex: `${100 - whitePercent} 0 0%` }} className="bg-zinc-900 transition-all duration-700" />
            <div style={{ flex: `${whitePercent} 0 0%` }} className="bg-white transition-all duration-700" />
          </div>

          {/* Board */}
          <div className="flex-1 lg:w-[560px] lg:flex-none">
            <Chessboard
              options={{
                position: boardFen,
                allowDragging: false,
                squareStyles: highlights,
                onSquareRightClick: onRightClick,
                boardStyle: {
                  borderRadius: "6px",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                },
                darkSquareStyle: { backgroundColor: "#779952" },
                lightSquareStyle: { backgroundColor: "#edeed1" },
              }}
            />
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 w-full lg:w-56">

          {/* Status */}
          <div className="px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <p className="text-xs text-zinc-500 mb-0.5">Status</p>
            <p className="font-medium text-sm">{running ? "⚔ " : ""}{status}</p>
          </div>

          {/* Eval value */}
          {evalScore !== null && (
            <div className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
              <p className="text-xs text-zinc-500">Eval</p>
              <p className="font-mono text-sm tabular-nums">
                {evalScore > 0 ? "+" : ""}{evalScore.toFixed(3)}
              </p>
            </div>
          )}

          {/* Model selectors */}
          <ModelSelector color="white" value={whiteModel} locked={lockedWhite} />
          <ModelSelector color="black" value={blackModel} locked={lockedBlack} />

          {/* Temperature */}
          <div className="px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-zinc-500">Temperature</span>
              <span className="text-xs font-mono text-zinc-400">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={temperature}
              disabled={running}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-blue-500 disabled:opacity-40"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-0.5">
              <span>focused</span>
              <span>random</span>
            </div>
          </div>

          {/* Start / Stop */}
          {!running ? (
            <button
              onClick={runMatch}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              Start Match
            </button>
          ) : (
            <button
              onClick={stopMatch}
              className="w-full px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors"
            >
              Stop
            </button>
          )}

          {/* Move history */}
          <div className="px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <p className="text-xs text-zinc-500 mb-2">Moves ({moveHistory.length})</p>
            <div ref={moveListRef} className="overflow-y-auto max-h-64">
              {movePairs.length === 0 ? (
                <p className="text-xs text-zinc-600 italic">No moves yet</p>
              ) : (
                <table className="w-full text-xs">
                  <tbody>
                    {movePairs.map(([white, black], i) => (
                      <tr key={i} className="hover:bg-zinc-800/40">
                        <td className="text-zinc-500 pr-1.5 w-6 py-0.5 select-none">{i + 1}.</td>
                        <td className="py-0.5">
                          <button
                            onClick={() => setViewingMoveIdx(i * 2)}
                            className={`font-mono px-1 py-0.5 rounded w-full text-left transition-colors ${
                              viewingMoveIdx === i * 2 ? "bg-blue-600 text-white" : "text-zinc-200 hover:bg-zinc-700"
                            }`}
                          >
                            {white.san}
                          </button>
                        </td>
                        <td className="py-0.5">
                          {black ? (
                            <button
                              onClick={() => setViewingMoveIdx(i * 2 + 1)}
                              className={`font-mono px-1 py-0.5 rounded w-full text-left transition-colors ${
                                viewingMoveIdx === i * 2 + 1 ? "bg-blue-600 text-white" : "text-zinc-200 hover:bg-zinc-700"
                              }`}
                            >
                              {black.san}
                            </button>
                          ) : <span />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {viewingMoveIdx !== null && (
              <button
                onClick={() => setViewingMoveIdx(null)}
                className="mt-2 w-full text-xs py-1 bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
              >
                ▶ Back to live
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
