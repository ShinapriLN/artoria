const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://shinapri-artoria-zero.hf.space";

export async function predictMove(fen: string, modelSize: string = "small", temperature: number = 1.0) {
  const res = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fen, model_size: modelSize, temperature }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<{
    move: string | null;
    status: string;
    eval: number;
    game_over?: boolean;
  }>;
}

export async function getModels() {
  const res = await fetch(`${API_URL}/models`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<{ models: string[] }>;
}
