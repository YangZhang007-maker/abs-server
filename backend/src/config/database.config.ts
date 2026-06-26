import { registerAs } from '@nestjs/config';

interface ParsedDbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

function parseDatabaseUrl(): ParsedDbConfig | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432', 10),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.slice(1),
    };
  } catch {
    console.warn('⚠️  无法解析 DATABASE_URL，使用单独的环境变量');
    return null;
  }
}

export default registerAs('database', () => {
  const fromUrl = parseDatabaseUrl();

  return {
    type: 'postgres' as const,
    host: fromUrl?.host || process.env.DB_HOST || 'localhost',
    port: fromUrl?.port || parseInt(process.env.DB_PORT || '5432', 10),
    username: fromUrl?.username || process.env.DB_USERNAME || 'postgres',
    password: fromUrl?.password || process.env.DB_PASSWORD || 'admin123',
    database: fromUrl?.database || process.env.DB_DATABASE || 'ABS',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: true as const,
    logging: false as const,
    extra: {
      ssl: {
        rejectUnauthorized: false,
      },
      family: 4,
    },
  };
});