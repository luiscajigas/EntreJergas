import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ExpressionEntry {
  id: number;
  expression: string;
  meaning: string;
  region: string;
  context: string;
  equivalent: string;
  example: string;
  pronunciation: string | null;
  audioUrl: string | null;
  source: 'database';
}

export interface LookupResponse {
  found: boolean;
  entry: ExpressionEntry | null;
  message?: string;
}

export interface HistoryItem {
  id: number;
  expression: string;
  found: boolean;
  createdAt: string;
}

export interface Dashboard {
  expressions: number;
  searches: number;
  regions: Array<{ region: string; count: number }>;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

export interface AuthResponse {
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = '/api';

  constructor(private readonly http: HttpClient) {}

  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/register`, { name, email, password });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, { email, password });
  }

  currentUser(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.baseUrl}/auth/me`);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, {});
  }

  health(): Observable<{ status: string; service: string }> {
    return this.http.get<{ status: string; service: string }>(`${this.baseUrl}/health`);
  }

  lookup(expression: string): Observable<LookupResponse> {
    return this.http.post<LookupResponse>(`${this.baseUrl}/lookup`, { expression });
  }

  history(): Observable<{ items: HistoryItem[] }> {
    return this.http.get<{ items: HistoryItem[] }>(`${this.baseUrl}/history`);
  }

  dashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${this.baseUrl}/dashboard`);
  }
}