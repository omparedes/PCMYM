import type { SupplierProduct } from './proformas.models';

export type SpecProduct = Pick<SupplierProduct, 'id' | 'supplier_code' | 'name' | 'component_category' | 'technical_attributes'>;
export interface CompatibilityResult {
  status: 'unchecked' | 'compatible' | 'review' | 'incompatible';
  reasons: string[];
}

export function specs(product: SpecProduct): Record<string, string> {
  const value = product.technical_attributes;
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}
export function values(value: string | undefined): string[] {
  return (value ?? '').split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);
}

/** Symmetric, evidence-based rules. Unknown specifications never imply compatibility. */
export function checkPair(left: SpecProduct, right: SpecProduct): CompatibilityResult {
  const pair = [left, right];
  const get = (kind: string) => pair.find((p) => p.component_category === kind);
  const cpu = get('processor'); const board = get('motherboard'); const ram = get('memory');
  const enclosure = get('case'); const cooler = get('cooling'); const gpu = get('graphics');
  const psu = get('power_supply'); const disk = get('storage');
  const problems: string[] = []; const pending: string[] = []; let checked = 0;
  const compare = (a: SpecProduct, aKey: string, b: SpecProduct, bKey: string, label: string) => {
    checked++;
    const av = values(specs(a)[aKey]); const bv = values(specs(b)[bKey]);
    if (!av.length || !bv.length) pending.push(label + ': falta completar la ficha');
    else if (!av.some((value) => bv.includes(value))) problems.push(label + ': ' + av.join('/') + ' ≠ ' + bv.join('/'));
  };
  const fits = (a: SpecProduct, key: string, b: SpecProduct, maxKey: string, label: string) => {
    checked++;
    const actual = Number(specs(a)[key]); const max = Number(specs(b)[maxKey]);
    if (!(actual > 0) || !(max > 0)) pending.push(label + ': faltan medidas o capacidad');
    else if (actual > max) problems.push(label + ': ' + actual + ' supera ' + max);
  };
  if (cpu && board) {
    compare(cpu, 'socket', board, 'socket', 'Socket CPU/placa');
    const data = specs(board);
    if (data['cpu_support_complete'] === 'yes' && data['cpu_support_source']) {
      if (!values(data['supported_cpu_codes']).includes(cpu.supplier_code.toUpperCase())) problems.push('CPU fuera de la lista de soporte verificada de la placa');
    }
    if (!values(data['supported_cpu_codes']).includes(cpu.supplier_code.toUpperCase()) || !data['cpu_support_source'] || data['bios_confirmed'] !== 'yes' || !data['bios_version']) {
      pending.push('Confirmar soporte del CPU exacto y BIOS de la placa');
    }
  }
  if (board && ram) {
    compare(board, 'memory_type', ram, 'memory_type', 'Generación DDR');
    compare(board, 'memory_format', ram, 'memory_format', 'Formato de memoria');
  }
  if (cpu && ram && specs(cpu)['memory_type']) compare(cpu, 'memory_type', ram, 'memory_type', 'Memoria admitida por CPU');
  if (board && enclosure) compare(board, 'board_format', enclosure, 'supported_board_formats', 'Formato de placa/case');
  if (cpu && cooler) compare(cpu, 'socket', cooler, 'supported_sockets', 'Anclaje CPU/refrigeración');
  if (enclosure && cooler) {
    if (specs(cooler)['cooling_type'] === 'Liquid') compare(cooler, 'radiator_mm', enclosure, 'supported_radiators_mm', 'Radiador/case');
    else if (specs(cooler)['cooling_type'] === 'Air') fits(cooler, 'height_mm', enclosure, 'max_cooler_height_mm', 'Altura del disipador');
    else { checked++; pending.push('Completar tipo de refrigeración'); }
  }
  if (gpu && enclosure) fits(gpu, 'length_mm', enclosure, 'max_gpu_length_mm', 'Longitud de tarjeta de video');
  if (gpu && psu) {
    fits(gpu, 'recommended_psu_watts', psu, 'power_watts', 'Potencia recomendada para GPU');
    compare(gpu, 'power_connector', psu, 'power_connectors', 'Conector de alimentación GPU');
  }
  if (board && psu) compare(board, 'required_power_connectors', psu, 'power_connector_sets', 'Juego de conectores placa/fuente');
  if (board && disk) compare(board, 'storage_interfaces', disk, 'storage_interface', 'Interfaz de almacenamiento');
  if (psu && enclosure) compare(psu, 'psu_format', enclosure, 'supported_psu_formats', 'Formato de fuente/case');
  return { status: problems.length ? 'incompatible' : pending.length ? 'review' : checked ? 'compatible' : 'unchecked', reasons: [...problems, ...pending] };
}

