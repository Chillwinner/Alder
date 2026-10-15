FROM docker.m.daocloud.io/library/debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i 's/deb.debian.org/mirrors.aliyun.com/g; s/security.debian.org/mirrors.aliyun.com/g' \
        /etc/apt/sources.list.d/debian.sources; \
    fi \
    && apt-get update \
    && apt-get install -y --no-install-recommends libicu72 python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY officecli-linux-x64 /usr/local/bin/officecli
COPY serve.py /opt/serve.py
RUN chmod +x /usr/local/bin/officecli && officecli --version
ENV PORT=8787
EXPOSE 8787
CMD ["python3", "-u", "/opt/serve.py"]
