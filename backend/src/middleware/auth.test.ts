import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, optionalAuth } from './auth.js';
import { AuthenticatedRequest } from '../types/index.js';

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key',
    },
  },
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = vi.fn();
  });

  describe('authenticate', () => {
    it('should return 401 if no authorization header', () => {
      authenticate(
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

    it('should return 401 if authorization header does not start with Bearer', () => {
      mockReq.headers = { authorization: 'Basic token123' };

      authenticate(
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

    it('should return 401 if token is invalid', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      authenticate(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token is expired', () => {
      const expiredToken = jwt.sign(
        { userId: 'user-123', role: 'USER' },
        'test-secret-key',
        { expiresIn: '-1h' }
      );
      mockReq.headers = { authorization: `Bearer ${expiredToken}` };

      authenticate(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next and attach user to request if token is valid', () => {
      const validToken = jwt.sign(
        { userId: 'user-123', role: 'USER' },
        'test-secret-key',
        { expiresIn: '1h' }
      );
      mockReq.headers = { authorization: `Bearer ${validToken}` };

      authenticate(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthenticatedRequest).user).toBeDefined();
      expect((mockReq as AuthenticatedRequest).user?.userId).toBe('user-123');
      expect((mockReq as AuthenticatedRequest).user?.role).toBe('USER');
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should work with admin role', () => {
      const adminToken = jwt.sign(
        { userId: 'admin-123', role: 'ADMIN' },
        'test-secret-key',
        { expiresIn: '1h' }
      );
      mockReq.headers = { authorization: `Bearer ${adminToken}` };

      authenticate(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthenticatedRequest).user?.role).toBe('ADMIN');
    });
  });

  describe('optionalAuth', () => {
    it('should call next without user if no authorization header', () => {
      optionalAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthenticatedRequest).user).toBeUndefined();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should call next without user if authorization header is invalid format', () => {
      mockReq.headers = { authorization: 'Basic token123' };

      optionalAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthenticatedRequest).user).toBeUndefined();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should call next without user if token is invalid', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      optionalAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthenticatedRequest).user).toBeUndefined();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should call next and attach user if token is valid', () => {
      const validToken = jwt.sign(
        { userId: 'user-123', role: 'USER' },
        'test-secret-key',
        { expiresIn: '1h' }
      );
      mockReq.headers = { authorization: `Bearer ${validToken}` };

      optionalAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthenticatedRequest).user).toBeDefined();
      expect((mockReq as AuthenticatedRequest).user?.userId).toBe('user-123');
      expect(statusMock).not.toHaveBeenCalled();
    });
  });
});
