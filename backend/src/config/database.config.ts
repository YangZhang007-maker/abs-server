import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';

export default registerAs(
  'database',
  (): DataSourceOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin123',
    database: process.env.DB_DATABASE || 'ABS',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: true,
    logging: false,
    extra: {
      ssl: {
        rejectUnauthorized: false,
      },
      family: 4,  // 强制 IPv4，避免 Render 环境 IPv6 不可达
    },
  }),
);