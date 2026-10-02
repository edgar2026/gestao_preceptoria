// Gerador mínimo de arquivos .xlsx (Office Open XML) sem dependências externas.
// Gera um pacote ZIP "store" (sem compressão) com as partes mínimas exigidas
// pelo Excel/LibreOffice: [Content_Types].xml, _rels/.rels, xl/workbook.xml,
// xl/_rels/workbook.xml.rels, xl/styles.xml e xl/worksheets/sheetN.xml.

const S_NORMAL = 0;
const S_BOLD = 1;
const S_MONEY = 2;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function utf8(str) {
  if (encoder) return encoder.encode(str);
  const out = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return Uint8Array.from(out);
}

function zipStore(files) {
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (Math.floor(now.getSeconds() / 2))) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = utf8(file.name);
    const data = file.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + data.length;
  }

  const centralSize = centralParts.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const parts = [...localParts, ...centralParts, end];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

function escXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // remove caracteres de controle inválidos em XML 1.0
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

function columnName(index) {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function sheetXml(rows, headerRows) {
  const parts = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
  ];
  rows.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) return;
    const line = [];
    row.forEach((raw, colIndex) => {
      if (raw === null || raw === undefined || raw === '') return;
      const isObj = typeof raw === 'object';
      const value = isObj ? raw.v : raw;
      const style = isObj && raw.s != null ? raw.s : (rowIndex < headerRows ? S_BOLD : S_NORMAL);
      if (value === null || value === undefined || value === '') return;
      const ref = `${columnName(colIndex)}${rowIndex + 1}`;
      const sAttr = style ? ` s="${style}"` : '';
      if (typeof value === 'number' && isFinite(value)) {
        line.push(`<c r="${ref}"${sAttr}><v>${value}</v></c>`);
      } else if (typeof value === 'boolean') {
        line.push(`<c r="${ref}"${sAttr} t="b"><v>${value ? 1 : 0}</v></c>`);
      } else {
        line.push(`<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escXml(String(value))}</t></is></c>`);
      }
    });
    if (line.length === 0) {
      parts.push(`<row r="${rowIndex + 1}"/>`);
      return;
    }
    parts.push(`<row r="${rowIndex + 1}">`, line.join(''), '</row>');
  });
  parts.push('</sheetData></worksheet>');
  return parts.join('');
}

const STYLES_XML = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>',
  '<fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF122346"/><name val="Calibri"/><family val="2"/></font></fonts>',
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF0F8"/><bgColor indexed="64"/></patternFill></fill></fills>',
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
  '<cellXfs count="3">',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
  '</cellXfs>',
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
  '</styleSheet>'
].join('');

function sanitizeSheetName(name) {
  const base = String(name || 'Planilha')
    .replace(/[\\\/\?\*\[\]\:]/g, ' ')
    .trim()
    .slice(0, 31);
  return base || 'Planilha';
}

function buildXlsx(sheets) {
  const list = (sheets || []).filter(Boolean).map(s => ({
    name: sanitizeSheetName(s.name),
    rows: Array.isArray(s.rows) ? s.rows : [],
    headerRows: Number(s.headerRows || 0)
  }));
  if (list.length === 0) list.push({ name: 'Planilha', rows: [], headerRows: 0 });

  const files = [];

  const overrides = list
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('');
  files.push({
    name: '[Content_Types].xml',
    data: utf8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        overrides +
        '</Types>'
    )
  });

  files.push({
    name: '_rels/.rels',
    data: utf8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'
    )
  });

  files.push({
    name: 'xl/workbook.xml',
    data: utf8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        list.map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>'
    )
  });

  const rels = list
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join('');
  files.push({
    name: 'xl/_rels/workbook.xml.rels',
    data: utf8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        rels +
        `<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>'
    )
  });

  files.push({ name: 'xl/styles.xml', data: utf8(STYLES_XML) });

  list.forEach((s, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: utf8(sheetXml(s.rows, s.headerRows)) });
  });

  return zipStore(files);
}

function baixarArquivo(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function baixarXlsx(filename, sheets) {
  const bytes = buildXlsx(sheets);
  baixarArquivo(bytes, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export { buildXlsx, S_NORMAL, S_BOLD, S_MONEY };
