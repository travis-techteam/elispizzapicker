import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index.js';
import prisma from '../utils/prisma.js';
import { smsService } from './sms.service.js';
import { emailService } from './email.service.js';
import { JwtPayload } from '../types/index.js';

interface AuthResult {
  success: boolean;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    role: string;
  };
}

export class AuthService {
  // Generate a 6-digit code for SMS
  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Generate a secure token for magic links
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Hash a token/code for storage
  async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  // Verify a token/code against hash
  async verifyToken(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }

  // Generate JWT access token
  generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload as object, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions);
  }

  // Generate JWT refresh token
  generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload as object, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as SignOptions);
  }

  // Request SMS code
  async requestSmsCode(phone: string): Promise<AuthResult> {
    // Find user by phone
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return { success: false, error: 'User not found. Please contact an admin for an invite.' };
    }

    // Generate code
    const code = this.generateCode();
    const hashedCode = await this.hashToken(code);

    // Delete any existing tokens for this user
    await prisma.authToken.deleteMany({
      where: {
        userId: user.id,
        type: 'SMS_CODE',
      },
    });

    // Create new auth token
    await prisma.authToken.create({
      data: {
        userId: user.id,
        token: hashedCode,
        type: 'SMS_CODE',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    // Send SMS
    const smsResult = await smsService.sendVerificationCode(phone, code);

    if (!smsResult.success) {
      // For development, log the code
      if (config.nodeEnv === 'development') {
        console.log(`DEV MODE - Verification code for ${phone}: ${code}`);
      }
      return {
        success: true,
        error: config.nodeEnv === 'development'
          ? `SMS not sent (check console for code)`
          : 'SMS service unavailable. Try magic link instead.',
      };
    }

    return { success: true };
  }

  // Request magic link
  async requestMagicLink(email: string): Promise<AuthResult> {
    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      return { success: false, error: 'User not found. Please contact an admin for an invite.' };
    }

    // Generate token
    const token = this.generateToken();
    const hashedToken = await this.hashToken(token);

    // Delete any existing magic link tokens for this user
    await prisma.authToken.deleteMany({
      where: {
        userId: user.id,
        type: 'MAGIC_LINK',
      },
    });

    // Create new auth token
    await prisma.authToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        type: 'MAGIC_LINK',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    // Send email
    const emailResult = await emailService.sendMagicLink(email, token);

    if (!emailResult.success) {
      if (config.nodeEnv === 'development') {
        console.log(`DEV MODE - Magic link token for ${email}: ${token}`);
      }
      return {
        success: true,
        error: config.nodeEnv === 'development'
          ? `Email not sent (check console for token)`
          : 'Email service unavailable.',
      };
    }

    return { success: true };
  }

  // Verify SMS code
  async verifySmsCode(phone: string, code: string): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Find valid auth token
    const authToken = await prisma.authToken.findFirst({
      where: {
        userId: user.id,
        type: 'SMS_CODE',
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!authToken) {
      return { success: false, error: 'Invalid or expired code' };
    }

    // Verify code
    const isValid = await this.verifyToken(code, authToken.token);

    if (!isValid) {
      return { success: false, error: 'Invalid code' };
    }

    // Mark token as used
    await prisma.authToken.update({
      where: { id: authToken.id },
      data: { used: true },
    });

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWTs
    const payload: JwtPayload = { userId: user.id, role: user.role };
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    };
  }

  // Verify magic link token
  async verifyMagicLink(token: string): Promise<AuthResult> {
    // Find all unused, non-expired magic link tokens
    const authTokens = await prisma.authToken.findMany({
      where: {
        type: 'MAGIC_LINK',
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    // Check each token (since we hash them)
    for (const authToken of authTokens) {
      const isValid = await this.verifyToken(token, authToken.token);

      if (isValid) {
        // Mark token as used
        await prisma.authToken.update({
          where: { id: authToken.id },
          data: { used: true },
        });

        // Update last login time
        await prisma.user.update({
          where: { id: authToken.user.id },
          data: { lastLoginAt: new Date() },
        });

        // Generate JWTs
        const payload: JwtPayload = { userId: authToken.user.id, role: authToken.user.role };
        const accessToken = this.generateAccessToken(payload);
        const refreshToken = this.generateRefreshToken(payload);

        return {
          success: true,
          accessToken,
          refreshToken,
          user: {
            id: authToken.user.id,
            name: authToken.user.name,
            phone: authToken.user.phone,
            email: authToken.user.email,
            role: authToken.user.role,
          },
        };
      }
    }

    return { success: false, error: 'Invalid or expired link' };
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as JwtPayload;

      // Get fresh user data
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Generate new access token
      const payload: JwtPayload = { userId: user.id, role: user.role };
      const accessToken = this.generateAccessToken(payload);

      return {
        success: true,
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
        },
      };
    } catch {
      return { success: false, error: 'Invalid refresh token' };
    }
  }
}

export const authService = new AuthService();
