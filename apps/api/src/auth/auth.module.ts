import { Module } from "@nestjs/common";
import { SupabaseModule } from "./supabase.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { UserRepository } from "./user.repository";

@Module({
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, UserRepository],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
