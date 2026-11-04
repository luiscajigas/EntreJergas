import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { components } from './api-contract';

type Schemas = components['schemas'];

export type AuthResponse = Schemas['AuthResponse'];
export type AuthUser = Schemas['User'];
export type Dashboard = Schemas['DashboardResponse'];
export type EntryTranslation = Schemas['DefinitionText'];
export type ExpressionEntry = Schemas['ExpressionEntry'];
export type HistoryItem = Schemas['HistoryItem'];
export type HistorySource = Schemas['HistorySource'];
export type LookupFailureReason = Schemas['LookupFailureReason'];
export type LookupResponse = Schemas['LookupResponse'];
export type ApiError = Schemas['ErrorResponse'];

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = '/api';

  constructor(private readonly http: HttpClient) {}

  register(name: string, email: string, password: string): Observable<AuthResponse> {
    const body: Schemas['RegisterRequest'] = { name, email, password };
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/register`, body);
  }

  login(email: string, password: string): Observable<AuthResponse> {
    const body: Schemas['LoginRequest'] = { email, password };
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, body);
  }

  currentUser(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.baseUrl}/auth/me`);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, {});
  }

  health(): Observable<Schemas['HealthResponse']> {
    return this.http.get<Schemas['HealthResponse']>(`${this.baseUrl}/health`);
  }

  lookup(expression: string): Observable<LookupResponse> {
    const body: Schemas['LookupRequest'] = { expression };
    return this.http.post<LookupResponse>(`${this.baseUrl}/lookup`, body);
  }

  translate(entry: ExpressionEntry): Observable<Schemas['TranslateResponse']> {
    const { id, expression, meaning, region, context, equivalent, example } = entry;
    const body: Schemas['TranslateRequest'] = id !== null
      ? { id }
      : { expression, meaning, region, context, equivalent, example };
    return this.http.post<Schemas['TranslateResponse']>(`${this.baseUrl}/translate`, body);
  }

  history(): Observable<Schemas['HistoryResponse']> {
    return this.http.get<Schemas['HistoryResponse']>(`${this.baseUrl}/history`);
  }

  dashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${this.baseUrl}/dashboard`);
  }
}