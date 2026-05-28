import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { SupabaseModule } from "./supabase.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { UserRepository } from "./user.repository";

@Module({
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserRepository,
    // Apply AuthGuard to every route in the app. Routes opt out with @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
