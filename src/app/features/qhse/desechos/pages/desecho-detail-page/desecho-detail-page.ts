import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillTagComponent,
  DynadrillUploadZoneComponent,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  CONTENEDOR_COLOR_LABELS,
  DESECHO_ESTADO_LABELS,
  Desecho,
  DesechoFirma,
  certificadoPlazoVence,
  manifiestoCompleto,
} from '../../models/desecho.model';
import { DesechoService } from '../../services/desecho.service';

type FirmaCampo = 'firmaGenerador' | 'firmaTransportista' | 'firmaGestor';

/** HSE-AMBIENTAL-001 — manifiesto único (3 firmas) y certificado de disposición final. */
@Component({
  selector: 'app-desecho-detail-page',
  imports: [
    DatePipe,
    DynadrillScreenHeaderComponent,
    DynadrillContextCardComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillTagComponent,
    DynadrillUploadZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './desecho-detail-page.html',
  styleUrl: './desecho-detail-page.scss',
})
export class DesechoDetailPage {
  private readonly desechoService = inject(DesechoService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly estadoLabels = DESECHO_ESTADO_LABELS;
  protected readonly contenedorLabels = CONTENEDOR_COLOR_LABELS;

  protected readonly loading = signal(true);
  protected readonly desecho = signal<Desecho | null>(null);

  protected readonly manifiestoNumero = signal('');
  protected readonly gestorNombre = signal('');
  protected readonly gestorLicenciaSuia = signal('');
  protected readonly certificadoFileName = signal('');

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const d = this.desecho();
    if (!d) return [];
    return [
      { label: 'Desecho', value: d.code },
      { label: 'Contenedor', value: this.contenedorLabels[d.contenedorColor] },
      { label: 'Peso', value: `${d.pesoKg} kg` },
      { label: 'Generado por', value: d.generadoPorNombre },
      { label: 'Estado', value: DESECHO_ESTADO_LABELS[d.estado] },
    ];
  });

  protected readonly puedeGenerarManifiesto = computed(
    () => !!this.manifiestoNumero().trim() && !!this.gestorNombre().trim() && !!this.gestorLicenciaSuia().trim(),
  );

  protected readonly manifiestoCompleto = computed(() => {
    const d = this.desecho();
    return !!d?.manifiesto && manifiestoCompleto(d.manifiesto);
  });

  protected readonly certificadoPlazo = computed(() => {
    const d = this.desecho();
    return d?.manifiesto ? certificadoPlazoVence(d.manifiesto.fecha) : null;
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.desechoService.get(id).subscribe({
      next: d => {
        this.desecho.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private patch(changes: Partial<Desecho>): void {
    const current = this.desecho();
    if (!current) return;
    this.desecho.set({ ...current, ...changes });
    this.desechoService.update(current.id, changes).subscribe({
      error: () => {
        this.desecho.set(current);
        this.notify.error('Error', 'No se pudo guardar el cambio. Inténtalo de nuevo.');
      },
    });
  }

  protected generarManifiesto(): void {
    if (!this.manifiestoNumero().trim() || !this.gestorNombre().trim() || !this.gestorLicenciaSuia().trim()) return;
    this.patch({
      estado: 'con_manifiesto',
      manifiesto: {
        numero: this.manifiestoNumero(),
        fecha: new Date().toISOString(),
        gestorNombre: this.gestorNombre(),
        gestorLicenciaSuia: this.gestorLicenciaSuia(),
      },
    });
  }

  protected firmar(campo: FirmaCampo): void {
    const d = this.desecho();
    if (!d?.manifiesto) return;
    const firma: DesechoFirma = { nombre: this.auth.currentUser()?.name ?? '', firmadoAt: new Date().toISOString() };
    this.patch({ manifiesto: { ...d.manifiesto, [campo]: firma } });
  }

  protected onCertificadoUpload(file: NzUploadFile): void {
    this.certificadoFileName.set(file.name ?? 'certificado.pdf');
  }

  protected registrarCertificado(): void {
    if (!this.certificadoFileName()) return;
    this.patch({
      estado: 'dispuesto',
      certificado: { fecha: new Date().toISOString(), fileName: this.certificadoFileName() },
    });
  }

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/desechos']);
  }
}
