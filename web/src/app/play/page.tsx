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
  pair: number;
};

type Settings = {
  sound: boolean;
  showLegalMoves: boolean;
  showCoordinates: boolean;
  temperature: number;
};

function playMoveSound(type: "move" | "capture" | "check", enabled: boolean) {
  if (!enabled) return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = type === "capture" ? 300 : type === "check" ? 600 : 440;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {}
}

export default function PlayPage() {
  const [game, setGame] = useState(new Chess());
  const [modelSize, setModelSize] = useState<ModelSize>("small");
  const [lockedModel, setLockedModel] = useState<ModelSize | null>(null);
  const [status, setStatus] = useState("Your turn (White)");
  const [evalScore, setEvalScore] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [viewingMoveIdx, setViewingMoveIdx] = useState<number | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    sound: true,
    showLegalMoves: true,
    showCoordinates: true,
    temperature: 1.0,
  });

  const moveListRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Auto-scroll move list to bottom when following live game
  useEffect(() => {
    if (viewingMoveIdx === null && moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [moveHistory, viewingMoveIdx]);

  const activeModel = lockedModel ?? modelSize;

  const makeAIMove = useCallback(
    async (currentGame: Chess, history: MoveRecord[], model: ModelSize) => {
      if (currentGame.isGameOver()) {
        setStatus(currentGame.isCheckmate() ? "Checkmate!" : currentGame.isDraw() ? "Draw!" : "Game over!");
        return;
      }

      setThinking(true);
      setStatus("AI is thinking...");

      try {
        const data = await predictMove(currentGame.fen(), model, settingsRef.current.temperature);
        if (data.move) {
          const move = currentGame.move(data.move);
          if (move) {
            playMoveSound(
              move.captured ? "capture" : currentGame.inCheck() ? "check" : "move",
              settingsRef.current.sound
            );
            const newHistory: MoveRecord[] = [
              ...history,
              { san: move.san, fen: currentGame.fen(), color: move.color as "w" | "b", pair: Math.ceil(history.length / 2) },
            ];
            setMoveHistory(newHistory);
            setGame(new Chess(currentGame.fen()));
            setEvalScore(typeof data.eval === "number" ? data.eval : null);
            setViewingMoveIdx(null);
            setStatus(currentGame.isGameOver()
              ? currentGame.isCheckmate() ? "Checkmate!" : currentGame.isDraw() ? "Draw!" : "Game over!"
              : "Your turn");
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
    []
  );

  function onDrop({ sourceSquare, targetSquare }: { piece: { pieceType: string; isSparePiece: boolean; position: string }; sourceSquare: string; targetSquare: string | null }) {
    if (thinking || !targetSquare || viewingMoveIdx !== null || game.isGameOver()) return false;

    const gameCopy = new Chess(game.fen());
    let move;
    try {
      move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    } catch {
      return false;
    }
    if (!move) return false;

    const model = lockedModel ?? modelSize;
    if (!lockedModel) setLockedModel(modelSize);

    playMoveSound(move.captured ? "capture" : gameCopy.inCheck() ? "check" : "move", settingsRef.current.sound);

    const newHistory: MoveRecord[] = [
      ...moveHistory,
      { san: move.san, fen: gameCopy.fen(), color: move.color as "w" | "b", pair: Math.floor(moveHistory.length / 2) },
    ];
    setMoveHistory(newHistory);
    setGame(new Chess(gameCopy.fen()));
    setSelectedSquare(null);
    setViewingMoveIdx(null);

    makeAIMove(gameCopy, newHistory, model);
    return true;
  }

  function onSquareClick({ square }: { piece: { pieceType: string } | null; square: string }) {
    if (thinking || viewingMoveIdx !== null || game.isGameOver()) return;

    // Try to complete a move if a square is already selected
    if (selectedSquare && selectedSquare !== square) {
      const gameCopy = new Chess(game.fen());
      let move;
      try { move = gameCopy.move({ from: selectedSquare, to: square, promotion: "q" }); } catch { /* invalid */ }
      if (move) {
        const model = lockedModel ?? modelSize;
        if (!lockedModel) setLockedModel(modelSize);
        playMoveSound(move.captured ? "capture" : gameCopy.inCheck() ? "check" : "move", settingsRef.current.sound);
        const newHistory: MoveRecord[] = [
          ...moveHistory,
          { san: move.san, fen: gameCopy.fen(), color: move.color as "w" | "b", pair: Math.floor(moveHistory.length / 2) },
        ];
        setMoveHistory(newHistory);
        setGame(new Chess(gameCopy.fen()));
        setSelectedSquare(null);
        makeAIMove(gameCopy, newHistory, model);
        return;
      }
    }

    const piece = game.get(square as Parameters<typeof game.get>[0]);
    if (piece && piece.color === "w") {
      setSelectedSquare(square === selectedSquare ? null : square);
    } else {
      setSelectedSquare(null);
    }
  }

  function getSquareStyles(): Record<string, React.CSSProperties> {
    const styles: Record<string, React.CSSProperties> = {};
    if (!settings.showLegalMoves || !selectedSquare || viewingMoveIdx !== null) return styles;

    const moves = game.moves({ square: selectedSquare as Parameters<typeof game.moves>[0] extends { square?: infer S } ? S : never, verbose: true });
    for (const m of moves) {
      const hasPiece = game.get(m.to as Parameters<typeof game.get>[0]);
      styles[m.to] = hasPiece
        ? { background: "radial-gradient(circle, rgba(0,0,0,0.25) 80%, transparent 80%)", borderRadius: "0" }
        : { background: "radial-gradient(circle, rgba(0,0,0,0.2) 35%, transparent 35%)" };
    }
    styles[selectedSquare] = { background: "rgba(255,255,0,0.35)" };
    return styles;
  }

  function resetGame() {
    setGame(new Chess());
    setStatus("Your turn (White)");
    setEvalScore(null);
    setThinking(false);
    setMoveHistory([]);
    setLockedModel(null);
    setViewingMoveIdx(null);
    setSelectedSquare(null);
  }

  // Value head outputs tanh: [-1, 1] where +1 = white winning, -1 = black winning
  function evalToWhitePercent(): number {
    if (evalScore === null) return 50;
    return ((Math.max(-1, Math.min(1, evalScore)) + 1) / 2) * 100;
  }

  const boardFen = viewingMoveIdx !== null ? moveHistory[viewingMoveIdx].fen : game.fen();
  const whitePercent = evalToWhitePercent();
  const isLive = viewingMoveIdx === null;

  // Group moves into pairs for the move list
  const movePairs: Array<[MoveRecord, MoveRecord | undefined]> = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push([moveHistory[i], moveHistory[i + 1]]);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Play Against Artoria</h1>

      <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">

        {/* Eval bar + Board */}
        <div className="flex gap-2 w-full max-w-[560px] lg:max-w-none lg:w-auto">
          {/* Vertical eval bar */}
          <div className="flex flex-col w-4 shrink-0 rounded-md overflow-hidden border border-zinc-700 self-stretch" title={`White: ${whitePercent.toFixed(0)}%`}>
            <div
              style={{ flex: `${100 - whitePercent} 0 0%` }}
              className="bg-zinc-900 transition-all duration-700"
            />
            <div
              style={{ flex: `${whitePercent} 0 0%` }}
              className="bg-white transition-all duration-700"
            />
          </div>

          {/* Board */}
          <div className="flex-1 lg:w-[560px] lg:flex-none">
            <Chessboard
              options={{
                position: boardFen,
                onPieceDrop: onDrop,
                onSquareClick,
                boardOrientation: "white",
                allowDragging: isLive && !game.isGameOver() && !thinking,
                showNotation: settings.showCoordinates,
                squareStyles: getSquareStyles(),
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
            <p className="font-medium text-sm">{thinking ? "⏳ " : ""}{status}</p>
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

          {/* Model selector */}
          <div className="px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <p className="text-xs text-zinc-500 mb-2">Model</p>
            <div className="flex gap-1.5">
              {(["small", "mid", "large"] as ModelSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => !lockedModel && setModelSize(size)}
                  disabled={!!lockedModel}
                  className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                    activeModel === size
                      ? "bg-blue-600 text-white"
                      : lockedModel
                      ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Move history */}
          <div className="px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col min-h-0">
            <p className="text-xs text-zinc-500 mb-2">Moves</p>
            <div ref={moveListRef} className="overflow-y-auto max-h-64 scrollbar-thin">
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
                              viewingMoveIdx === i * 2
                                ? "bg-blue-600 text-white"
                                : "text-zinc-200 hover:bg-zinc-700"
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
                                viewingMoveIdx === i * 2 + 1
                                  ? "bg-blue-600 text-white"
                                  : "text-zinc-200 hover:bg-zinc-700"
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

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={resetGame}
              className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
            >
              New Game
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showSettings ? "bg-blue-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              ⚙
            </button>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50">
              <p className="text-xs text-zinc-500 mb-3">Settings</p>
              {(
                [
                  { key: "sound", label: "Sound effects" },
                  { key: "showLegalMoves", label: "Legal move dots" },
                  { key: "showCoordinates", label: "Coordinates" },
                ] as const
              ).map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between py-1.5 cursor-pointer">
                  <span className="text-sm text-zinc-300">{label}</span>
                  <div
                    onClick={() => setSettings((s) => ({ ...s, [key]: !s[key] }))}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                      settings[key] ? "bg-blue-600" : "bg-zinc-600"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                        settings[key] ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </label>
              ))}
              <div className="py-1.5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-zinc-300">Temperature</span>
                  <span className="text-xs font-mono text-zinc-400">{settings.temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) => setSettings((s) => ({ ...s, temperature: parseFloat(e.target.value) }))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-zinc-600 mt-0.5">
                  <span>focused</span>
                  <span>random</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
