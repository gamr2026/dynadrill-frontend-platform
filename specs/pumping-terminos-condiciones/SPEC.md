# Spec: Términos y condiciones de uso de equipos — Pumping

## Objetivo

Que cada operador asignado a un ticket de Pumping **lea y acepte** los términos y condiciones de uso
del equipo al recibirlo, con un registro que respalde a la empresa y al operador ante accidentes o
mal uso, y que se pueda consultar después.

### Decisiones tomadas (2026-10-06)
| Tema | Decisión |
|---|---|
| Momento | Al **solicitar la Entrega de EPI** (paso `traslado_salida`), en el mismo diálogo. |
| Identidad | **Uno por uno:** cada operador asignado acepta con su nombre + cédula (la cuenta "Operador" se comparte). |
| Texto | Borrador redactado acá (abajo); **QHSE/Legal debe revisarlo** antes de producción. Fijo y versionado. |
| Consulta | Documentos QHSE del ticket + PDF de constancia + historial por operador. |

## Diseño

### Dónde vive el registro: tabla propia, no dentro de la EPI
La EPI ya trae una declaración (`firmaTrabajador`), pero la aceptación **no** se guarda ahí:
- La EPI se edita (`PUT /qhse/epi/:id`: QHSE aprueba, rechaza, despacha), y un respaldo legal tiene que ser **inmutable**.
- Si la EPI se rechaza y se vuelve a pedir, la aceptación del operador sigue siendo válida.
- `firmaTrabajador.firmadoAt` hoy sale del reloj del navegador; el respaldo necesita **hora del servidor**.

Modelo nuevo (Prisma — *cambio de schema*):
```prisma
model AceptacionTerminos {
  id              Int      @id @default(autoincrement())
  pumpingTicketId Int
  operadorNombre  String
  operadorCedula  String
  version         String   // "PUMP-TyC-v1"
  textoHash       String   // SHA-256 del texto exacto aceptado
  registradoPor   String   // email de la cuenta con sesión
  registradoRol   String
  aceptadoAt      DateTime @default(now())   // hora del servidor

  @@unique([pumpingTicketId, operadorNombre, version])
  @@index([operadorCedula])
  @@map("pumping_aceptaciones_terminos")
}
```
Solo se pueden crear y leer registros. No hay endpoint para editarlos ni borrarlos.

### Texto versionado
- El backend tiene la versión vigente (`PUMP-TyC-v1`) y su texto; el frontend la pide (`GET /operations/pumping/terminos/vigente`).
- Al aceptar, el backend registra la versión y el hash del texto vigente; el cliente solo manda nombre + cédula.

### Flujo (paso `traslado_salida`, sección "Entrega de EPI")
1. El operador abre **Solicitar EPI** para un compañero asignado.
2. Si ese operador **no aceptó la versión vigente para este ticket**, el diálogo muestra primero el bloque
   **"Términos y condiciones de uso del equipo"**: texto con scroll, cédula (obligatoria, 10 dígitos) y la casilla
   *"He leído y acepto…"*, que solo se habilita al llegar al final del texto.
3. Al registrar: primero se crea la aceptación y después la solicitud de EPI. Si la EPI falla, la aceptación queda y no se vuelve a pedir.
4. Si ya aceptó, el diálogo solo muestra *"Términos aceptados — v1, {fecha}"*.
5. El bloque solo aparece en EPI con ticket de Pumping. Las entregas sueltas (oficina) no cambian.

### Bloqueo
- `gateTrasladoSalida` (backend) suma un motivo: *"términos y condiciones sin aceptar (Nombre1, Nombre2)"*.
- El frontend muestra el mismo motivo en el banner de "Traslado de salida bloqueado".

### Consulta
1. **Documentos QHSE del ticket:** una fila nueva, *"Términos y condiciones"*, con estado por operador (Aceptado v1 — fecha / Pendiente) y un icono de PDF.
2. **PDF de constancia** (`shared/documentos/formatos/`, mismo patrón que `entrega-epi-hoja`): texto aceptado + versión + hash + por operador nombre, cédula, fecha y hora del servidor, y cuenta que registró.
3. **Historial por operador:** los operadores **no son usuarios** del sistema (el nombre viene del ticket), así que el historial se busca **por cédula**. Propuesta: pestaña *"Aceptaciones de T&C"* en QHSE → EPI, filtrable por cédula, nombre o ticket.

## Borrador del texto — PUMP-TyC-v1 (PARA REVISIÓN DE QHSE/LEGAL)

