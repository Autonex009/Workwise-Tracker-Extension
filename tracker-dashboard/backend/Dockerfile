FROM python:3.12-slim

WORKDIR /app

# System deps for psycopg2-binary + bcrypt (both ship wheels, but keep libpq
# available in case we ever swap to psycopg2 source builds).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first for layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Railway injects PORT at runtime. Uvicorn honors it via the shell form below.
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
