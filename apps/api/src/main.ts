import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  });

  const port = process.env["PORT"] ?? 3000;
  // Bind to all interfaces so containerized platforms (e.g. Cloud Run) can reach it.
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 API server running on http://localhost:${port}`);
}

bootstrap();
