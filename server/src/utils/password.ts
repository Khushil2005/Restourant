import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  if (!password) return '';
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash?: string): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    // If stored as bcrypt hash
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
      return await bcrypt.compare(password, hash);
    }
    // If stored as plain text (e.g. manually entered into database)
    return password === hash;
  } catch (err) {
    // Fallback plain string comparison in case bcrypt throws
    return password === hash;
  }
}
