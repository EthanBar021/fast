import type { CalibrationFailure, CalibrationResult } from './calibration';

/** Explicit states of a measurement. Pure reducer: no sensor or React code here. */
export type SessionState =
  | { status: 'idle' }
  | { status: 'calibrating' }
  | { status: 'ready'; calibration: CalibrationResult }
  | { status: 'measuring'; calibration: CalibrationResult; startedAt: number }
  | { status: 'finished'; sessionId: string | null }
  | { status: 'cancelled' }
  | { status: 'error'; reason: CalibrationFailure | 'permission' | 'save' | 'sensor' };

export type SessionEvent =
  | { type: 'CALIBRATE' }
  | { type: 'CALIBRATED'; calibration: CalibrationResult }
  | { type: 'CALIBRATION_FAILED'; reason: CalibrationFailure }
  | { type: 'START'; at: number }
  | { type: 'STOP' }
  | { type: 'SAVED'; sessionId: string }
  | { type: 'CANCEL' }
  | { type: 'FAIL'; reason: Extract<SessionState, { status: 'error' }>['reason'] }
  | { type: 'RESET' };

export const INITIAL_STATE: SessionState = { status: 'idle' };

/** Invalid transitions are ignored (the state is returned unchanged). */
export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'CALIBRATE':
      // Allowed to (re)calibrate any time before the measurement starts.
      return state.status === 'idle' || state.status === 'ready' || state.status === 'error'
        ? { status: 'calibrating' }
        : state;
    case 'CALIBRATED':
      return state.status === 'calibrating' ? { status: 'ready', calibration: event.calibration } : state;
    case 'CALIBRATION_FAILED':
      return state.status === 'calibrating' ? { status: 'error', reason: event.reason } : state;
    case 'START':
      return state.status === 'ready'
        ? { status: 'measuring', calibration: state.calibration, startedAt: event.at }
        : state;
    case 'STOP':
      return state.status === 'measuring' ? { status: 'finished', sessionId: null } : state;
    case 'SAVED':
      return state.status === 'finished' ? { status: 'finished', sessionId: event.sessionId } : state;
    case 'CANCEL':
      return state.status === 'finished' || state.status === 'cancelled' ? state : { status: 'cancelled' };
    case 'FAIL':
      return { status: 'error', reason: event.reason };
    case 'RESET':
      return INITIAL_STATE;
  }
}
