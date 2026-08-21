import { Injectable, signal } from '@angular/core';

/** Estado del sidebar off-canvas en mobile — compartido entre el botón del header y el shell. */
@Injectable({ providedIn: 'root' })
export class SidebarStateService {
  readonly open = signal(false);

  toggle(): void {
    this.open.update(v => !v);
  }

  close(): void {
    this.open.set(false);
  }
}
