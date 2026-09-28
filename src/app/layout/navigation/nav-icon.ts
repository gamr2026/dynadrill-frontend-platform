import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NavIcon } from './nav.model';

/**
 * Trazos de 24×24 (estilo línea, stroke 2) — `dynadrill-icon` no trae
 * shield/gauge/route/chart/truck, que la navegación móvil de Figma sí usa.
 */
const PATHS: Record<NavIcon, string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M9.5 21v-6h5v6'],
  modules: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  tool: ['M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8', 'M14.7 6.3 13 4.6a4 4 0 0 0-5.3 5.3L3 14.6 6.4 18l4.7-4.7'],
  shield: ['M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6z', 'm9 12 2 2 4-4'],
  box: ['M21 8 12 3 3 8v8l9 5 9-5z', 'M3 8l9 5 9-5', 'M12 13v8'],
  'file-text': ['M14 3H6v18h12V7z', 'M14 3v4h4', 'M9 13h6', 'M9 17h6'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  alert: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  gauge: ['M12 14 16 10', 'M3.3 19a10 10 0 1 1 17.4 0z'],
  check: ['M20 6 9 17l-5-5'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  route: ['M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M8 17h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16'],
  chart: ['M3 3v18h18', 'M7 16v-4', 'M12 16V8', 'M17 16v-7'],
  truck: ['M3 6h11v10H3z', 'M14 10h4l3 3v3h-7', 'M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
};

@Component({
  selector: 'app-nav-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; }`,
})
export class NavIconComponent {
  readonly name = input.required<NavIcon>();
  readonly size = input(24);
  protected readonly paths = computed(() => PATHS[this.name()]);
}
