import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { requireAdmin } from './admin.js';
import { AuthenticatedRequest } from '../types/index.js';

describe('Admin Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockReq = {};
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = vi.fn();
  });

  describe('requireAdmin', () => {
    it('should return 401 if no user is attached to request', () => {
      requireAdmin(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not an admin', () => {
      mockReq.user = { userId: 'user-123', role: 'USER' };

      requireAdmin(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next if user is an admin', () => {
      mockReq.user = { userId: 'admin-123', role: 'ADMIN' };

      requireAdmin(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should handle undefined role gracefully', () => {
      mockReq.user = { userId: 'user-123' } as any;

      requireAdmin(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
