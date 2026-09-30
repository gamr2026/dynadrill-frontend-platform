import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillKpiCardComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { Pedido, itemEstimadoPrincipal } from '../../models/pedido.model';
import { Prefactura } from '../../models/prefactura.model';
import { GuiaRemision } from '../../models/guia-remision.model';
import { AvanceDocumental } from '../../models/documento-operativo.model';
import { Aot } from '../../models/aot.model';
import { AotService, DocumentoOperativoService, GuiaRemisionService, PedidoService, PrefacturaService } from '../../services/pedido.service';
import { DocumentoPdfService } from '../../../../shared/documentos';
import { PrefacturaHoja } from '../../../../shared/documentos/formatos/prefactura-hoja';
import { EnviarClienteDialog, EnviarClienteDialogData } from '../../components/enviar-cliente-dialog';
import { RespuestaClienteDialog, RespuestaClienteDialogData } from '../../components/respuesta-cliente-dialog';
import { GuiaRemisionPdfDialog, GuiaRemisionPdfDialogData } from '../../components/guia-remision-pdf-dialog';
import { AotGenerarDialog, AotGenerarDialogData } from '../../components/aot-generar-dialog';
import { EditarRepresentantesDialog, EditarRepresentantesDialogData } from '../../components/editar-representantes-dialog';
import { useDetailChrome } from '../../../../layout/page-chrome.service';

interface Dato {
  label: string;
  value: string;
}

