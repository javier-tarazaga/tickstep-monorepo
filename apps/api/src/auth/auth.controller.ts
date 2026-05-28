import { Body, Controller, Post, HttpCode, HttpStatus } from "@nestjs/common";
import type { ApiResponse } from "@todo-app/shared-types";
import { AuthService, type SignUpResult, type SignInResult, type AuthTokens } from "./auth.service";
import { Public } from "./public.decorator";

interface SignUpDto {
  email: string;
  password: string;
}

interface SignInDto {
  email: string;
  password: string;
}

interface RefreshDto {
  refreshToken: string;
}

@Public()
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  async signUp(@Body() dto: SignUpDto): Promise<ApiResponse<SignUpResult>> {
    if (!dto.email || !dto.password) {
      return {
        success: false,
        data: null as unknown as SignUpResult,
        message: "Email and password are required",
      };
    }

    if (dto.password.length < 6) {
      return {
        success: false,
        data: null as unknown as SignUpResult,
        message: "Password must be at least 6 characters",
      };
    }

    const result = await this.authService.signUp(dto.email, dto.password);
    return {
      success: true,
      data: result,
      message: "Account created successfully",
    };
  }

  @Post("signin")
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() dto: SignInDto): Promise<ApiResponse<SignInResult>> {
    if (!dto.email || !dto.password) {
      return {
        success: false,
        data: null as unknown as SignInResult,
        message: "Email and password are required",
      };
    }

    const result = await this.authService.signIn(dto.email, dto.password);
    return {
      success: true,
      data: result,
      message: "Signed in successfully",
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto): Promise<ApiResponse<AuthTokens>> {
    if (!dto.refreshToken) {
      return {
        success: false,
        data: null as unknown as AuthTokens,
        message: "Refresh token is required",
      };
    }

    const tokens = await this.authService.refreshTokens(dto.refreshToken);
    return {
      success: true,
      data: tokens,
      message: "Tokens refreshed successfully",
    };
  }
}
