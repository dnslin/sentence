# Docker deployment

This project is intended to be self-hosted with Docker Compose on a single machine (local or VPS). It runs two services from the same image:

- `web` — the Next.js app on port `3000`.
- `worker` — the ready-card pool replenishment loop.

Both services share a single named Docker volume for the SQLite database and generated WebP files.

## Requirements

- Docker with Compose support (Docker Compose v2).
- Node.js is only required on the host if you want to run local development commands; the containers use Node.js 22.

## Configuration

Create a `.env` file in the project root:

```text
XAI_API_KEY=your_xai_api_key
XAI_BASE_URL=                       # optional, defaults to https://api.x.ai/v1
JUHUA_ADMIN_TOKEN=your_secret_token # optional, for /api/admin/status
```

`XAI_API_KEY` is required for the worker to generate new illustrations.

## Build and run

```bash
# Build the image
docker compose -f docker/docker-compose.yml build

# Start both services in the background
docker compose -f docker/docker-compose.yml up -d

# View logs
docker compose -f docker/docker-compose.yml logs -f
```

The web service is now available at `http://localhost:3000`.

## Database migrations and seeding

The web container automatically runs `pnpm db:setup` on startup, which applies pending migrations in `drizzle/` and seeds the stable ready cards if needed. Because both services share the same named volume, the worker uses the same database file.

## Data persistence

A named volume `juhua-data` is mounted to `/app/data` in both containers. This preserves:

- `data/juhua.sqlite` (SQLite database, default path)
- `data/generated-illustrations/` (generated WebP files)

Stopping or recreating containers does not erase this data. To wipe it intentionally:

```bash
docker compose -f docker/docker-compose.yml down -v
```

## Useful commands

```bash
# Stop all services
docker compose -f docker/docker-compose.yml down

# Restart only the worker
docker compose -f docker/docker-compose.yml restart worker

# Inspect the data volume path
docker volume inspect docker_juhua-data
```

## CI-built images

When a semantic version tag such as `v1.2.3` is pushed, `.github/workflows/release.yml` automatically builds and pushes a `linux/amd64` image to GitHub Container Registry. The published image coordinates follow the repository name:

```text
ghcr.io/<owner>/sentence:v1.2.3
ghcr.io/<owner>/sentence:latest
```

To use the pre-built image on a VPS instead of building locally, change the services in `docker/docker-compose.yml` from:

```yaml
    build:
      context: ..
      dockerfile: docker/Dockerfile
```

to:

```yaml
    image: ghcr.io/<owner>/sentence:v1.2.3
```

and remove the `build:` block. Make sure both `web` and `worker` services use the same image tag. The persisted `juhua-data` volume and `.env` configuration remain the same.

## Upgrades

1. Pull or apply the new source code.
2. Rebuild the image: `docker compose -f docker/docker-compose.yml build --no-cache`.
3. Start services: `docker compose -f docker/docker-compose.yml up -d`.
4. The web container will automatically run migrations on startup.

## Notes

- The `web` service is the only service that exposes a port. The worker is internal-only.
- Do not mount the repository's local `data/` directory directly into the container unless you want the build-machine data to override production data.
