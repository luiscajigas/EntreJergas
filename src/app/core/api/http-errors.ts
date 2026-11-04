import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from './api.service';

/** Sin respuesta del servidor o fallo interno: no es culpa de lo que envió el usuario. */
export function isConnectivityError(error: unknown): boolean {
  return !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500;
}

export function httpStatus(error: unknown): number | null {
  return error instanceof HttpErrorResponse ? error.status : null;
}

export function apiErrorCode(error: unknown): ApiError['code'] {
  return error instanceof HttpErrorResponse ? (error.error as ApiError | null)?.code : undefined;
}
