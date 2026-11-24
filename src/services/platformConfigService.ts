import { QueryTypes } from 'sequelize';
import sequelize from '@/services/lib/database';

export const BAOGAO_PLATFORM = 'baogao';
export const BAOGAO_AUTHORIZATION_KEY = 'BAOGAO_AI_AUTHORIZATION';

interface ConfigValueRow {
  config_value: string;
}

export interface PlatformConfigMetadata {
  platform: string;
  config_key: string;
  created_at: Date;
  updated_at: Date;
}

export async function getPlatformConfigValue(platform: string, key: string): Promise<string | null> {
  const rows = await sequelize.query<ConfigValueRow>(
    'SELECT config_value FROM platform_config WHERE platform = :platform AND config_key = :key AND deleted_at IS NULL LIMIT 1',
    { replacements: { platform, key }, type: QueryTypes.SELECT },
  );
  return rows[0]?.config_value ?? null;
}

export async function getPlatformConfigMetadata(platform: string, key: string): Promise<PlatformConfigMetadata | null> {
  const rows = await sequelize.query<PlatformConfigMetadata>(
    'SELECT platform, config_key, created_at, updated_at FROM platform_config WHERE platform = :platform AND config_key = :key AND deleted_at IS NULL LIMIT 1',
    { replacements: { platform, key }, type: QueryTypes.SELECT },
  );
  return rows[0] ?? null;
}

export async function setPlatformConfigValue(platform: string, key: string, value: string): Promise<void> {
  await sequelize.query(
    `INSERT INTO platform_config (platform, config_key, config_value)
     VALUES (:platform, :key, :value)
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), deleted_at = NULL, updated_at = CURRENT_TIMESTAMP(3)`,
    { replacements: { platform, key, value } },
  );
}

export async function getBaogaoAuthorization(): Promise<string> {
  const value = (await getPlatformConfigValue(BAOGAO_PLATFORM, BAOGAO_AUTHORIZATION_KEY))?.trim();
  if (!value) {
    throw new Error('Baogao authorization is missing from platform_config. Update it before running the report task.');
  }
  if (!/^Bearer\s+\S+$/i.test(value)) {
    throw new Error('Baogao authorization in platform_config must use the Bearer token format.');
  }
  return value;
}
