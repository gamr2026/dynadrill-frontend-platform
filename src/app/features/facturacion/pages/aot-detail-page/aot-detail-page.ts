import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { Aot } from '../../models/aot.model';
import { AotService } from '../../services/pedido.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AotPdfDialog, AotPdfDialogData } from '../../components/aot-pdf-dialog';

/** Fase 6 — detalle de la AOT (documento oficial final). */
@Component({
  selector: 'app-aot-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    DynadrillScreenHeaderComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aot-detail-page.html',
  styleUrl: './aot-detail-page.scss',
})
export class AotDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly aotService = inject(AotService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  private readonly aotId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly loading = signal(true);
  protected readonly aot = signal<Aot | null>(null);

  protected readonly total = computed(() => this.aot()?.valorOt ?? 0);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.aotService.get(this.aotId).subscribe({
      next: aot => {
        this.aot.set(aot);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la AOT.');
      },
    });
  }

  protected verPdf(): void {
    const aot = this.aot();
    if (!aot) return;
    this.dialog.open<AotPdfDialog, AotPdfDialogData>({
      title: 'AOT — Vista de impresión',
      content: AotPdfDialog,
      data: { aot },
      footer: false,
      width: '900px',
    });
  }

  protected marcarFirmada(): void {
    const aot = this.aot();
    if (!aot || aot.estado === 'firmada') return;
    this.aotService.marcarFirmada(aot.id, this.auth.currentUser()?.name ?? 'Facturación').subscribe({
      next: updated => {
        this.aot.set(updated);
        this.notify.success('AOT firmada', 'Registrada como firmada físicamente.');
      },
      error: () => this.notify.error('Error', 'No se pudo actualizar la AOT.'),
    });
  }

  protected irAlPedido(): void {
    const aot = this.aot();
    if (aot) this.router.navigate(['/dashboard/facturacion/pedidos', aot.pedidoId]);
  }
}
