import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { setDefaultResultOrder } from 'dns';

// 强制 IPv4 DNS 解析，解决 Render 环境 IPv6 不可达问题
setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Render 使用 PORT 环境变量，本地使用 APP_PORT 或 3001
  const port = parseInt(process.env.PORT || process.env.APP_PORT || '3001', 10);
  await app.listen(port);
  console.log('ABS Backend running on http://localhost:' + port);
}
bootstrap();