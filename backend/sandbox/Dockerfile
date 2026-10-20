# OAA Sandbox image — isolated dry-run & pytest verification environment
# (Nodes 6 & 8). Built and used by the DockerDriver only when MOCK_ENV=false
# and a Docker daemon is reachable; the MockDriver (default) never builds this.
FROM python:3.11-slim

WORKDIR /sandbox

RUN pip install --no-cache-dir pytest

CMD ["pytest", "-q"]
