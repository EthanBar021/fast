import type { CalibrationResult } from './calibration';
import { INITIAL_STATE, sessionReducer, type SessionEvent, type SessionState } from './sessionMachine';

const calibration = { noise: 0.02, tiltDeg: 10, samples: 100 } as CalibrationResult;

function run(events: SessionEvent[], from: SessionState = INITIAL_STATE): SessionState {
  return events.reduce(sessionReducer, from);
}

describe('sessionReducer', () => {
  it('follows the normal path idle → calibrating → ready → measuring → finished', () => {
    const s = run([
      { type: 'CALIBRATE' },
      { type: 'CALIBRATED', calibration },
      { type: 'START', at: 1000 },
      { type: 'STOP' },
      { type: 'SAVED', sessionId: 'abc' },
    ]);
    expect(s).toEqual({ status: 'finished', sessionId: 'abc' });
  });

  it('cannot start without a successful calibration', () => {
    expect(run([{ type: 'START', at: 0 }]).status).toBe('idle');
    expect(run([{ type: 'CALIBRATE' }, { type: 'START', at: 0 }]).status).toBe('calibrating');
  });

  it('goes to error when calibration fails, and allows retrying', () => {
    const failed = run([{ type: 'CALIBRATE' }, { type: 'CALIBRATION_FAILED', reason: 'unstable' }]);
    expect(failed).toEqual({ status: 'error', reason: 'unstable' });
    expect(sessionReducer(failed, { type: 'CALIBRATE' }).status).toBe('calibrating');
  });

  it('allows recalibrating when ready, but not while measuring', () => {
    const ready = run([{ type: 'CALIBRATE' }, { type: 'CALIBRATED', calibration }]);
    expect(sessionReducer(ready, { type: 'CALIBRATE' }).status).toBe('calibrating');
    const measuring = sessionReducer(ready, { type: 'START', at: 0 });
    expect(sessionReducer(measuring, { type: 'CALIBRATE' }).status).toBe('measuring');
  });

  it('cancels a running measurement but not a finished one', () => {
    const measuring = run([{ type: 'CALIBRATE' }, { type: 'CALIBRATED', calibration }, { type: 'START', at: 0 }]);
    expect(sessionReducer(measuring, { type: 'CANCEL' }).status).toBe('cancelled');
    const finished = sessionReducer(measuring, { type: 'STOP' });
    expect(sessionReducer(finished, { type: 'CANCEL' }).status).toBe('finished');
  });

  it('ignores a duplicated STOP', () => {
    const measuring = run([{ type: 'CALIBRATE' }, { type: 'CALIBRATED', calibration }, { type: 'START', at: 0 }]);
    const saved = run([{ type: 'STOP' }, { type: 'SAVED', sessionId: 'x' }, { type: 'STOP' }], measuring);
    expect(saved).toEqual({ status: 'finished', sessionId: 'x' });
  });
});
