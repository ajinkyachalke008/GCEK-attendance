import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'gcek_super_secret_dev_key';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  userId: string;
  role: string;
}

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};
