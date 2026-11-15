import {spawn} from 'node:child_process';
import path from 'node:path';
import type {GeospatialIngestionPayload} from './aiAnalysis.ts';

export interface GeospatialIngestRequest {
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
  polygon?: Record<string, unknown>;
  sources?: string[];
  forceRefresh?: boolean;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const ingestCache = new Map<
  string,
  {expiresAt: number; payload: GeospatialIngestionPayload}
>();

function makeCacheKey(req: GeospatialIngestRequest): string {
  const bboxStr = req.bbox
    ? req.bbox.map((n) => n.toFixed(4)).join(',')
    : 'auto';
  const polyStr = req.polygon ? JSON.stringify(req.polygon) : 'none';
  const srcStr = (req.sources ?? ['planetary_computer', 'earthdata', 'soilgrids'])
    .slice()
    .sort()
    .join(',');
  return `${req.lat.toFixed(4)}:${req.lon.toFixed(4)}:${bboxStr}:${polyStr}:${srcStr}`;
}

export async function runPythonGeospatialIngestion(
  req: GeospatialIngestRequest,
  timeoutMs = 150_000
): Promise<GeospatialIngestionPayload> {
  const key = makeCacheKey(req);
  if (!req.forceRefresh) {
    const hit = ingestCache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.payload;
    }
  }

  const args = [
    '-m',
    'python_ingestion.ingest',
    '--lat',
    String(req.lat),
    '--lon',
    String(req.lon),
  ];
  if (req.bbox && req.bbox.length === 4) {
    args.push('--bbox', JSON.stringify(req.bbox));
  }
  if (req.polygon) {
    args.push('--polygon', JSON.stringify(req.polygon));
  }
  if (req.sources?.length) {
    args.push('--sources', req.sources.join(','));
  }

  const payload = await new Promise<GeospatialIngestionPayload>(
    (resolve, reject) => {
      const proc = spawn('python3', args, {
        cwd: path.resolve(process.cwd()),
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          GDAL_DISABLE_READDIR_ON_OPEN: 'EMPTY_DIR',
          CPL_VSIL_CURL_ALLOWED_EXTENSIONS: '.vrt,.tif',
          GDAL_HTTP_MAX_RETRY: '2',
          GDAL_HTTP_RETRY_DELAY: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        proc.kill('SIGTERM');
        reject(
          new Error(
            `Python geospatial ingestion timed out after ${Math.round(
              timeoutMs / 1000
            )}s`
          )
        );
      }, timeoutMs);

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      proc.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to launch python3 ingestion: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          reject(
            new Error(
              `Python ingestion exited with code ${code}: ${
                stderr.trim().slice(-400) || stdout.trim().slice(-400)
              }`
            )
          );
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim()) as GeospatialIngestionPayload;
          resolve(parsed);
        } catch (err) {
          reject(
            new Error(
              `Invalid JSON from Python ingestion: ${
                err instanceof Error ? err.message : String(err)
              }`
            )
          );
        }
      });
    }
  );

  ingestCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload,
  });

  return payload;
}
