import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTextComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { As2CatalogoItem } from '../../models/facturacion.model';
import { As2Service } from '../../services/facturacion.service';

/** Contrato vigente — hoy solo hay uno; el día que AS2 exponga varios, esto pasa a un selector. */
const CONTRATO = '2025201';

function descargarCsv(nombre: string, columnas: { header: string; key: string }[], filas: Record<string, unknown>[]): void {
  const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const encabezado = columnas.map(c => escapar(c.header)).join(',');
  const cuerpo = filas.map(r => columnas.map(c => escapar(r[c.key])).join(','));
  // BOM para que Excel detecte UTF-8 y no rompa tildes/ñ.
  const contenido = '﻿' + [encabezado, ...cuerpo].join('\r\n');
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Lista de Precios (hoja **LP** del ticket) — espejo de solo lectura del
 * tarifario que en producción vendría anclado al contrato en AS2. El
 * Portal Interno solo la consulta: no se crea ni se edita acá. Alimenta el
 * selector de ítems de la OTQ y la homologación de la documentación diaria.
 */
@Component({
  selector: 'app-lista-precios-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lista-precios-page.html',
  styleUrl: './lista-precios-page.scss',
})
export class ListaPreciosPage {
  private readonly as2Service = inject(As2Service);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly contrato = CONTRATO;
  protected readonly loading = signal(true);
  protected readonly catalogo = signal<As2CatalogoItem[]>([]);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'Código', sortable: true, searchable: true },
    { key: 'descripcion', header: 'Descripción de ítems', sortable: true, searchable: true },
    { key: 'unidad', header: 'Unidad', sortable: true, searchable: true },
    { key: 'tarifa', header: 'Tarifa unitaria' },
  ];

  protected readonly rows = computed(() =>
    this.catalogo().map(i => ({
      id: i.codigo,
      codigo: i.codigo,
      descripcion: i.descripcion,
      unidad: i.unidad,
      tarifa: '$' + i.tarifaUnitaria.toFixed(2),
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => [
    { label: 'Contrato', value: this.contrato, tone: 'brand' },
    { label: 'Ítems en el tarifario', value: this.catalogo().length, tone: 'neutral' },
  ]);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.as2Service.catalogoPrecios(this.contrato).subscribe({
      next: catalogo => {
        this.catalogo.set(catalogo);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la lista de precios.');
      },
    });
  }

  protected exportar(): void {
    descargarCsv(`lista-precios-${this.contrato}-${new Date().toISOString().slice(0, 10)}.csv`, this.columns, this.rows());
    this.notify.success('Exportado', 'Se descargó el CSV de la lista de precios.');
  }
}
