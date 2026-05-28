import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route (or an entire controller) as publicly accessible, exempting it
 * from the globally registered AuthGuard. Use sparingly — auth is the default.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
