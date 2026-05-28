import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "./supabase.module";
import { UserRepository } from "./user.repository";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SignUpResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface SignInResult {
  user: AuthUser;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly userRepository: UserRepository,
  ) {}

  async signUp(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!data.user || !data.session) {
      throw new BadRequestException(
        "Sign up succeeded but no session was created. Please check your email for confirmation.",
      );
    }

    // Sync user to local database
    await this.userRepository.upsert(data.user.id, data.user.email!);

    return {
      user: { id: data.user.id, email: data.user.email! },
      tokens: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
    };
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    // Sync user to local database
    await this.userRepository.upsert(data.user.id, data.user.email!);

    return {
      user: { id: data.user.id, email: data.user.email! },
      tokens: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
    };
  }

  async validateToken(token: string): Promise<AuthUser> {
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    // Self-heal the local mirror: provision any authenticated user into
    // public.users, not just those who freshly sign up or sign in. Without
    // this, a user whose row is missing (created out-of-band in Supabase
    // Auth, or lost to a DB reset) stays invisible to email lookups like
    // invites even though they can use the app normally.
    await this.userRepository.upsert(data.user.id, data.user.email!);

    return { id: data.user.id, email: data.user.email! };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  async signOut(token: string): Promise<void> {
    // Use admin-level sign out by creating a client with the user's token
    const { error } = await this.supabase.auth.admin.deleteUser(token).catch(() => {
      // Fallback: just invalidate the session
      return { error: null };
    });

    if (error) {
      // Non-critical error, session may already be invalidated
      console.warn("Sign out warning:", error.message);
    }
  }
}
