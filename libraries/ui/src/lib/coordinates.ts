/** A point on the globe: stored `{lon, lat, alt}` (or `[lon, lat, alt]`), shown `lat, lon`. */
export interface Coordinate {
  lon: number
  lat: number
  alt: number | null
}

export interface MapTiles {
  url: string
  attribution: string
}

let tiles: MapTiles = { url: '', attribution: '' }

/** The tile server a deployment names; the system runs behind a firewall, so no public one is assumed. */
export function configureMapTiles(config: MapTiles): void {
  tiles = { ...config }
}
export function mapTiles(): MapTiles {
  return tiles
}

export const DEFAULT_CENTER: [number, number] = [0, 0]
export const DEFAULT_ZOOM = 2
export const PICKED_ZOOM = 8
export const DEGREE_DECIMALS = 5

export function buildCoordinate(lon: number, lat: number, alt: number | null): Coordinate | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
  return { lon, lat, alt: alt !== null && Number.isFinite(alt) ? alt : null }
}

export function toCoordinate(value: unknown): Coordinate | null {
  if (Array.isArray(value)) {
    if (value.length < 2) return null
    const alt = value[2] === undefined || value[2] === null ? null : Number(value[2])
    return buildCoordinate(Number(value[0]), Number(value[1]), alt)
  }
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const alt = v.alt === undefined || v.alt === null ? null : Number(v.alt)
  return buildCoordinate(Number(v.lon), Number(v.lat), alt)
}

export function formatCoordinate(p: Coordinate): string {
  const base = `${p.lat.toFixed(DEGREE_DECIMALS)}, ${p.lon.toFixed(DEGREE_DECIMALS)}`
  return p.alt === null ? base : `${base} · ${p.alt} m`
}
