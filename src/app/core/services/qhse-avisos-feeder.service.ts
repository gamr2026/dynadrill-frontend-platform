import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { debounceTime, filter, interval, startWith, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '@env';
import { AuthService } from './auth.service';
import { AppNotificationItem, NotificationsService } from './notifications.service';

type AvisoQhseTipo = 'pedido_sin_formato_recepcion' | 'personal_asignado_sin_sfi' | 'ptw_sin_pt_hoy' | 'art_por_vencer' | 'art_vencido';

interface AvisoQhse {
  id: string;
  tipo: AvisoQhseTipo;
  titulo: string;
  detalle: string;
  link: string;
  fecha: string;
}

const TONE_POR_TIPO: Record<AvisoQhseTipo, 'warning' | 'error'> = {
  pedido_sin_formato_recepcion: 'warning',
  personal_asignado_sin_sfi: 'warning',
  ptw_sin_pt_hoy: 'warning',
  art_por_vencer: 'warning',
  art_vencido: 'error',
};

/** Roles que ven estos avisos — Jefe de Base y Superadmin quedan afuera a propósito (ven todo lo demás, esto les llenaría la campana). */
const ROLES_QHSE = ['Técnico HSE', 'Coordinador HSE', 'Gerente HSE'];

const CINCO_MINUTOS_MS = 5 * 60_000;

/**
 * Alimenta la campana global (`NotificationsService`) con `GET /qhse/avisos`
 * (Fase 3, PLAN-QHSE-PUMPING-NOTIFICACIONES) — se inicializa desde el shell
 * (`layout/shell/shell.ts`), no desde una página de QHSE, para que se vea
 * en toda la app y no solo mientras esa pantalla está abierta (el problema
 * que tenía el patrón que copiaba Mantenimiento). Sin importar
 * `features/qhse` a propósito — mismo criterio documentado en
 * `notifications.service.ts`: el shell no puede inflar el bundle inicial
 * con código de un feature module.
 *
 * `providedIn: 'root'`, así que sus dependencias (incluido `DestroyRef`) se
 * inyectan cuando el propio servicio se instancia, no dentro de `start()` —
 * `inject()` solo es válido en contexto de inyección.
 */
@Injectable({ providedIn: 'root' })
export class QhseAvisosFeederService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;

  /** Llamar una sola vez desde el shell (`Shell` vive toda la sesión, así que no hace falta un `onDestroy` propio del feeder). */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        debounceTime(500),
        startWith(null),
        switchMap(() => interval(CINCO_MINUTOS_MS).pipe(startWith(0))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.consultar());
  }

  private consultar(): void {
    const roleName = this.auth.currentUser()?.roleName;
    if (!roleName || !ROLES_QHSE.includes(roleName)) {
      this.notifications.clearSource('qhse');
      return;
    }
    this.http.get<AvisoQhse[]>(`${environment.apiUrl}/qhse/avisos`).subscribe({
      next: avisos => this.notifications.setSource('qhse', avisos.map(mapAviso)),
      error: () => this.notifications.clearSource('qhse'),
    });
  }
}

function mapAviso(a: AvisoQhse): AppNotificationItem {
  return {
    id: a.id,
    title: a.titulo,
    description: a.detalle,
    tone: TONE_POR_TIPO[a.tipo],
    link: a.link,
  };
}
