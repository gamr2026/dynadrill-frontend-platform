import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { provideNzI18n, es_ES } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { provideNzWave } from 'ng-zorro-antd/core/wave';
import {
  AuditOutline,
  CarOutline,
  CaretLeftOutline,
  CaretRightOutline,
  CheckCircleOutline,
  ClearOutline,
  DownloadOutline,
  EditOutline,
  EyeOutline,
  EyeInvisibleOutline,
  FileExcelOutline,
  FilePdfOutline,
  FileSearchOutline,
  FilterOutline,
  InfoCircleOutline,
  InsertRowBelowOutline,
  ProjectOutline,
  ReloadOutline,
  ScheduleOutline,
  SendOutline,
  TableOutline,
  UserAddOutline,
  UserSwitchOutline,
} from '@ant-design/icons-angular/icons';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { provideDynadrillDialog, provideDynadrillDrawer } from '@digitec-it-projects/dynadrill-ui';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

// provideNzI18n(es_ES) cambia el LOCALE_ID de Angular a 'es', pero Angular
// no trae los datos de ese locale por defecto — sin este registro,
// cualquier uso de DatePipe/formatDate (ej. dynadrill-datetime-picker)
// revienta con NG0701 al abrir.
registerLocaleData(localeEs);

// Fase 7-8 completa (documentacion/backend/ANALISIS-BACKEND-TONTO.md): los 8
// dominios hablan con el backend real (dynadrill-backend) — no queda ningún
// interceptor mock registrado, en dev ni en producción. Requiere `npm start`
// (usa proxy.conf.json -> localhost:3000) con el backend corriendo y su seed
// aplicado (npm run prisma:seed en dynadrill-backend).
const interceptors: HttpInterceptorFn[] = [authInterceptor];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Sin esto, cada ruta lazy (ej. /login al cerrar sesión, o
    // /dashboard/mantenimiento/kpis con su chunk pesado de ECharts) recién
    // descarga y parsea su bundle en el primer clic — con red/CPU lentas eso
    // se siente como que la app se congela (hasta el aviso nativo del
    // navegador de "página no responde"). PreloadAllModules los descarga en
    // segundo plano, en tiempo ocioso, después de la carga inicial — sin
    // tocar qué va en el bundle inicial (ver nota de provideDynadrillCharts
    // más abajo, eso sigue aparte).
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors(interceptors)),
    provideNzI18n(es_ES),
    // El manual de marca prohíbe el ripple/wave effect (sección 4) —
    // sin esto ng-zorro lo activa por defecto en botones/checkboxes.
    provideNzIcons([
      AuditOutline,
      CarOutline,
      CaretLeftOutline,
      CaretRightOutline,
      CheckCircleOutline,
      ClearOutline,
      DownloadOutline,
      EditOutline,
      EyeOutline,
      EyeInvisibleOutline,
      FileExcelOutline,
      FilePdfOutline,
      FileSearchOutline,
      FilterOutline,
      InfoCircleOutline,
      InsertRowBelowOutline,
      ProjectOutline,
      ReloadOutline,
      ScheduleOutline,
      SendOutline,
      TableOutline,
      UserAddOutline,
      UserSwitchOutline,
    ]),
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
    // provideDynadrillCharts NO va acá: si se registra a nivel de app, el
    // import de echarts/charts queda estático en app.config.ts y Angular
    // lo empaqueta en main.js (bundle inicial) para TODOS los usuarios,
    // aunque nunca visiten una pantalla con charts. Se registra en el
    // route-level providers de la ruta que sí los usa (maintenance.routes.ts,
    // ruta 'kpis') para que quede dentro de su chunk lazy.
  ],
};
