import { describe, it, expect } from 'vitest';
import { AgentPhase, LogLevel } from '../types';

describe('Types', () => {
  describe('AgentPhase', () => {
    it('should have all required phases', () => {
      expect(AgentPhase.IDLE).toBe('IDLE');
      expect(AgentPhase.INGESTION).toBe('INGESTION');
      expect(AgentPhase.PLANNING).toBe('PLANNING');
      expect(AgentPhase.EXECUTION).toBe('EXECUTION');
      expect(AgentPhase.OBSERVATION).toBe('OBSERVATION');
      expect(AgentPhase.VERIFICATION).toBe('VERIFICATION');
      expect(AgentPhase.DELIVERY).toBe('DELIVERY');
    });
  });

  describe('LogLevel', () => {
    it('should have all required log levels', () => {
      expect(LogLevel.INFO).toBe('INFO');
      expect(LogLevel.SUCCESS).toBe('SUCCESS');
      expect(LogLevel.WARN).toBe('WARN');
      expect(LogLevel.ERROR).toBe('ERROR');
      expect(LogLevel.THOUGHT).toBe('THOUGHT');
    });
  });
});
