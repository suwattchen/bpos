import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
  headers: any;
  params: any;
  query: any;
  body: any;
  file?: any;
  files?: any;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        email: string;
      };

      // Get user info with tenant
      const result = await db.query(
        `
        SELECT
          u.id,
          u.email,
          tu.tenant_id,
          tu.role,
          tu.is_active
        FROM auth.users u
        LEFT JOIN tenant_users tu ON tu.user_id = u.id
        WHERE u.id = $1 AND tu.is_active = true
        LIMIT 1
        `,
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        res.status(401).json({ error: 'User not found or inactive' });
        return;
      }

      const user = result.rows[0];

      req.user = {
        id: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        role: user.role,
      };

      next();
    } catch (jwtError) {
      console.warn('JWT verification failed:', jwtError);
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};
