import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser | null;
}

const TOKEN_KEY = 'dynadrill_access_token';
const USER_KEY = 'dynadrill_current_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly user = signal<AuthenticatedUser | null>(readStoredUser());

  readonly isAuthenticated = computed(() => this.token() !== null);
  readonly currentUser = computed(() => this.user());

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>('/api/auth/login', { email, password })
      .pipe(tap(({ accessToken, user }) => this.setSession(accessToken, user)));
  }

  logout(): void {
    this.setSession(null, null);
  }

  getToken(): string | null {
    return this.token();
  }

  private setSession(token: string | null, user: AuthenticatedUser | null): void {
    this.token.set(token);
    this.user.set(user);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }
}

function readStoredUser(): AuthenticatedUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthenticatedUser) : null;
}
