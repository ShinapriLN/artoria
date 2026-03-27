FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

COPY api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY artoria/ /app/artoria/
COPY api/app.py /app/app.py

ENV MODEL_CACHE_DIR=/tmp/artoria-models
ENV PRELOAD_MODELS=small

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
