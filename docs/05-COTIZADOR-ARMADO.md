# Cotizador Deltron: armado asistido

## Uso

1. Actualizar el catálogo con el HTML completo descargado de Deltron. El encabezado del grupo
   determina la categoría; los datos originales quedan disponibles para revisar la extracción.
2. Usar **Catálogo libre** para productos independientes o **Armar PC** para un conjunto.
   **+ Otra PC** crea un contexto separado dentro de la misma proforma.
3. Elegir una categoría y combinar filtros técnicos. Por ejemplo: Partes PC → Procesadores →
   AMD → AM4 → Ryzen 5, o Placas madre → Intel → LGA1700 → DDR4.
4. Agregar una pieza restringe las siguientes. **Sustituir** reemplaza una pieza del mismo puesto
   (CPU, placa, case, fuente, GPU o disipador). Quitar piezas libera sus restricciones.
5. Abrir **Revisar / completar ficha** cuando falten datos. Guardar la fuente documental y solo
   especificaciones comprobadas. Las correcciones sobreviven a nuevas importaciones.
6. Revisar los motivos del armado. Los conflictos conocidos impiden guardar; los pendientes
   requieren reconocimiento para guardar un borrador. Guardar no certifica el armado.

## Qué comprueba

- CPU/placa: socket, código exacto de CPU en la lista de soporte, fuente de verificación, BIOS
  comprobada y versión. Una lista incompleta no permite descartar todos los CPU no registrados.
- RAM: DDR, DIMM/SO-DIMM, módulos por kit, cantidad, ranuras y capacidad máxima de la placa.
- Case: formatos de placa admitidos explícitamente; altura del disipador, radiadores y longitud
  de GPU cuando estén documentados. El nombre ATX del case o de su fuente no basta.
- Refrigeración: anclajes/socket y dimensiones conocidas.
- Fuente: potencia recomendada para GPU, formato físico y combinaciones de conectores.
- Almacenamiento: interfaz admitida por la placa.

El resultado «Cumple las reglas verificadas» solo describe las comprobaciones disponibles.
Datos desconocidos se marcan «Requiere revisión»; nunca se convierten en compatibles por omisión.
AM4/AM5 son sockets, no tipos de RAM: DDR4/DDR5 y DIMM/SO-DIMM se tratan por separado.

La comprobación integral final sigue incluyendo consumo total, conectores compartidos, BIOS real
de la unidad, ranuras/puertos disponibles, dimensiones combinadas GPU/radiador y refrigeración.
No se usa IA ni se hacen consultas externas automáticas. Los grupos desconocidos permanecen en
Otros/no cotizables hasta clasificarlos manualmente (desactivar «Cotizables» para encontrarlos).

## Prueba manual sugerida

- Procesadores no debe mostrar coolers; Placas madre no debe mostrar pilas, teclados ni discos.
- Elegir placa AM4, buscar CPU: AM5/LGA1700 quedan excluidos; AM4 sin BIOS confirmada requiere revisión.
- Quitar la placa: vuelven los demás sockets. Elegir un CPU primero: se aplica la regla inversa.
- Placa DDR4 DIMM no admite DDR5 ni SO-DIMM. Placa ATX no admite case solo Micro-ATX/Mini-ITX.
- Crear PC 2: no hereda restricciones de PC 1. Volver a PC 1 conserva sus piezas.
- Corregir una ficha, volver a importar el HTML y comprobar que se conserva la corrección.
- Guardar el borrador reconociendo pendientes; abrir impresión y comprobar las etiquetas PC 1/PC 2.
  Las notas técnicas internas se ven en pantalla y no salen en la hoja del cliente.

## Verificación automatizada

Desde `apps/crm`: `npm test`, `npm run lint`, `npm run build`.
Desde la raíz: `npx supabase db query --linked --file supabase/tests/supplier_specs.sql`.
El SQL usa datos sintéticos y termina con rollback; comprueba clasificación, extracción,
búsqueda por tokens, conservación de overrides y aislamiento RLS entre dos negocios.

## Editar y reutilizar proformas

- En una proforma **Borrador**, pulsa **Editar**. Puedes cambiar los datos del cliente, cantidades,
  notas y líneas; agregar productos vuelve a pasar por las restricciones del armado.
- En cualquier estado, pulsa **Duplicar** o **Duplicar y editar** desde la impresión. Se genera un
  nuevo folio editable y se conservan los precios de la proforma original. Cambia el cliente y
  agrega el monitor, RAM o disco que necesite.
- Una proforma enviada o aprobada nunca se reabre ni se modifica. Esta separación protege el
  documento que ya recibió el cliente.
