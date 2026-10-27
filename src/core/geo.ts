const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;

export type LatLon = { latitude: number; longitude: number };
export type XY = { x: number; y: number };

/**
 * Local flat projection (equirectangular) around an origin. Accurate to well
 * under 0.1 % over a few tens of km, which is enough for a driving session.
 * x points east, y points north, in meters.
 */
export function makeProjection(origin: LatLon) {
  const cosLat = Math.cos(origin.latitude * DEG);
  return {
    toXY(p: LatLon): XY {
      return {
        x: (p.longitude - origin.longitude) * DEG * EARTH_RADIUS_M * cosLat,
        y: (p.latitude - origin.latitude) * DEG * EARTH_RADIUS_M,
      };
    },
    toLatLon(p: XY): LatLon {
      return {
        latitude: origin.latitude + p.y / EARTH_RADIUS_M / DEG,
        longitude: origin.longitude + p.x / (EARTH_RADIUS_M * cosLat) / DEG,
      };
    },
  };
}

export function distanceXY(a: XY, b: XY): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Wraps an angle to (-π, π]. */
export function wrapAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r <= -Math.PI) r += 2 * Math.PI;
  if (r > Math.PI) r -= 2 * Math.PI;
  return r;
}