> **Términos y condiciones de uso de equipos y unidades — Servicios de Pumping**
>
> Yo, el operador identificado abajo, declaro que:
> 1. **Recepción.** Recibo la unidad y los equipos asignados a este servicio en el estado registrado en la inspección de salida, y he verificado su funcionamiento antes de operarlos.
> 2. **Competencia.** Estoy capacitado y autorizado para operar estos equipos, y no los operaré si no me siento apto físicamente o bajo los efectos de alcohol, drogas o medicamentos que afecten mi atención.
> 3. **Uso adecuado.** Usaré los equipos solo para las actividades del servicio asignado, siguiendo los procedimientos de Dynadrill, el manual del fabricante, el ART/PT vigentes y las indicaciones del Supervisor. No modificaré, anularé ni puentearé dispositivos de seguridad.
> 4. **EPI.** Usaré en todo momento el equipo de protección individual entregado para la tarea.
> 5. **Reporte.** Reportaré de inmediato al Supervisor cualquier falla, daño, incidente, casi-accidente o condición insegura, y detendré la operación si pone en riesgo a personas, al ambiente o al equipo (derecho a detener el trabajo).
> 6. **Terceros.** No permitiré que personas no autorizadas operen los equipos a mi cargo.
> 7. **Responsabilidad.** Entiendo que el uso contrario a estas condiciones o a los procedimientos de la empresa puede generar medidas disciplinarias conforme al reglamento interno, y que esta aceptación quedará registrada como constancia.
> 8. **Devolución.** Devolveré la unidad y los equipos al finalizar el servicio, informando su estado en la inspección de llegada.
>
> Al aceptar, declaro haber leído y comprendido estas condiciones.

*Es un borrador técnico, no asesoría legal. El punto 7 en particular debe validarlo Legal/Talento Humano frente al reglamento interno.*

## Cambios por capa
**Backend:** modelo + migración Prisma; `TerminosService` (texto vigente, crear y listar aceptaciones); endpoints `GET terminos/vigente`, `POST tickets/:id/aceptaciones-terminos`, `GET tickets/:id/aceptaciones-terminos`, `GET aceptaciones-terminos?cedula=`; motivo nuevo en `gateTrasladoSalida`.
**Frontend:** bloque de T&C en `EntregaEpiDialog` (solo con `pumpingTicketId`); motivo en el banner de bloqueo; fila en Documentos QHSE; hoja PDF nueva; pestaña de historial en QHSE → EPI.

## Pruebas
- Back: `gateTrasladoSalida` bloquea si un operador no aceptó; la clave única evita duplicados; la hora la pone el servidor.
- Front: el diálogo exige cédula válida y la casilla; no vuelve a pedir si ya aceptó; las entregas sin ticket no cambian.

## Límites
- **Preguntar antes:** correr la migración en QA/PROD; publicar una versión nueva del texto.
- **Nunca:** editar ni borrar aceptaciones; tomar la hora del cliente como fecha de aceptación.

## Criterios de éxito
1. No se puede enviar el reporte de salida mientras un operador asignado no haya aceptado la versión vigente (front y back).
2. Cada aceptación guarda ticket, nombre, cédula, versión, hash, cuenta, rol y hora del servidor, y no se puede modificar.
3. Documentos QHSE muestra el estado por operador y descarga el PDF de constancia.
4. QHSE puede buscar todas las aceptaciones de un operador por cédula.
5. Las EPI sin ticket siguen igual que hoy.

## Decisiones de implementación (2026-10-06)
1. Texto: se publica el borrador como `PUMP-TyC-v1`, pendiente de validación de QHSE/Legal.
2. **Diálogo propio, antes del de EPI**, en lugar de meter el bloque dentro de `EntregaEpiDialog`: el mismo clic en "Solicitar EPI" abre primero los términos y después la EPI. Así el módulo QHSE no depende de Pumping y una EPI rechazada no vuelve a pedir la aceptación.
3. Si un operador ya tenía la EPI solicitada antes de este cambio (tickets en curso), su fila muestra el botón "Aceptar términos" para que el bloqueo no lo deje sin salida.
4. Versión nueva: en un ticket cuenta cualquier versión ya aceptada (`sinAceptar`); la nueva solo se pide a quien todavía no aceptó.
5. El PDF imprime el texto **vigente**; con una sola versión coincide con lo aceptado. Si se publica v2, el backend tendrá que guardar los textos anteriores para reimprimirlos.
6. Historial: pestaña "Términos y condiciones (Pumping)" en QHSE → EPI; muestra el ticket por id.
7. Migración `20261006180000_pumping_aceptaciones_terminos` generada con `prisma migrate diff`; no se aplicó a ninguna base.

## Preguntas abiertas (vigentes)
1. ¿Quién valida el texto (QHSE, Legal, Talento Humano) y lo tenemos antes de salir a producción?
