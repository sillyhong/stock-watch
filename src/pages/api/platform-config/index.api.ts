import type { NextApiRequest, NextApiResponse } from 'next';
import { getPlatformConfigMetadata, setPlatformConfigValue } from '@/services/platformConfigService';

const IDENTIFIER = /^[A-Za-z0-9_-]{1,100}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  const input = req.method === 'GET' ? req.query : req.body;
  const platform = input?.platform;
  const key = input?.key;
  if (typeof platform !== 'string' || !IDENTIFIER.test(platform) || typeof key !== 'string' || !IDENTIFIER.test(key)) {
    return res.status(400).json({ message: 'platform and key must contain 1–100 letters, numbers, underscores or hyphens.' });
  }
  if (req.method === 'PUT') {
    const value = input?.value;
    if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value, 'utf8') > 65535) {
      return res.status(400).json({ message: 'value must be a non-empty string of at most 65535 UTF-8 bytes.' });
    }
    if (platform === 'baogao' && key === 'BAOGAO_AI_AUTHORIZATION' && !/^Bearer\s+\S+$/i.test(value.trim())) {
      return res.status(400).json({ message: 'Baogao authorization must use the Bearer token format.' });
    }
    try {
      const storedValue = platform === 'baogao' && key === 'BAOGAO_AI_AUTHORIZATION' ? value.trim() : value;
      await setPlatformConfigValue(platform, key, storedValue);
      return res.status(200).json({ message: 'Platform configuration updated.', platform, key });
    } catch {
      return res.status(500).json({ message: 'Unable to update platform configuration. Check the database connection and schema.' });
    }
  }

  try {
    const metadata = await getPlatformConfigMetadata(platform, key);
    if (!metadata) return res.status(404).json({ message: 'Platform configuration not found.' });
    return res.status(200).json({ data: metadata });
  } catch {
    return res.status(500).json({ message: 'Unable to read platform configuration. Check the database connection and schema.' });
  }
}
