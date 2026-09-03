/**
 * auth.service.ts — Authentication Service
 *
 * Business logic cho toàn bộ luồng xác thực:
 *   - login: verify password → ký JWT + tạo refresh token → lưu DB
 *   - refreshAccessToken: verify refresh token → cấp access token mới
 *   - logout: revoke refresh token trong DB
 *   - getMe: lấy thông tin user hiện tại
 *
 * Tài liệu tham chiếu:
 *   - architecture.md §6 (JWT flow, httpOnly cookie)
 *   - API.md §4 (Auth endpoints, response schema)
 *   - data-model.md §3.1 (users), §3.2 (refresh_tokens)
 *
 * JWT spec (architecture.md §6.1):
 *   - Algorithm: HS256
 *   - Access token expires: 15 phút
 *   - Payload: { sub: userId, role, name, iat, exp }
 *
 * Refresh token spec (API.md §2.2):
 *   - Gửi qua httpOnly cookie, SameSite=Strict
 *   - Expires: 7 ngày
 *   - Lưu hash SHA-256 vào bảng refresh_tokens
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../prisma/client';
import { Errors } from '../middlewares/error-handler';
import { logAudit, AuditActions } from './audit.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = 7;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;   // userId
  role: string;
  name: string;
  iat?: number;
  exp?: number;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;  // seconds — 900 (15 phút)
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    jobGrade: string;
    department: string | null;
    managerId: string | null;
  };
  rawRefreshToken: string; // Dùng để set httpOnly cookie — KHÔNG đưa vào response body
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * hashToken — Hash SHA-256 của token string
 * Chỉ lưu hash vào DB, không lưu raw token (architecture.md §6.1)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * generateRefreshToken — Tạo random refresh token string (64 bytes = 128 hex chars)
 */
function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * signAccessToken — Ký JWT access token theo spec
 */
function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const secret = process.env['JWT_ACCESS_SECRET'];
  if (!secret) throw new Error('JWT_ACCESS_SECRET không được cấu hình');

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  } as jwt.SignOptions);
}

// ─── Service Methods ──────────────────────────────────────────────────────────

/**
 * login — Xác thực email/password, cấp JWT + Refresh Token
 *
 * Flow (architecture.md §6.1):
 *   1. Tìm user theo email
 *   2. bcrypt.compare password
 *   3. Ký access token (JWT HS256, 15m)
 *   4. Tạo refresh token, hash SHA-256, lưu vào refresh_tokens
 *   5. Ghi audit log USER_LOGIN
 *   6. Return { accessToken, user, rawRefreshToken }
 *
 * @throws AppError 401 INVALID_CREDENTIALS nếu email/password sai
 */
export async function login(
  email: string,
  password: string,
  ipAddress?: string
): Promise<LoginResult> {
  // 1. Tìm user theo email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      jobGrade: true,
      department: true,
      managerId: true,
      isActive: true,
    },
  });

  // Dùng thời gian constant để tránh timing attack (luôn chạy bcrypt dù user không tồn tại)
  const dummyHash = '$2a$12$dummyhashfortimingnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn';
  const hashToCompare = user ? user.passwordHash : dummyHash;
  const passwordMatch = await bcrypt.compare(password, hashToCompare);

  if (!user || !passwordMatch || !user.isActive) {
    throw Errors.INVALID_CREDENTIALS();
  }

  // 2. Ký access token
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    name: user.name,
  });

  // 3. Tạo + lưu refresh token
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      isRevoked: false,
      ipAddress: ipAddress ?? null,
    },
  });

  // 4. Ghi audit log
  await logAudit({
    userId: user.id,
    entityType: 'AUTH',
    entityId: user.id,
    action: AuditActions.USER_LOGIN,
    previousState: null,
    newState: 'AUTHENTICATED',
    ipAddress: ipAddress ?? null,
  });

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 900, // 15 phút = 900 giây
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      jobGrade: user.jobGrade,
      department: user.department,
      managerId: user.managerId,
    },
    rawRefreshToken,
  };
}

/**
 * refreshAccessToken — Cấp access token mới từ refresh token hợp lệ
 *
 * Flow:
 *   1. Hash refresh token từ cookie
 *   2. Tìm trong DB: tokenHash match, is_revoked = false, expires_at > now
 *   3. Ký access token mới
 *   4. Ghi audit log
 *
 * @throws AppError 401 nếu token không hợp lệ/hết hạn/đã revoke
 */
export async function refreshAccessToken(rawRefreshToken: string): Promise<{
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}> {
  const tokenHash = hashToken(rawRefreshToken);

  // Tìm refresh token trong DB
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: { id: true, name: true, role: true, isActive: true },
      },
    },
  });

  // Validate: tồn tại, không revoked, chưa hết hạn, user còn active
  if (
    !storedToken ||
    storedToken.isRevoked ||
    storedToken.expiresAt < new Date() ||
    !storedToken.user.isActive
  ) {
    throw Errors.UNAUTHORIZED();
  }

  // Ký access token mới
  const accessToken = signAccessToken({
    sub: storedToken.user.id,
    role: storedToken.user.role,
    name: storedToken.user.name,
  });

  // Ghi audit log
  await logAudit({
    userId: storedToken.user.id,
    entityType: 'AUTH',
    entityId: storedToken.user.id,
    action: AuditActions.TOKEN_REFRESHED,
    previousState: null,
    newState: 'TOKEN_REFRESHED',
  });

  return { accessToken, tokenType: 'Bearer', expiresIn: 900 };
}

/**
 * logout — Revoke refresh token trong DB
 *
 * Flow:
 *   1. Hash token từ cookie
 *   2. Set is_revoked = true trong DB (không xóa — giữ audit trail)
 *   3. Ghi audit log
 *
 * Không throw lỗi nếu token không tìm thấy (idempotent logout)
 */
export async function logout(
  rawRefreshToken: string,
  userId?: string
): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);

  const token = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (token && !token.isRevoked) {
    await prisma.refreshToken.update({
      where: { tokenHash },
      data: { isRevoked: true },
    });

    if (userId) {
      await logAudit({
        userId,
        entityType: 'AUTH',
        entityId: userId,
        action: AuditActions.USER_LOGOUT,
        previousState: 'AUTHENTICATED',
        newState: 'LOGGED_OUT',
      });
    }
  }
}

/**
 * getMe — Lấy thông tin user đầy đủ (GET /auth/me)
 *
 * @throws AppError 404 nếu user không tồn tại
 */
export async function getMe(userId: string): Promise<{
  id: string;
  name: string;
  email: string;
  role: string;
  jobGrade: string;
  department: string | null;
  managerId: string | null;
  isActive: boolean;
  createdAt: Date;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      jobGrade: true,
      department: true,
      managerId: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) throw Errors.NOT_FOUND('user');

  return user;
}
