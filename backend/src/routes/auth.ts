import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { db } from '../config/database';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password required', 400);
    }

    // Check if user exists
    const existingUser = await db.query(
      'SELECT id FROM auth.users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('User already exists', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in transaction
    const result = await db.transaction(async (client) => {
      // Insert user
      const userResult = await client.query(
        `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
         VALUES ($1, $2, $3)
         RETURNING id, email`,
        [email, hashedPassword, JSON.stringify({ name: name || email.split('@')[0] })]
      );

      const user = userResult.rows[0];

      // Trigger will create tenant and tenant_user automatically
      // Get the created tenant
      const tenantResult = await client.query(
        'SELECT tenant_id, role FROM tenant_users WHERE user_id = $1',
        [user.id]
      );

      return {
        user,
        tenant: tenantResult.rows[0],
      };
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: result.user.id, email: result.user.email },
      config.jwt.secret as Secret,
      { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] }
    );

    res.status(201).json({
      user: result.user,
      tenantId: result.tenant.tenant_id,
      role: result.tenant.role,
      token,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Signup error:', error);
    throw new AppError('Signup failed', 500);
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password required', 400);
    }

    // Get user with tenant info
    const result = await db.query(
      `
      SELECT
        u.id,
        u.email,
        u.encrypted_password,
        tu.tenant_id,
        tu.role,
        tu.is_active
      FROM auth.users u
      LEFT JOIN tenant_users tu ON tu.user_id = u.id
      WHERE u.email = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401);
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      throw new AppError('Account is inactive', 403);
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.encrypted_password);

    if (!passwordMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret as Secret,
      { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
      tenantId: user.tenant_id,
      role: user.role,
      token,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Login error:', error);
    throw new AppError('Login failed', 500);
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const userData = req.user!;
  res.json({
    user: {
      id: userData.userId,
      email: userData.email,
      tenantId: userData.tenantId,
      role: userData.role,
      tenantUser: {
        id: userData.userId,
        tenant_id: userData.tenantId,
        role: userData.role,
        is_active: true,
      },
    },
  });
});

// Logout (client-side removes token, server could blacklist if needed)
router.post('/logout', authenticate, (req: AuthRequest, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
