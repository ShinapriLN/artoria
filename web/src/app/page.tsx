import Link from "next/link";

const features = [
  {
    title: "No Search",
    desc: "Pure neural network policy — no MCTS, no Alpha-Beta, no search tree.",
  },
  {
    title: "Transformer Architecture",
    desc: "LLaMA-style decoder with RMSNorm, SwiGLU, and bidirectional attention.",
  },
  {
    title: "Behavioral Cloning",
    desc: "Trained to imitate strong players directly from millions of chess games.",
  },
  {
    title: "Dual Head",
    desc: "Policy head for move prediction + Value head for position evaluation.",
  },
  {
    title: "Multiple Scales",
    desc: "Small (19M), Mid (100M), and Large (500M) parameter variants.",
  },
  {
    title: "Instant Inference",
    desc: "Single forward pass per move — no thinking time, no depth limits.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      <section className="w-full max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
          Artoria<span className="text-blue-400">Zero</span>
        </h1>
        <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
          Grandmaster-Level Chess Without Search. A decoder-only transformer
          that plays chess through pure pattern recognition.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/play"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
          >
            Play Against AI
          </Link>
          <Link
            href="/about"
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors"
          >
            Learn More
          </Link>
        </div>
      </section>

      <section className="w-full max-w-5xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50"
            >
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full max-w-3xl mx-auto px-4 pb-24">
        <h2 className="text-2xl font-bold mb-6 text-center">Model Variants</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3 text-left">Variant</th>
                <th className="px-4 py-3 text-left">d_model</th>
                <th className="px-4 py-3 text-left">Layers</th>
                <th className="px-4 py-3 text-left">Heads</th>
                <th className="px-4 py-3 text-left">Params</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              <tr>
                <td className="px-4 py-3 font-medium">Small</td>
                <td className="px-4 py-3">256</td>
                <td className="px-4 py-3">8</td>
                <td className="px-4 py-3">8</td>
                <td className="px-4 py-3">~19M</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Mid</td>
                <td className="px-4 py-3">512</td>
                <td className="px-4 py-3">16</td>
                <td className="px-4 py-3">8</td>
                <td className="px-4 py-3">~100M</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Large</td>
                <td className="px-4 py-3">1024</td>
                <td className="px-4 py-3">40</td>
                <td className="px-4 py-3">32</td>
                <td className="px-4 py-3">~500M</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
