export interface User {
  id: number;
  name: string;
  email: string;
  is_loyalty_member: boolean;
  created_at: string | null;
}
export interface BrowserSession {
  user: User | null;
  csrfToken: string;
  warning?: string | null;
}
export type AuthFields =
  "name" | "email" | "password" | "password_confirmation";
export interface Credentials {
  name?: string;
  email: string;
  password: string;
  password_confirmation?: string;
}
