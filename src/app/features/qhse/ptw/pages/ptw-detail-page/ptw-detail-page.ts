import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillChecklistComponent,
  type DynadrillChecklistItem,
  DynadrillInputComponent,
  DynadrillScreenHeaderComponent,
  DynadrillStepperComponent,
  DynadrillTagComponent,
  DynadrillUploadZoneComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  PTW_FASE_ORDER,
  PTW_FASE_STEPS,
  PTW_GAS_LIMITES,
  type PtwDocumentoTipo,
  type PtwFirma,
  type PtwGas,
  type PtwGasReading,
  type PtwMatrix,
  ptwCerrado,
  ptwGasEsSeguro,
  ptwGasLimiteLabel,
} from '../../models/ptw.model';
import { PtwService } from '../../services/ptw.service';

type FirmaCampo = 'ptwFirmadoSitio' | 'actaRecibimientoFirmada' | 'ptwCerrado' | 'actaDevolucionFirmada';

@Component({
  selector: 'app-ptw-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DynadrillScreenHeaderComponent,
    DynadrillStepperComponent,
    DynadrillBannerComponent,
    DynadrillChecklistComponent,
    DynadrillUploadZoneComponent,
    DynadrillInputComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
  ],
  templateUrl: './ptw-detail-page.html',
  styleUrl: './ptw-detail-page.scss',
})
export class PtwDetailPage {
  private readonly ptwService = inject(PtwService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly ptw = signal<PtwMatrix | null>(null);

  protected readonly steps = PTW_FASE_STEPS;
  protected readonly gasKeys: PtwGas[] = ['H2S', 'LEL', 'O2', 'CO'];
  protected readonly gasLimites = PTW_GAS_LIMITES;
  protected readonly gasDraft = signal<Record<PtwGas, string>>({ H2S: '', LEL: '', O2: '', CO: '' });

  protected readonly currentIndex = computed(() => {
    const p = this.ptw();
    return p ? Math.max(0, PTW_FASE_ORDER.indexOf(p.fase)) : 0;
  });

  protected readonly cerrado = computed(() => {
    const p = this.ptw();
    return !!p && ptwCerrado(p);
  });

  protected readonly latestGasByType = computed<Partial<Record<PtwGas, PtwGasReading>>>(() => {
    const p = this.ptw();
    const map: Partial<Record<PtwGas, PtwGasReading>> = {};
    if (!p) return map;
    for (const gas of this.gasKeys) {
      const readings = p.gasReadings.filter(r => r.gas === gas);
      if (readings.length > 0) map[gas] = readings[readings.length - 1];
    }
    return map;
  });

  protected limiteLabel(gas: PtwGas): string {
    return ptwGasLimiteLabel(gas);
  }

  protected gasEstadoLabel(gas: PtwGas): string {
    const r = this.latestGasByType()[gas];
    if (!r) return 'Sin lectura';
    return r.seguro ? 'Seguro' : 'Fuera de rango';
  }

  protected gasEstadoVariant(gas: PtwGas): 'success' | 'error' | 'neutral' {
    const r = this.latestGasByType()[gas];
    if (!r) return 'neutral';
    return r.seguro ? 'success' : 'error';
  }

  protected readonly gasInseguroDetalle = computed(() => {
    const latest = this.latestGasByType();
    for (const gas of this.gasKeys) {
      const r = latest[gas];
      if (r && !r.seguro) {
        return `${this.gasLimites[gas].label}: ${r.lectura} ${this.gasLimites[gas].unidad} — fuera del rango seguro (${ptwGasLimiteLabel(gas)}). Detener el trabajo.`;
      }
    }
    return '';
  });

  protected readonly ingresoChecklist = computed<DynadrillChecklistItem[]>(() => {
    const p = this.ptw();
    if (!p) return [];
    return [
      { label: 'Toolbox Talk realizado (5 min obligatorios)', checked: p.toolboxTalkRealizado },
      { label: 'Inspección conjunta Walk-around', checked: p.walkaroundCompletado },
      { label: 'Línea base ambiental documentada', checked: p.lineaBaseAmbientalDocumentada },
      { label: 'Rutas de emergencia verificadas', checked: p.rutasEmergenciaVerificadas },
      { label: 'SIMOPS confirmado — sin trabajos incompatibles', checked: p.simopsConfirmado },
    ];
  });

  protected readonly lotoChecklist = computed<DynadrillChecklistItem[]>(() => this.ptw()?.lotoChecklist ?? []);

  protected readonly puedeAvanzarDeGabinete = computed(() => (this.ptw()?.documentos ?? []).every(d => d.cargado));

  protected readonly puedeAvanzarDeIngreso = computed(() => {
    const p = this.ptw();
    if (!p) return false;
    return (
      p.toolboxTalkRealizado &&
      p.walkaroundCompletado &&
      p.lineaBaseAmbientalDocumentada &&
      p.rutasEmergenciaVerificadas &&
      p.simopsConfirmado
    );
  });

  protected readonly puedeAvanzarDeVerificaciones = computed(() => {
    const p = this.ptw();
    if (!p || p.gasReadings.length === 0) return false;
    const latest = this.latestGasByType();
    const gasesOk = this.gasKeys.every(g => latest[g]?.seguro === true);
    const lotoOk = p.lotoChecklist.every(i => i.checked);
    return gasesOk && lotoOk;
  });

  protected readonly puedeAvanzarDeFormalizacion = computed(() => {
    const p = this.ptw();
    return !!p && !!p.ptwFirmadoSitio && !!p.actaRecibimientoFirmada && p.barricadasInstaladas;
  });

  protected readonly puedeAvanzarDeEjecucion = computed(() => {
    const p = this.ptw();
    return !!p && p.limpiezaCompletada && p.inspeccionFinalConforme;
  });

  protected readonly puedeCerrar = computed(() => {
    const p = this.ptw();
    return !!p && !!p.ptwCerrado && !!p.actaDevolucionFirmada && p.respaldosEnviados;
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.ptwService.get(id).subscribe({
      next: p => {
        this.ptw.set(p);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/ptw']);
  }

  private patch(changes: Partial<PtwMatrix>): void {
    const current = this.ptw();
    if (!current) return;
    this.ptw.set({ ...current, ...changes });
    this.ptwService.update(current.id, changes).subscribe();
  }

  protected onDocumentoUpload(tipo: PtwDocumentoTipo, file: { name?: string }): void {
    const p = this.ptw();
    if (!p) return;
    const documentos = p.documentos.map(d =>
      d.tipo === tipo ? { ...d, cargado: true, fileName: file.name ?? d.label, cargadoAt: new Date().toISOString() } : d,
    );
    this.patch({ documentos });
  }

  protected onIngresoToggle(index: number): void {
    const p = this.ptw();
    if (!p) return;
    switch (index) {
      case 0:
        this.patch({ toolboxTalkRealizado: !p.toolboxTalkRealizado });
        break;
      case 1:
        this.patch({ walkaroundCompletado: !p.walkaroundCompletado });
        break;
      case 2:
        this.patch({ lineaBaseAmbientalDocumentada: !p.lineaBaseAmbientalDocumentada });
        break;
      case 3:
        this.patch({ rutasEmergenciaVerificadas: !p.rutasEmergenciaVerificadas });
        break;
      case 4:
        this.patch({ simopsConfirmado: !p.simopsConfirmado });
        break;
    }
  }

  protected onLotoToggle(index: number): void {
    const p = this.ptw();
    if (!p) return;
    const lotoChecklist = p.lotoChecklist.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item));
    this.patch({ lotoChecklist });
  }

  protected onGasDraftChange(gas: PtwGas, value: string): void {
    this.gasDraft.update(d => ({ ...d, [gas]: value }));
  }

  protected registrarMonitoreo(): void {
    const p = this.ptw();
    if (!p) return;
    const now = new Date().toISOString();
    const draft = this.gasDraft();
    const nuevas: PtwGasReading[] = [];
    for (const gas of this.gasKeys) {
      const raw = draft[gas];
      if (raw === '') continue;
      const lectura = Number(raw);
      if (Number.isNaN(lectura)) continue;
      nuevas.push({ gas, lectura, seguro: ptwGasEsSeguro(gas, lectura), medidoAt: now });
    }
    if (nuevas.length === 0) return;
    this.patch({ gasReadings: [...p.gasReadings, ...nuevas] });
    this.gasDraft.set({ H2S: '', LEL: '', O2: '', CO: '' });
  }

  protected firmar(campo: FirmaCampo): void {
    const nombre = this.auth.currentUser()?.name ?? '';
    const firma: PtwFirma = { nombre, firmadoAt: new Date().toISOString() };
    switch (campo) {
      case 'ptwFirmadoSitio':
        this.patch({ ptwFirmadoSitio: firma });
        break;
      case 'actaRecibimientoFirmada':
        this.patch({ actaRecibimientoFirmada: firma });
        break;
      case 'ptwCerrado':
        this.patch({ ptwCerrado: firma });
        break;
      case 'actaDevolucionFirmada':
        this.patch({ actaDevolucionFirmada: firma });
        break;
    }
  }

  protected toggleBarricadas(): void {
    const p = this.ptw();
    if (p) this.patch({ barricadasInstaladas: !p.barricadasInstaladas });
  }

  protected toggleLimpieza(): void {
    const p = this.ptw();
    if (p) this.patch({ limpiezaCompletada: !p.limpiezaCompletada });
  }

  protected toggleInspeccionFinal(): void {
    const p = this.ptw();
    if (p) this.patch({ inspeccionFinalConforme: !p.inspeccionFinalConforme });
  }

  protected toggleRespaldos(): void {
    const p = this.ptw();
    if (p) this.patch({ respaldosEnviados: !p.respaldosEnviados });
  }

  protected avanzarFase(): void {
    const p = this.ptw();
    if (!p) return;
    const idx = PTW_FASE_ORDER.indexOf(p.fase);
    const next = PTW_FASE_ORDER[idx + 1];
    if (!next) return;
    this.patch({ fase: next });
  }
}
