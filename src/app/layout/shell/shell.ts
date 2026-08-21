import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';
import { Footer } from '../footer/footer';
import { SidebarStateService } from '../sidebar-state.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Header, Sidebar, Footer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly sidebarState = inject(SidebarStateService);

  constructor() {
    // dynadrill-menu no expone un evento de click en sus links — cerrar por
    // NavigationEnd cubre igual los clicks y el botón atrás/adelante del navegador.
    inject(Router)
      .events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.sidebarState.close());
  }
}
