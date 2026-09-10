import { describe, expect, it } from 'vitest';
import { checkBuild, checkCandidate, checkPair, type SpecProduct } from './pc-compatibility';

function product(kind: string, attributes: Record<string, string> = {}, id = kind): SpecProduct {
  return { id, supplier_code: id.toUpperCase(), name: id, component_category: kind, technical_attributes: attributes };
}

describe('Evidence-based PC compatibility', () => {
  it('rejects different sockets in either selection order', () => {
    const cpu = product('processor', { socket: 'AM4' });
    const board = product('motherboard', { socket: 'AM5' });
    expect(checkPair(cpu, board).status).toBe('incompatible');
    expect(checkPair(board, cpu)).toEqual(checkPair(cpu, board));
  });
  it('does not certify a CPU based on socket alone', () => {
    expect(checkPair(product('processor', { socket: 'LGA1700' }), product('motherboard', { socket: 'LGA1700' })).status).toBe('review');
  });
  it('requires the exact CPU, source, confirmed BIOS and version', () => {
    const cpu = product('processor', { socket: 'AM4' });
    const evidence = { socket: 'AM4', supported_cpu_codes: 'PROCESSOR', cpu_support_source: 'Manufacturer support sheet', bios_confirmed: 'yes' };
    expect(checkPair(cpu, product('motherboard', evidence)).status).toBe('review');
    expect(checkPair(cpu, product('motherboard', { ...evidence, bios_version: 'F20' })).status).toBe('compatible');
    expect(checkPair(cpu, product('motherboard', { ...evidence, cpu_support_complete: 'yes', supported_cpu_codes: 'OTHER' })).status).toBe('incompatible');
  });
  it('checks DDR and DIMM versus SO-DIMM independently', () => {
    const board = product('motherboard', { memory_type: 'DDR4', memory_format: 'DIMM' });
    expect(checkPair(board, product('memory', { memory_type: 'DDR5', memory_format: 'DIMM' })).status).toBe('incompatible');
    expect(checkPair(board, product('memory', { memory_type: 'DDR4', memory_format: 'SO-DIMM' })).status).toBe('incompatible');
    expect(checkPair(board, product('memory', { memory_type: 'DDR4' })).status).toBe('review');
    expect(checkPair(board, product('memory', { memory_type: 'DDR4', memory_format: 'DIMM' })).status).toBe('compatible');
  });
  it('requires explicit case support and checks both directions', () => {
    const board = product('motherboard', { board_format: 'ATX' });
    const small = product('case', { supported_board_formats: 'Micro-ATX, Mini-ITX' });
    expect(checkPair(board, small).status).toBe('incompatible');
    expect(checkPair(small, board).status).toBe('incompatible');
    expect(checkPair(board, product('case')).status).toBe('review');
    expect(checkPair(board, product('case', { supported_board_formats: 'ATX, Micro-ATX' })).status).toBe('compatible');
  });
  it('checks radiator, cooler height, GPU length and PSU wattage', () => {
    const enclosure = product('case', { supported_radiators_mm: '240, 280', max_cooler_height_mm: '155', max_gpu_length_mm: '300' });
    expect(checkPair(enclosure, product('cooling', { cooling_type: 'Liquid', radiator_mm: '360' })).status).toBe('incompatible');
    expect(checkPair(enclosure, product('cooling', { cooling_type: 'Air', height_mm: '160' })).status).toBe('incompatible');
    expect(checkPair(enclosure, product('graphics', { length_mm: '320' })).status).toBe('incompatible');
    expect(checkPair(product('graphics', { recommended_psu_watts: '650' }), product('power_supply', { power_watts: '500' })).status).toBe('incompatible');
  });
  it('checks power connector combinations and storage interfaces', () => {
    const board = product('motherboard', { required_power_connectors: '24pin+2x8pin', storage_interfaces: 'SATA' });
    expect(checkPair(board, product('power_supply', { power_connector_sets: '24pin+8pin' })).status).toBe('incompatible');
    expect(checkPair(board, product('storage', { storage_interface: 'NVMe' })).status).toBe('incompatible');
  });
  it('recalculates against only the supplied build and clears removed constraints', () => {
    const cpu = product('processor', { socket: 'AM4' });
    expect(checkCandidate(cpu, [product('motherboard', { socket: 'AM5' })]).status).toBe('incompatible');
    expect(checkCandidate(cpu, [product('motherboard', { socket: 'AM4' })]).status).toBe('review');
    expect(checkCandidate(cpu, []).status).toBe('unchecked');
  });
  it('counts RAM kit modules and total capacity including quantity', () => {
    const board = product('motherboard', { memory_type: 'DDR4', memory_format: 'DIMM', memory_slots: '2', max_memory_gb: '32' });
    const ram = product('memory', { memory_type: 'DDR4', memory_format: 'DIMM', capacity_gb: '32', modules_per_kit: '2' });
    const result = checkBuild([{ product: board, quantity: 1 }, { product: ram, quantity: 2 }]);
    expect(result.status).toBe('incompatible');
    expect(result.reasons).toContain('Los módulos RAM exceden las ranuras de la placa');
    expect(result.reasons).toContain('La RAM excede la capacidad máxima de la placa');
  });
  it('keeps missing specifications and incomplete builds in review', () => {
    expect(checkBuild([{ product: product('processor'), quantity: 1 }]).status).toBe('review');
    expect(checkPair(product('processor'), product('motherboard')).status).toBe('review');
  });
});
