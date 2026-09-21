import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Error: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'http://localhost:5173',
    // credentials: true, // Could be nice if we want to use cookies for refresh tokens later (probably will be implemented in the future)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });
  await app.listen(3000);
}

void bootstrap();
