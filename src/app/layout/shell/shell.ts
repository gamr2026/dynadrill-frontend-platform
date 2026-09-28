import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';
import { Footer } from '../footer/footer';
import { SidebarStateService } from '../sidebar-state.service';
import { MobileDrawer } from '../mobile-drawer/mobile-drawer';
import { BottomNav } from '../bottom-nav/bottom-nav';
import { PageChromeService } from '../page-chrome.service';
import { QhseAvisosFeederService } from '../../core/services/qhse-avisos-feeder.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Header, Sidebar, Footer, MobileDrawer, BottomNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly sidebarState = inject(SidebarStateService);
  /** Las pantallas de detalle ocultan la navegación inferior en móvil (ver PageChromeService). */
  protected readonly detail = inject(PageChromeService).detail;

  /**
   * Indicador global de navegación — sin esto, cambiar a una ruta lazy
   * (ej. Indicadores, con su chunk pesado de ECharts, o /login al cerrar
   * sesión) no mostraba ningún feedback mientras el navegador descargaba
   * el chunk: no hay ningún componente montado todavía en ese momento
   * para pintar un spinner propio.
   */
  protected readonly navigating = signal(false);

  constructor() {
    const router = inject(Router);

    // Fase 3, PLAN-QHSE-PUMPING-NOTIFICACIONES: alimenta la campana global
    // con los avisos de QHSE — se inicializa acá (el shell, no una página
    // de QHSE) para que se vea en toda la app.
    inject(QhseAvisosFeederService).start();

    router.events.pipe(takeUntilDestroyed()).subscribe(e => {
      if (e instanceof NavigationStart) this.navigating.set(true);
      else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) this.navigating.set(false);
    });

    // Cerrar el drawer móvil por NavigationEnd cubre igual los clicks y el
    // botón atrás/adelante del navegador.
    router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.sidebarState.close());
  }
}
