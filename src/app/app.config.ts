import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideNzI18n, es_ES } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { provideNzWave } from 'ng-zorro-antd/core/wave';
import { EditOutline, EyeOutline, EyeInvisibleOutline, FilePdfOutline, UserSwitchOutline } from '@ant-design/icons-angular/icons';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { provideDynadrillDialog, provideDynadrillDrawer } from '@digitec-it-projects/dynadrill-ui';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { authMockInterceptor } from './core/mocks/auth-mock.interceptor';
import { usersMockInterceptor } from './core/mocks/users-mock.interceptor';
import { pumpingMockInterceptor } from './core/mocks/pumping-mock.interceptor';
import { maintenanceMockInterceptor } from './core/mocks/maintenance-mock.interceptor';

// provideNzI18n(es_ES) cambia el LOCALE_ID de Angular a 'es', pero Angular
// no trae los datos de ese locale por defecto — sin este registro,
// cualquier uso de DatePipe/formatDate (ej. dynadrill-datetime-picker)
// revienta con NG0701 al abrir.
registerLocaleData(localeEs);

// El mock solo se agrega en dev, nunca en build de produccion. Quitar
// junto con core/mocks/auth-mock.interceptor.ts cuando el backend NestJS
// de auth exista de verdad.
const interceptors: HttpInterceptorFn[] = isDevMode()
  ? [authMockInterceptor, usersMockInterceptor, pumpingMockInterceptor, maintenanceMockInterceptor, authInterceptor]
  : [authInterceptor];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors(interceptors)),
    provideNzI18n(es_ES),
    // El manual de marca prohíbe el ripple/wave effect (sección 4) —
    // sin esto ng-zorro lo activa por defecto en botones/checkboxes.
    provideNzIcons([EditOutline, EyeOutline, EyeInvisibleOutline, FilePdfOutline, UserSwitchOutline]),
    provideNzWave({ disabled: true }),
    // Requisito de NzModalService (usado por DynadrillDialogService,
    // que a su vez usa DynadrillNotificationService.confirm() en el
    // flujo de "eliminar usuario"): sus transiciones dependen de
    // AnimationBuilder.
    provideAnimationsAsync(),
    // Requisito de DynadrillDialogService — NzModalService no es
    // providedIn:'root' en ng-zorro-antd.
    provideDynadrillDialog(),
    // Requisito de DynadrillDrawerService (panel maestro-detalle de
    // Mantenimiento) — NzDrawerService tampoco es providedIn:'root'.
    provideDynadrillDrawer(),
  ],
};
