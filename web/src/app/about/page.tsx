export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-8">About Artoria Zero</h1>

      <div className="prose prose-invert prose-zinc max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-3">Overview</h2>
          <p className="text-zinc-400 leading-relaxed">
            Artoria Zero is a chess engine that plays at a strong level without
            any search algorithm. Unlike traditional engines (Stockfish with
            Alpha-Beta) or AlphaZero (with MCTS), Artoria predicts the best move
            in a single forward pass through a neural network.
          </p>
          <p className="text-zinc-400 leading-relaxed mt-3">
            Based on the approach described in{" "}
            <a
              href="https://arxiv.org/abs/2402.04494"
              className="text-blue-400 hover:text-blue-300 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              &ldquo;Grandmaster-Level Chess Without Search&rdquo;
            </a>{" "}
            (arXiv:2402.04494), the model is trained via behavioral cloning —
            learning to imitate moves played by strong human players.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Architecture</h2>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 font-mono text-sm text-zinc-300 overflow-x-auto">
            <pre>{`FEN String (board state)
    |
    v
[ASCII Tokenizer] -> 79 tokens
    |
    v
[Token Embedding] + [Positional Embedding]
    |
    v
[N x Transformer Block]
  ├─ RMSNorm -> Multi-Head Attention (bidirectional)
  └─ RMSNorm -> SwiGLU FFN
    |
    v
[Mean Pooling] -> board representation
    |
    ├──> [Policy Head] -> move logits (~4544 classes)
    └──> [Value Head]  -> position eval [-1, 1]`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Key Design Choices</h2>
          <ul className="space-y-2 text-zinc-400">
            <li className="flex gap-2">
              <span className="text-blue-400 shrink-0">-</span>
              <span>
                <strong className="text-zinc-200">No causal masking</strong> —
                The model sees the entire board state at once (bidirectional
                attention), unlike language models.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 shrink-0">-</span>
              <span>
                <strong className="text-zinc-200">RMSNorm + SwiGLU</strong> —
                LLaMA-style pre-normalization and gated linear units for stable
                deep training.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 shrink-0">-</span>
              <span>
                <strong className="text-zinc-200">Mean pooling</strong> — The
                whole sequence is pooled into a single board representation, not
                just the last token.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 shrink-0">-</span>
              <span>
                <strong className="text-zinc-200">Dual head</strong> — Policy
                loss (cross-entropy) + Value loss (MSE) are trained jointly.
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Training</h2>
          <p className="text-zinc-400 leading-relaxed">
            Models are trained on the Lichess standard chess games dataset via
            streaming. Each position in each game becomes a training sample where
            the input is the FEN and the target is the move actually played. Game
            results provide the value target (1.0 for white win, -1.0 for black
            win, 0.0 for draw).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Links</h2>
          <ul className="space-y-2 text-zinc-400">
            <li>
              Models:{" "}
              <a
                href="https://huggingface.co/Shinapri/artoria-zero"
                className="text-blue-400 hover:text-blue-300 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Shinapri/artoria-zero
              </a>
            </li>
            <li>
              Source:{" "}
              <a
                href="https://github.com/ShinapriLN/artoria"
                className="text-blue-400 hover:text-blue-300 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                ShinapriLN/artoria
              </a>
            </li>
            <li>
              Paper:{" "}
              <a
                href="https://arxiv.org/abs/2402.04494"
                className="text-blue-400 hover:text-blue-300 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                arXiv:2402.04494
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