export function checkCandidate(candidate: SpecProduct, selected: SpecProduct[]): CompatibilityResult {
  const checks = selected.filter((p) => p.id !== candidate.id).map((p) => checkPair(candidate, p));
  const status = checks.some((c) => c.status === 'incompatible') ? 'incompatible'
    : checks.some((c) => c.status === 'review') ? 'review'
      : checks.some((c) => c.status === 'compatible') ? 'compatible' : 'unchecked';
  return { status, reasons: Array.from(new Set(checks.flatMap((c) => c.reasons))) };
}

export interface BuildItem { product: SpecProduct; quantity: number }
export function checkBuild(items: BuildItem[]): CompatibilityResult {
  const required = ['processor', 'motherboard', 'memory', 'storage', 'power_supply', 'case'];
  const missing = required.filter((kind) => !items.some((item) => item.product.component_category === kind));
  const checks = items.map((item) => checkCandidate(item.product, items.map((i) => i.product)));
  const reasons = [...new Set(checks.flatMap((c) => c.reasons))];
  if (missing.length) reasons.push('Faltan piezas del armado: ' + missing.map((k) => ({ processor: 'procesador', motherboard: 'placa', memory: 'RAM', storage: 'almacenamiento', power_supply: 'fuente', case: 'case' })[k]).join(', '));
  const board = items.find((i) => i.product.component_category === 'motherboard');
  const ram = items.filter((i) => i.product.component_category === 'memory');
  let invalid = checks.some((c) => c.status === 'incompatible');
  if (board && ram.length) {
    const b = specs(board.product);
    const modules = ram.reduce((sum, r) => sum + r.quantity * Number(specs(r.product)['modules_per_kit'] || 0), 0);
    const capacity = ram.reduce((sum, r) => sum + r.quantity * Number(specs(r.product)['capacity_gb'] || 0), 0);
    if (!b['memory_slots'] || ram.some((r) => !specs(r.product)['modules_per_kit'])) reasons.push('Completar ranuras RAM y módulos por kit');
    else if (modules > Number(b['memory_slots'])) { invalid = true; reasons.push('Los módulos RAM exceden las ranuras de la placa'); }
    if (!b['max_memory_gb'] || ram.some((r) => !specs(r.product)['capacity_gb'])) reasons.push('Confirmar capacidad máxima de RAM');
    else if (capacity > Number(b['max_memory_gb'])) { invalid = true; reasons.push('La RAM excede la capacidad máxima de la placa'); }
  }
  if (!items.some((i) => i.product.component_category === 'cooling')) reasons.push('Confirmar refrigeración incluida o agregar un disipador');
  reasons.push('Antes de comprar: verificar consumo total, conectores y espacio compartido con radiador según el armado completo');
  return { status: invalid ? 'incompatible' : 'review', reasons: [...new Set(reasons)] };
}

export const COMPATIBILITY_LABELS = {
  unchecked: 'Sin restricciones comprobadas', compatible: 'Cumple las reglas verificadas',
  review: 'Requiere revisión', incompatible: 'Incompatible',
};
