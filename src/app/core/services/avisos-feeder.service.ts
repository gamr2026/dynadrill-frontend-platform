import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { debounceTime, filter, interval, startWith, switchMap } from 'rxjs';
import { environment } from '@env';
import { AuthService } from './auth.service';
import { AppNotificationItem, NotificationsService } from './notifications.service';

/** Aviso de la campanita tal como lo entrega `GET /api/avisos` (módulo de avisos, contenedor plataforma). */
export interface AvisoApi {
  id: string;
  titulo: string;
  detalle: string | null;
  enlace: string | null;
  tono: 'info' | 'warning' | 'error';
  creadoAt: string;
}

const SOURCE_ID = 'avisos';
const CADA_30_SEGUNDOS_MS = 30_000;

/** Convierte un aviso del servidor en un ítem de la campana; `alAbrir` lo marca como leído. */
export function aItemCampana(a: AvisoApi, alAbrir?: () => void): AppNotificationItem {
  return {
    id: `aviso-${a.id}`,
    title: a.titulo,
    description: a.detalle ?? undefined,
    tone: a.tono,
    link: a.enlace ?? undefined,
    ...(alAbrir ? { alAbrir } : {}),
  };
}

/**
 * Alimenta la campana global (`NotificationsService`) con los avisos de la persona (`GET /avisos`): los hechos del sistema
 * que le tocan por su rol, p. ej. un pedido nuevo de Pumping en la bandeja del Jefe de Base. Se consulta al entrar, al
 * navegar y cada 30 s; al abrir un aviso se marca como leído y sale de la lista. Mismo patrón que `QhseAvisosFeederService`:
 * se inicializa desde el shell para que se vea en toda la app.
 */
@Injectable({ providedIn: 'root' })
export class AvisosFeederService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly base = `${environment.apiUrl}/avisos`;
  private started = false;
  private avisos: AvisoApi[] = [];

  /** Llamar una sola vez desde el shell. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        debounceTime(500),
        startWith(null),
        switchMap(() => interval(CADA_30_SEGUNDOS_MS).pipe(startWith(0))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.consultar());
  }

  private consultar(): void {
    if (!this.auth.currentUser()) {
      this.avisos = [];
      this.notifications.clearSource(SOURCE_ID);
      return;
    }
    this.http.get<AvisoApi[]>(this.base).subscribe({
      next: lista => {
        this.avisos = lista;
        this.publicar();
      },
      // sin red o sin sesión: se conserva lo que ya se mostraba
      error: () => undefined,
    });
  }

  private publicar(): void {
    this.notifications.setSource(
      SOURCE_ID,
      this.avisos.map(a => aItemCampana(a, () => this.marcarLeido(a.id))),
    );
  }

  /** Lo quita de la campana de inmediato y avisa al servidor; si el servidor falla, vuelve a aparecer en la próxima consulta. */
  private marcarLeido(id: string): void {
    this.avisos = this.avisos.filter(a => a.id !== id);
    this.publicar();
    this.http.post(`${this.base}/${id}/leer`, {}).subscribe({ error: () => undefined });
  }
}
