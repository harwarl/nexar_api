# ── Build stage ─────────────────────────────────────────────────────────────
FROM rust:1.90-slim-bookworm AS builder

# aws-lc-sys (pulled in by rustls) needs a C toolchain and cmake to build;
# utoipa-swagger-ui's build script downloads Swagger UI with curl.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake clang pkg-config curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build dependencies first against stub sources so they're cached until
# Cargo.toml / Cargo.lock change.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src \
    && echo "fn main() {}" > src/main.rs \
    && touch src/lib.rs \
    && cargo build --release --locked \
    && rm -rf src

COPY src ./src
# Bump mtimes so cargo rebuilds the real crate instead of the cached stub.
RUN touch src/main.rs src/lib.rs \
    && cargo build --release --locked

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --no-create-home nexar

# Binary is named after the Cargo package (`rust_be`).
COPY --from=builder /app/target/release/rust_be /usr/local/bin/nexar

USER nexar
# Config defaults HOST to 127.0.0.1, which is unreachable from outside the container.
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" || exit 1

CMD ["nexar"]
