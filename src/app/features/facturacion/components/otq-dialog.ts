import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  DynadrillUploadZoneComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { RolesService, UsersService } from '../../users/services/users.service';
import { As2CatalogoItem, Otq, OtqItem } from '../models/facturacion.model';
import { As2Service, OtqService } from '../services/facturacion.service';
import { toLocalDateString } from '../../../shared/utils';

interface ItemDraft {
  cantidadEstimada: number;
}

/**
 * FACT-001 — Kick-off: vincula el pedido con AS2 (simulado, Fase 1-2) y
 * deja la OTQ lista para activar (Fase 3, desde el detalle del pedido).
 * Mientras no exista el API key real de AS2, el botón "Buscar en AS2"
 * consulta el interceptor mock que hace de espejo — la forma de la
 * respuesta es la misma que tendría la API real, así que el día que se
 * conecte solo cambia el origen del dato, no esta pantalla.
 */
@Component({
  selector: 'app-otq-dialog',
  imports: [
    DecimalPipe,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillUploadZoneComponent,
    DynadrillButtonComponent,
    DynadrillBannerComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './otq-dialog.html',
  styleUrl: './otq-dialog.scss',
})
export class OtqDialog {
  private readonly otqService = inject(OtqService);
  private readonly as2Service = inject(As2Service);
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<OtqDialog, Otq | undefined>);

  protected readonly pedidoId = signal(0);
  protected readonly numero = signal('');
  protected readonly representanteLegal = signal('');
  protected readonly fechaInicioEstimada = signal<Date | null>(null);
  protected readonly fechaFinEstimada = signal<Date | null>(null);
  protected readonly supervisorId = signal<number | null>(null);
  protected readonly tecnicoHseId = signal<number | null>(null);

  /** Datos que llegan de AS2 — solo lectura, el Portal no los edita. */
  protected readonly as2Estado = signal<'pendiente' | 'buscando' | 'encontrado' | 'no_encontrado'>('pendiente');
  protected readonly cliente = signal('');
  protected readonly numeroContrato = signal('');
  protected readonly campo = signal('');
  protected readonly bloque = signal('');
  protected readonly pozo = signal('');
  protected readonly taladro = signal('');

  protected readonly catalogo = signal<As2CatalogoItem[]>([]);
  protected readonly catalogoOptions = computed<DynadrillSelectOption[]>(() => this.catalogo().map(i => ({ label: `${i.codigo} — ${i.descripcion}`, value: i.codigo })));
  protected readonly items = signal<OtqItem[]>([]);
  protected readonly codigoDraft = signal<string | null>(null);
  protected readonly draft = signal<ItemDraft>({ cantidadEstimada: 0 });
  protected readonly itemSeleccionado = computed(() => this.catalogo().find(i => i.codigo === this.codigoDraft()) ?? null);

  protected readonly presupuestoAdjunto = signal<string | null>(null);
  protected readonly alcanceAdjunto = signal<string | null>(null);

  protected readonly supervisores = signal<DynadrillSelectOption[]>([]);
  protected readonly tecnicosHse = signal<DynadrillSelectOption[]>([]);

  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(
    () =>
      this.as2Estado() === 'encontrado' &&
      this.numero().trim().length > 0 &&
      this.supervisorId() !== null &&
      this.tecnicoHseId() !== null &&
      this.items().length > 0,
  );

  constructor() {
    this.rolesService.list().subscribe(roles => {
      const supervisorRoleId = roles.find(r => r.name === 'Supervisor')?.id;
      const hseRoleId = roles.find(r => r.name === 'Técnico HSE')?.id;
      this.usersService.list().subscribe(users => {
        this.supervisores.set(users.filter(u => u.roleId === supervisorRoleId).map(u => ({ label: u.name, value: u.id })));
        this.tecnicosHse.set(users.filter(u => u.roleId === hseRoleId).map(u => ({ label: u.name, value: u.id })));
      });
    });
  }

  /** FACT-001, Fase 2 — "el sistema valida que el ticket exista en AS2 antes de permitir continuar". */
  protected buscarAs2(): void {
    if (this.pedidoId() <= 0) return;
    this.as2Estado.set('buscando');
    this.as2Service.buscarPedido(this.pedidoId()).subscribe({
      next: info => {
        if (!info) {
          this.as2Estado.set('no_encontrado');
          this.catalogo.set([]);
          return;
        }
        this.as2Estado.set('encontrado');
        this.cliente.set(info.cliente);
        this.numeroContrato.set(info.numeroContrato);
        this.campo.set(info.campo);
        this.bloque.set(info.bloque);
        this.pozo.set(info.pozo);
        this.taladro.set(info.taladro ?? '');

        const supervisor = this.supervisores().find(s => s.label === info.supervisorOperativo);
        if (supervisor) this.supervisorId.set(supervisor.value as number);
        const tecnico = this.tecnicosHse().find(t => t.label === info.tecnicoHse);
        if (tecnico) this.tecnicoHseId.set(tecnico.value as number);

        this.as2Service.catalogoPrecios(info.numeroContrato).subscribe(cat => this.catalogo.set(cat));
      },
      error: () => {
        this.as2Estado.set('no_encontrado');
        this.catalogo.set([]);
      },
    });
  }

  protected updateCantidad(value: number): void {
    this.draft.update(d => ({ ...d, cantidadEstimada: value }));
  }

  protected agregarItem(): void {
    const sel = this.itemSeleccionado();
    const cantidad = this.draft().cantidadEstimada;
    if (!sel || cantidad <= 0) return;
    this.items.update(list => [
      ...list,
      {
        id: list.length + 1,
        codigo: sel.codigo,
        descripcion: sel.descripcion,
        unidad: sel.unidad,
        tarifaUnitaria: sel.tarifaUnitaria,
        cantidadEstimada: cantidad,
        total: Math.round(sel.tarifaUnitaria * cantidad * 100) / 100,
      },
    ]);
    this.codigoDraft.set(null);
    this.draft.set({ cantidadEstimada: 0 });
  }

  protected quitarItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  protected onPresupuestoSeleccionado(file: NzUploadFile): void {
    this.presupuestoAdjunto.set(file.name);
  }

  protected onAlcanceSeleccionado(file: NzUploadFile): void {
    this.alcanceAdjunto.set(file.name);
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const documentosAdjuntos = [this.presupuestoAdjunto(), this.alcanceAdjunto()].filter((f): f is string => !!f);
    const supervisorNombre = this.supervisores().find(s => s.value === this.supervisorId())?.label ?? '';
    const tecnicoNombre = this.tecnicosHse().find(t => t.value === this.tecnicoHseId())?.label ?? '';

    this.otqService
      .create({
        numero: this.numero().trim(),
        pedidoId: this.pedidoId(),
        cliente: this.cliente(),
        numeroContrato: this.numeroContrato(),
        campo: this.campo(),
        bloque: this.bloque(),
        pozo: this.pozo(),
        taladro: this.taladro() || undefined,
        representanteLegal: this.representanteLegal().trim() || undefined,
        fechaInicioEstimada: this.fechaInicioEstimada() ? toLocalDateString(this.fechaInicioEstimada()!) : undefined,
        fechaFinEstimada: this.fechaFinEstimada() ? toLocalDateString(this.fechaFinEstimada()!) : undefined,
        supervisorOperativo: supervisorNombre,
        tecnicoHse: tecnicoNombre,
        documentosAdjuntos: documentosAdjuntos.length ? documentosAdjuntos : undefined,
        items: this.items(),
      })
      .subscribe({
        next: otq => {
          this.notify.success('OTQ creada', `${otq.numero} creada — todavía en borrador, actívala desde el detalle del pedido.`);
          this.modalRef.close(otq);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo crear la OTQ.');
        },
      });
  }
}
