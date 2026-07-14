FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates libatomic1 && \
    rm -rf /var/lib/apt/lists/*

# Download and install mise to /usr/local/bin so it is globally available in the $PATH
RUN curl https://mise.run | MISE_INSTALL_PATH=/usr/local/bin/mise sh
ENV PATH="/root/.local/share/mise/shims:$PATH"

CMD ["bash", "-c", "echo 'this image is designed to be extended, not run directly'; exit 1"]

WORKDIR /usr/src/app
