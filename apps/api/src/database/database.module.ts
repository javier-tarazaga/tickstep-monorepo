import { Module, Global } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Pool } from "pg";

export const DATABASE_POOL = "DATABASE_POOL";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool => {
        const pool = new Pool({
          host: configService.get<string>("DATABASE_HOST", "localhost"),
          port: configService.get<number>("DATABASE_PORT", 5432),
          user: configService.get<string>("DATABASE_USER", "tickstep"),
          password: configService.get<string>(
            "DATABASE_PASSWORD",
            "tickstep_dev",
          ),
          database: configService.get<string>("DATABASE_NAME", "tickstep"),
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

        pool.on("error", (err) => {
          console.error("Unexpected database pool error:", err);
        });

        return pool;
      },
    },
  ],
  exports: [DATABASE_POOL],
})
export class DatabaseModule {}