/** Plantilla de carga a AS2 (Fase 8) — mismas columnas que `AS2 Prefactura Cliente.xlsx`. */
function exportarAs2(code: string, items: { codigo: string; unidad: string; cantidad: number; descripcion: string; precioUnitario: number }[]): void {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['Codigo Producto AS2', 'Codigo Unidad AS2', 'Cantidad', 'Descripción', 'Precio', 'Porcentaje Descuento'];
  const filas = items.map(i => [i.codigo, i.unidad, i.cantidad, i.descripcion, i.precioUnitario, 0]);
  const contenido = '﻿' + [headers.map(esc).join(','), ...filas.map(f => f.map(esc).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `AS2-carga-${code}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Fase 4-8 — detalle de la Prefactura: ítems + liquidación + PDF, revisión,
 * envío al cliente, firma/rechazo, guía de remisión, AOT y export a AS2.
 */
@Component({
  selector: 'app-prefactura-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    DynadrillScreenHeaderComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
    DynadrillButtonComponent,
    DynadrillKpiCardComponent,
    DynadrillSpinnerComponent,
    DynadrillBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prefactura-detail-page.html',
  styleUrl: './prefactura-detail-page.scss',
})
export class PrefacturaDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly prefacturaService = inject(PrefacturaService);
  private readonly pedidoService = inject(PedidoService);
  private readonly docService = inject(DocumentoOperativoService);
  private readonly guiaService = inject(GuiaRemisionService);
  private readonly aotService = inject(AotService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly documentoPdf = inject(DocumentoPdfService);
  private readonly notify = inject(DynadrillNotificationService);

  private readonly prefacturaId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly loading = signal(true);
  protected readonly prefactura = signal<Prefactura | null>(null);
  protected readonly pedido = signal<Pedido | null>(null);
  protected readonly guiaRemision = signal<GuiaRemision | null>(null);
  protected readonly aot = signal<Aot | null>(null);
  protected readonly avance = signal<AvanceDocumental | null>(null);

  /** Etiqueta y tono del chip de estado (Figma "Chip/Status"). */
  protected readonly estadoChip = computed<{ label: string; tone: 'neutral' | 'info' | 'brand' | 'warning' | 'success' | 'error' }>(() => {
    switch (this.prefactura()?.estado) {
      case 'en_revision': return { label: 'En revisión', tone: 'info' };
      case 'generada': return { label: 'Generada', tone: 'brand' };
      case 'enviada_para_firmas': return { label: 'Enviada para firmas', tone: 'warning' };
      case 'firmada': return { label: 'Firmada', tone: 'success' };
      case 'rechazada': return { label: 'Rechazada', tone: 'error' };
      default: return { label: 'Borrador', tone: 'neutral' };
    }
  });

  protected readonly puedeGenerarAot = computed(() => this.prefactura()?.estado === 'firmada' && !this.aot());

  /** FACT #9 — igual criterio de labels que pedido-detail-page.ts. */
  protected readonly datosComercial = computed<Dato[]>(() => {
    const p = this.pedido();
    if (!p) return [];
    return [
      { label: 'Agente comercial', value: p.agenteComercial },
      { label: 'Representante en campo', value: p.representanteCampo },
      { label: 'Representante en Quito (PEC)', value: p.representanteQuito },
      { label: 'Analista de facturación', value: p.analistaFacturacion ?? '—' },
    ];
  });

  /** Checklist de revisión (FACT-003) — cliente-side; habilita "Enviar al cliente". */
  protected readonly checklist = signal<Record<string, boolean>>({
    datos: false,
    tarifas: false,
    cantidades: false,
    materiales: false,
    correspondencia: false,
    integridad: false,
  });
  protected readonly checklistItems: { key: string; label: string }[] = [
    { key: 'datos', label: 'Datos generales del servicio, orden de trabajo y contrato' },
    { key: 'tarifas', label: 'Horas de servicio, transporte, totales y tarifas' },
    { key: 'cantidades', label: 'Cantidades y series contra el Reporte de Herramientas' },
    { key: 'materiales', label: 'Materiales utilizados y herramientas empleadas' },
    { key: 'correspondencia', label: 'Correspondencia entre el ticket y la documentación de respaldo' },
    { key: 'integridad', label: 'Integridad de los archivos del paquete' },
  ];
  protected readonly checklistCompleto = computed(() => Object.values(this.checklist()).every(Boolean));

  protected readonly netoFmt = computed(() => {
    const pf = this.prefactura();
    return pf ? '$' + pf.netoCobrar.toFixed(2) : '';
  });

  /**
   * `guiaRemisionAplica` es la regla de negocio real (viene de si hubo uso de
   * herramientas marcado como "venta" en Reporte de Herramientas, ver
   * `calcularAvance` en el backend) — antes este banner se disparaba
   * contando ítems `tipo==='Material'` de la prefactura directamente, una
   * regla distinta que podía marcar "falta guía" aunque el Pedido, por su
   * propia regla, no la necesitara (bug reportado).
   */
  protected readonly faltaGuiaRemision = computed(() => {
    const a = this.avance();
    return !!a && a.guiaRemisionAplica && !a.guiaRemisionGenerada;
  });
  /**
   * RN: los documentos de respaldo reales (monitoreo, mezcla) deben ir
   * firmados al cliente — Facturación sube esa versión desde el Pedido
   * (`documentos-firmados`, ver `subirDocumentoFirmado` en
   * pedido-detail-page.ts). Sin `documentosReales` (pedido sin ninguno) no
   * bloquea nada.
   */
  protected readonly faltanDocumentosFirmados = computed(() => {
    const a = this.avance();
    return !!a && (a.documentosReales?.length ?? 0) > 0 && !a.documentosFirmadosCompletos;
  });
  /** Mientras Bodega no resuelva la Solicitud de Despacho, el pedido queda `por_despachar_bodega` — no se debe enviar al cliente con una solicitud todavía en el aire. */
  protected readonly esperandoDespachoBodega = computed(() => this.pedido()?.estado === 'por_despachar_bodega');
  protected readonly puedeEnviar = computed(
    () =>
      this.prefactura()?.estado === 'generada' &&
      this.checklistCompleto() &&
      !this.faltanDocumentosFirmados() &&
      !this.esperandoDespachoBodega(),
  );
  protected readonly esperandoFirma = computed(() => this.prefactura()?.estado === 'enviada_para_firmas');
  protected readonly esRechazada = computed(() => this.prefactura()?.estado === 'rechazada');

  protected toggleChecklist(key: string): void {
    this.checklist.update(c => ({ ...c, [key]: !c[key] }));
  }

  /** Mismo patrón que "Marcar todo OK" de FCR — marca los 6 ítems de una vez, el revisor solo destilda la excepción si encuentra algo mal. */
  protected marcarTodoRevisado(): void {
    this.checklist.set(Object.fromEntries(this.checklistItems.map(c => [c.key, true])));
  }

  constructor() {
    this.reload();

    // Barra "Detail" del header (Figma Nav/TopAppBar, solo móvil) — el título
    // pasa a la barra y las acciones de página quedan también en el "⋮".
    useDetailChrome(
      () => this.prefactura()?.code ?? 'Prefactura',
      '/dashboard/facturacion/prefacturas',
      () => {
        const pf = this.prefactura();
        if (!pf) return [];
        return [
          { label: 'Ir al pedido', action: () => this.irAlPedido() },
          { label: 'Ver / Imprimir PDF', action: () => this.verPdf() },
          ...(pf.estado === 'firmada' ? [{ label: 'Exportar a AS2', action: () => this.exportarAs2() }] : []),
        ];
      },
    );
  }

  private reload(): void {
    this.loading.set(true);
    this.prefacturaService.get(this.prefacturaId).subscribe({
      next: pf => {
        this.prefactura.set(pf);
        forkJoin({
          pedidos: this.pedidoService.list(),
          guia: this.guiaService.dePedido(pf.pedidoId),
          aot: this.aotService.dePedido(pf.pedidoId),
          avance: this.docService.avance(pf.pedidoId),
        }).subscribe(({ pedidos, guia, aot, avance }) => {
          this.pedido.set(pedidos.find(p => p.id === pf.pedidoId) ?? null);
          this.guiaRemision.set(guia);
          this.aot.set(aot);
          this.avance.set(avance);
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la prefactura.');
      },
    });
  }

  /** Etiqueta legible por tipo de documento real — antes solo distinguía monitoreo vs "todo lo demás = mezcla", lo que mostraba Reporte Job/Herramientas/Prefactura como "Documento de mezcla (firmado)". */
  private static readonly ETIQUETA_TIPO_DOC: Record<string, string> = {
    monitoreo: 'Documento de monitoreo',
    mezcla: 'Documento de mezcla',
    reporte_job: 'Reporte Job',
    reporte_herramientas: 'Reporte de Herramientas',
    prefactura: 'Prefactura',
    despacho_bodega: 'Despacho de Bodega',
  };

  protected enviarAlCliente(): void {
    const pf = this.prefactura();
    if (!pf || !this.puedeEnviar()) return;
    const ref = this.dialog.open<EnviarClienteDialog, EnviarClienteDialogData>({
      title: 'Enviar prefactura al cliente',
      content: EnviarClienteDialog,
      data: {
        prefacturaId: pf.id,
        adjuntosBase: [
          ...(this.guiaRemision() ? ['Guía de Remisión (PDF).pdf'] : []),
          // Un único ítem por documento real (monitoreo/mezcla/Reporte
          // Job/Reporte de Herramientas/Prefactura), ya en su versión
          // FIRMADA — `documentosReales` (calcularAvance en el backend) ya
          // cubre estos 5 tipos, así que no hay que listar aparte "Reporte
          // Job (PDF).pdf"/"Prefactura X.pdf" sin firmar: eso duplicaba el
          // mismo documento (bug reportado, ver captura). Se descarga desde
          // el Pedido ("Documentos de respaldo" → "Descargar" al lado de
          // cada uno, no el original sin firmar).
          ...(this.avance()?.documentosReales ?? []).map(
            d => `${PrefacturaDetailPage.ETIQUETA_TIPO_DOC[d.tipo]} (firmado) — ${d.nombreOriginal} (descargar del Pedido)`,
          ),
        ],
      },
      footer: false,
      width: '560px',
    });
    ref.afterClose.subscribe(updated => {
      if (updated) this.reload();
    });
  }

  protected respuestaCliente(): void {
    const pf = this.prefactura();
    if (!pf) return;
    const ref = this.dialog.open<RespuestaClienteDialog, RespuestaClienteDialogData>({
      title: 'Respuesta del cliente',
      content: RespuestaClienteDialog,
      data: { prefacturaId: pf.id },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe(updated => {
      if (updated) this.reload();
    });
  }

  /** La guía ya se generó en el Pedido (requisito previo) — acá solo se visualiza. */
  protected verGuiaRemisionPdf(): void {
    const guia = this.guiaRemision();
    const p = this.pedido();
    if (!guia || !p) return;
    this.dialog.open<GuiaRemisionPdfDialog, GuiaRemisionPdfDialogData>({
      title: 'Guía de remisión — Vista de impresión',
      content: GuiaRemisionPdfDialog,
      data: { guia, pedido: p },
      footer: false,
      width: '820px',
    });
  }

  protected verPdf(): void {
    const pf = this.prefactura();
    const p = this.pedido();
    if (!pf || !p) return;
    this.documentoPdf.abrir({
      titulo: 'Prefactura — Vista de impresión',
      component: PrefacturaHoja,
      inputs: { prefactura: pf, pedido: p },
      nombreArchivo: `Prefactura ${pf.code}`,
    });
  }

  /** FACT #9 — corregir representantes sin salir de la prefactura ni abrir el diálogo completo del pedido. */
  protected editarRepresentantes(): void {
    const p = this.pedido();
    if (!p) return;
    const ref = this.dialog.open<EditarRepresentantesDialog, EditarRepresentantesDialogData>({
      title: 'Editar representantes',
      content: EditarRepresentantesDialog,
      data: { pedido: p },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe(pedido => {
      if (pedido) this.pedido.set(pedido);
    });
  }

  protected irAlPedido(): void {
    const p = this.pedido();
    if (p) this.router.navigate(['/dashboard/facturacion/pedidos', p.id]);
  }

  protected generarAot(): void {
    const pf = this.prefactura();
    if (!pf || !this.puedeGenerarAot()) return;
    const ref = this.dialog.open<AotGenerarDialog, AotGenerarDialogData>({
      title: 'Generar OT',
      content: AotGenerarDialog,
      data: {
        prefacturaId: pf.id,
        descripcionSugerida: itemEstimadoPrincipal(this.pedido() ?? { itemsEstimados: [] })?.descripcion ?? 'Servicio ejecutado según prefactura',
        representanteSugerido: {
          nombre: pf.firmaCliente?.nombre ?? this.pedido()?.representanteCampo ?? '',
          cargo: pf.firmaCliente?.cargo ?? 'Ingeniero de Operaciones',
        },
      },
      footer: false,
      width: '560px',
    });
    ref.afterClose.subscribe(aot => {
      if (aot) this.router.navigate(['/dashboard/facturacion/aots', (aot as Aot).id]);
    });
  }

  protected verAot(): void {
    const a = this.aot();
    if (a) this.router.navigate(['/dashboard/facturacion/aots', a.id]);
  }

  protected exportarAs2(): void {
    const pf = this.prefactura();
    if (!pf) return;
    exportarAs2(pf.code, pf.items);
    this.notify.success('Exportado', 'Plantilla de carga a AS2 descargada.');
  }
}
