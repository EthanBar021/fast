/** Where the data comes from. Demo sessions are simulated and always labelled as such. */
export type SessionSource = 'device' | 'demo';

export type QualityLevel = 'good' | 'fair' | 'poor' | 'invalid';

/** How the phone axes were matched to the vehicle axes. */
export type AlignmentMethod = 'gps' | 'mounting';

/** One GPS fix. `t` is in ms since the start of the session. */
export interface GpsFix {
  t: number;
  latitude: number;
  longitude: number;
  /** m/s; null when iOS reports no valid speed. */
  speed: number | null;
  /** Horizontal accuracy radius, m. */
  accuracy: number | null;
}

/**
 * Raw recording, as captured. Motion values are expressed in the horizontal/vertical
 * basis built at calibration (h1 ≈ assumed forward, h2 ≈ assumed lateral, up), in m/s².
 */
export interface RawRecording {
  startedAt: number;
  durationMs: number;
  motion: { t: number[]; h1: number[]; h2: number[]; up: number[] };
  gps: GpsFix[];
  /** Intervals (ms since start) during which the app was in the background. */
  interruptions: { from: number; to: number }[];
  /** Largest tilt change of the phone versus calibration, degrees. */
  maxTiltDriftDeg: number;
  source: SessionSource;
  /** Calibration used for this recording (absent for demo data). */
  calibration?: RecordingCalibration;
  /** Requested DeviceMotion interval, ms. */
  motionIntervalMs?: number;
}

export type Vec3 = { x: number; y: number; z: number };

export interface RecordingCalibration {
  gravity: Vec3;
  basis: { up: Vec3; forward: Vec3; left: Vec3 };
  tiltDeg: number;
  noise: number;
  samples: number;
}

/** Everything needed to re-process or analyse a recording later. */
export interface RecordingMeta {
  startedAt: number;
  durationMs: number;
  interruptions: { from: number; to: number }[];
  maxTiltDriftDeg: number;
  calibration: RecordingCalibration | null;
  motionIntervalMs: number | null;
}

export interface RawData {
  motion: RawRecording['motion'];
  meta: RecordingMeta;
}

/** All accelerations in m/s², speeds in m/s, distances in m, durations in ms. */
export interface SessionSummary {
  durationMs: number;
  movingTimeMs: number;
  distanceM: number;
  maxSpeed: number;
  /** distance / total duration */
  avgSpeed: number;
  /** distance / time spent above 1 m/s */
  movingAvgSpeed: number;
  peakAccel: number;
  /** Largest deceleration, as a positive number. */
  peakBrake: number;
  peakLatLeft: number;
  peakLatRight: number;
  peakCombined: number;
  /** Mean of |longitudinal| while moving. */
  meanAbsLong: number;
  /** Mean of |lateral| while moving. */
  meanAbsLat: number;
  alignment: AlignmentMethod;
  alignmentR2: number;
  gpsFixes: number;
  gpsMedianIntervalMs: number | null;
  gpsMedianAccuracyM: number | null;
  motionRateHz: number | null;
  quality: QualityLevel;
  warnings: string[];
}

export interface Session {
  id: string;
  startedAt: number;
  source: SessionSource;
  summary: SessionSummary;
}

/** Processed series on a regular grid (10 Hz), used for charts and the map. */
export interface SessionSeries {
  t: Float64Array;
  speed: Float64Array;
  long: Float64Array;
  lat: Float64Array;
  latitude: Float64Array;
  longitude: Float64Array;
}
