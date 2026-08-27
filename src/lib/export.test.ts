import { describe, it, expect, vi } from 'vitest';
import { parseCSV } from './export';

describe('parseCSV', () => {
  // ── 正常情况 ──

  it('should parse v1 format (5 columns: 日期,金额,一级分类,二级分类,备注)', () => {
    const csv = '日期,金额 (元),一级分类,二级分类,备注\n2026-08-10,10.5,餐饮,午餐,正常午餐';
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('expense');
    expect(result[0].amount).toBe(10.5);
    expect(result[0].level1).toBe('餐饮');
    expect(result[0].level2).toBe('午餐');
    expect(result[0].remark).toBe('正常午餐');
    expect(result[0].date).toBe('2026-08-10');
  });

  it('should parse v2 format (6 columns with 类型)', () => {
    const csv = '日期,类型,金额 (元),一级分类,二级分类,备注\n2026-08-10,收入,500,工资,,月薪';
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('income');
    expect(result[0].amount).toBe(500);
    expect(result[0].level1).toBe('工资');
    expect(result[0].level2).toBe('');
    expect(result[0].remark).toBe('月薪');
  });

  it('should parse multiple rows', () => {
    const csv = '日期,金额 (元),一级分类,二级分类,备注\n2026-08-10,10,餐饮,午餐,\n2026-08-11,20,交通,公交,';
    const result = parseCSV(csv);
    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(10);
    expect(result[1].amount).toBe(20);
  });

  it('should default type to expense for v1 format', () => {
    const csv = '日期,金额 (元),一级分类,二级分类,备注\n2026-08-10,100,餐饮,晚餐,';
    const result = parseCSV(csv);
    expect(result[0].type).toBe('expense');
  });

  it('should parse income type from v2 format', () => {
    const csv = '日期,类型,金额 (元),一级分类,二级分类,备注\n2026-08-10,收入,500,投资,,';
    const result = parseCSV(csv);
    expect(result[0].type).toBe('income');
  });

  // ── 边界情况 ──

  it('should return empty array for empty CSV', () => {
    expect(parseCSV('')).toEqual([]);
    expect(parseCSV('\n')).toEqual([]);
    expect(parseCSV('   ')).toEqual([]);
  });

  it('should return empty array for header-only CSV', () => {
    const csv = '日期,金额 (元),一级分类,二级分类,备注';
    expect(parseCSV(csv)).toEqual([]);
  });

  it('should skip rows with zero amount', () => {
    const csv = '日期,金额 (元),一级分类,二级分类,备注\n2026-08-10,0,餐饮,午餐,';
    expect(parseCSV(csv)).toEqual([]);
  });

  it('should handle Windows line endings', () => {
    const csv = '日期,金额 (元),一级分类,二级分类,备注\r\n2026-08-10,10,餐饮,午餐,';
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(10);
  });

  it('should handle BOM prefix', () => {
    const csv = '﻿日期,金额 (元),一级分类,二级分类,备注\n2026-08-10,10,餐饮,午餐,';
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-08-10');
  });

  it('should handle missing remark field (4 columns)', () => {
    const csv = '日期,金额 (元),一级分类,二级分类\n2026-08-10,10,餐饮,午餐';
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].remark).toBe('');
  });

  it('should trim whitespace from values', () => {
    const csv = '日期,金额 (元),一级分类,二级分类,备注\n  2026-08-10 , 10 , 餐饮 , 午餐 , 备注 ';
    const result = parseCSV(csv);
    expect(result[0].date).toBe('2026-08-10');
    expect(result[0].level1).toBe('餐饮');
    expect(result[0].remark).toBe('备注');
  });

  it('should skip blank lines', () => {
    const csv = '日期,金额 (元),一级分类,二级分类,备注\n2026-08-10,10,餐饮,午餐,\n\n2026-08-11,20,交通,公交,';
    const result = parseCSV(csv);
    expect(result).toHaveLength(2);
  });

  // ── 错误处理 ──

  it('should handle non-numeric amount (skip row)', () => {
    const csv = '日期,金额 (元),一级分类,二级分类,备注\n2026-08-10,abc,餐饮,午餐,';
    const result = parseCSV(csv);
    expect(result).toHaveLength(0);
  });

  it('should handle empty amount (skip row)', () => {
    const csv = '日期,金额 (元),一级分类,二级分类,备注\n2026-08-10,,餐饮,午餐,';
    const result = parseCSV(csv);
    expect(result).toHaveLength(0);
  });

  it('should treat unknown type as expense', () => {
    const csv = '日期,类型,金额 (元),一级分类,二级分类,备注\n2026-08-10,未知,50,餐饮,晚餐,';
    const result = parseCSV(csv);
    expect(result[0].type).toBe('expense');
  });

  it('should parse 支出 type as expense', () => {
    const csv = '日期,类型,金额 (元),一级分类,二级分类,备注\n2026-08-10,支出,50,餐饮,晚餐,';
    const result = parseCSV(csv);
    expect(result[0].type).toBe('expense');
  });

  it('should parse 收入 type as income', () => {
    const csv = '日期,类型,金额 (元),一级分类,二级分类,备注\n2026-08-10,收入,500,工资,,月薪';
    const result = parseCSV(csv);
    expect(result[0].type).toBe('income');
  });

  it('should handle v2 with only 5 columns (no type column)', () => {
    // 如果表头没有"类型"，就是 v1 格式
    const csv = '日期,金额 (元),一级分类,二级分类,备注\n2026-08-10,10,餐饮,午餐,';
    const result = parseCSV(csv);
    expect(result[0].type).toBe('expense');
    expect(result[0].amount).toBe(10);
  });
});
