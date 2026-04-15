import { describe, expect, it } from 'vitest';

import { parseBatchCsv } from './batch-csv';

describe('batch csv parsing', () => {
  it('parses BOM-prefixed csv text and preserves quoted commas', () => {
    const result = parseBatchCsv({
      filename: 'applications.csv',
      text:
        '\uFEFFfilename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage\r\n' +
        '"old-oak-bourbon.jpg",distilled-spirits,"Old Oak, Reserve",,Kentucky Straight Bourbon,45% Alc./Vol.,750 mL,"Old Oak Distilling, Louisville, KY",domestic,,,,' +
        '\r\n'
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected CSV parsing to succeed.');
    }

    expect(result.headers[0]).toBe('filename');
    expect(result.rows[0]?.brandName).toBe('Old Oak, Reserve');
    expect(result.preview.rows[0]?.classType).toBe('Kentucky Straight Bourbon');
  });

  it('rejects csv files missing required headers', () => {
    const result = parseBatchCsv({
      filename: 'applications.csv',
      text:
        'filename,brand_name,class_type\nold-oak-bourbon.jpg,Old Oak Bourbon,Kentucky Straight Bourbon\n'
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected CSV parsing to fail.');
    }

    expect(result.error.message).toContain('missing required headers');
  });

  it('rejects malformed row widths', () => {
    const result = parseBatchCsv({
      filename: 'applications.csv',
      text:
        'filename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage\n' +
        'old-oak-bourbon.jpg,distilled-spirits,Old Oak Bourbon,,Kentucky Straight Bourbon,45% Alc./Vol.,750 mL,Old Oak Distilling,domestic\n'
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected CSV parsing to fail.');
    }

    expect(result.error.message).toContain('Row 1');
  });

  it('normalizes optional fields and skips blank rows in csv previews', () => {
    const result = parseBatchCsv({
      filename: 'applications.csv',
      text:
        'filename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage\n' +
        'first.jpg,not-real,First Label,,Straight Rye,45% Alc./Vol.,750 mL,,not-real,Canada,,,\n' +
        '\n' +
        'second.jpg,wine,Second Label,,Red Wine,13.5% Alc./Vol.,750 mL,,imported,France,,,\n'
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected CSV parsing to succeed.');
    }

    expect(result.preview.rowCount).toBe(2);
    expect(result.rows[0]?.beverageType).toBe('auto');
    expect(result.rows[0]?.origin).toBe('domestic');
    expect(result.rows[1]?.beverageType).toBe('wine');
    expect(result.rows[1]?.origin).toBe('imported');
  });
});
