import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';

@Component({
  selector: 'app-dashboard-page',
  imports: [DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dynadrill-text variant="h1">Dashboard</dynadrill-text>
    <dynadrill-text variant="body">Contenido dinámico del panel de administración.</dynadrill-text>
  `,
})
export class DashboardPage {}
