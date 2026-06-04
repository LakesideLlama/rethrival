// Chunk cache invalidation — shared by draw.js, world.js, save.js, actions.js
// draw.js registers the actual cache maps here to avoid circular imports.

const CHUNK_TILES = 8;

// These will be set by draw.js via registerChunkMaps()
let _chunkCache = null;
let _dirtyChunks = null;

export function registerChunkMaps(cache, dirty) {
  _chunkCache = cache;
  _dirtyChunks = dirty;
}

export function invalidateChunk(wx, wy) {
  if (!_dirtyChunks) return;
  const key = `${Math.floor(wx / CHUNK_TILES)},${Math.floor(wy / CHUNK_TILES)}`;
  _dirtyChunks.add(key);
}

export function invalidateAllChunks() {
  if (!_chunkCache || !_dirtyChunks) return;
  for (const key of _chunkCache.keys()) _dirtyChunks.add(key);
  _chunkCache.clear();
  _dirtyChunks.clear();
}
