import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston';
import * as winston from 'winston';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonModuleUtilities.format.nestLike('YouTubeShorter', {
              colors: true,
              prettyPrint: true,
            }),
          ),
        }),
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'app.log'), // Use process.cwd() for reliable path
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    }),
  });
  const logPath = path.join(process.cwd(), 'logs', 'app.log');
  console.log(`[Bootstrap] Logger initialized. Writing logs to: ${logPath}`);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
