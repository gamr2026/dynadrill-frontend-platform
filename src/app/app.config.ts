import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideNzI18n, es_ES } from 'ng-zorro-antd/i18n';
import { provideNzWave } from 'ng-zorro-antd/core/wave';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { authMockInterceptor } from './core/mocks/auth-mock.interceptor';

// El mock solo se agrega en dev, nunca en build de produccion. Quitar
// junto con core/mocks/auth-mock.interceptor.ts cuando el backend NestJS
// de auth exista de verdad.
const interceptors: HttpInterceptorFn[] = isDevMode()
  ? [authMockInterceptor, authInterceptor]
  : [authInterceptor];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors(interceptors)),
    provideNzI18n(es_ES),
    // El manual de marca prohíbe el ripple/wave effect (sección 4) —
    // sin esto ng-zorro lo activa por defecto en botones/checkboxes.
    provideNzWave({ disabled: true }),
  ],
};
