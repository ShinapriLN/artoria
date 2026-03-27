import torch
import torch.nn as nn
import torch.nn.functional as F
from dataclasses import dataclass


@dataclass
class ChessModelConfig:
    vocab_size: int = 256
    d_model: int = 256
    n_layers: int = 8
    n_heads: int = 8
    max_seq_len: int = 79
    num_classes: int = 128
    dropout: float = 0.0
    epsilon: float = 1e-5


class RMSNorm(nn.Module):
    def __init__(self, d_model: int, eps: float = 1e-5):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(d_model))

    def forward(self, x):
        norm_x = x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps)
        return self.weight * norm_x


class SwiGLU(nn.Module):
    def __init__(self, d_model: int):
        super().__init__()
        hidden_dim = int(2 * (4 * d_model) / 3)
        self.w1 = nn.Linear(d_model, hidden_dim, bias=False)
        self.w2 = nn.Linear(d_model, hidden_dim, bias=False)
        self.w3 = nn.Linear(hidden_dim, d_model, bias=False)

    def forward(self, x):
        return self.w3(F.silu(self.w1(x)) * self.w2(x))


class TransformerBlock(nn.Module):
    def __init__(self, config: ChessModelConfig):
        super().__init__()
        self.attention_norm = RMSNorm(config.d_model, config.epsilon)
        self.attention = nn.MultiheadAttention(
            embed_dim=config.d_model,
            num_heads=config.n_heads,
            dropout=config.dropout,
            batch_first=True
        )
        self.ffn_norm = RMSNorm(config.d_model, config.epsilon)
        self.ffn = SwiGLU(config.d_model)

    def forward(self, x):
        h = self.attention_norm(x)
        attn_out, _ = self.attention(h, h, h, need_weights=False, attn_mask=None)
        x = x + attn_out

        h = self.ffn_norm(x)
        ffn_out = self.ffn(h)
        x = x + ffn_out
        return x


class GrandmasterChessModel(nn.Module):
    def __init__(self, config: ChessModelConfig):
        super().__init__()
        self.config = config
        self.token_embedding = nn.Embedding(config.vocab_size, config.d_model)
        self.position_embedding = nn.Embedding(config.max_seq_len, config.d_model)
        self.layers = nn.ModuleList([
            TransformerBlock(config) for _ in range(config.n_layers)
        ])
        self.final_norm = RMSNorm(config.d_model, config.epsilon)
        self.output_head = nn.Linear(config.d_model, config.num_classes, bias=False)
        self.value_head = nn.Sequential(
            nn.Linear(config.d_model, config.d_model),
            nn.ReLU(),
            nn.Linear(config.d_model, 1),
            nn.Tanh()
        )

    def forward(self, x):
        B, T = x.size()
        position_ids = torch.arange(T, device=x.device).unsqueeze(0)
        x = self.token_embedding(x) + self.position_embedding(position_ids)

        for layer in self.layers:
            x = layer(x)

        x = self.final_norm(x)
        x_pool = x.mean(dim=1)
        logits = self.output_head(x_pool)
        value = self.value_head(x_pool)
        return logits, value
