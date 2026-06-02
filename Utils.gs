const SHEET_NAMES = {
  COMPANY: 'Company_Settings',
  DEPARTMENTS: 'Departments',
  FACTORS: 'Emission_Factors',
  ACTIVITIES: 'Activity_Master',
  RECORDS: 'Activity_Records',
  DEPARTMENT_ACTIVITIES: 'Department_Activities'
};

const HEADERS = {
  Company_Settings: ['company_id', 'company_name', 'site_name', 'report_year', 'base_year', 'prepared_by', 'created_at', 'updated_at'],
  Departments: ['department_id', 'department_name', 'description', 'is_active', 'created_at', 'updated_at'],
  Emission_Factors: ['factor_id', 'activity_name', 'activity_group', 'scope', 'category', 'unit', 'co2_factor', 'fossil_ch4_factor', 'ch4_factor', 'n2o_factor', 'total_co2e_factor', 'total_co2e_unit', 'factor_source', 'factor_year', 'gwp_version', 'is_active', 'created_at', 'updated_at'],
  Activity_Master: ['activity_id', 'activity_name', 'activity_group', 'scope', 'category', 'unit', 'default_factor_id', 'is_active', 'created_at', 'updated_at'],
  Department_Activities: ['department_activity_id', 'department_id', 'department_name', 'activity_id', 'activity_name', 'is_active', 'created_at', 'updated_at'],
  Activity_Records: ['record_id', 'year', 'month', 'period', 'department_id', 'department_name', 'activity_id', 'activity_name', 'activity_group', 'scope', 'category', 'unit', 'factor_id', 'amount', 'snapshot_total_co2e_factor', 'snapshot_total_co2e_unit', 'emission_kgco2e', 'emission_tco2e', 'factor_source', 'factor_year', 'gwp_version', 'remark', 'created_at', 'updated_at']
};

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function nowIso_() {
  return new Date().toISOString();
}

function generateId_(prefix) {
  return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 16).toUpperCase();
}

function toNumber_(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean_(value) {
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() !== 'false' && String(value) !== '0' && String(value).trim() !== '';
}

function normalizeMonth_(month) {
  const numericMonth = Number(month);
  if (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) {
    throw new Error('Month must be an integer from 1 to 12.');
  }
  return String(numericMonth).padStart(2, '0');
}

function makePeriod_(year, month) {
  const numericYear = Number(year);
  if (!Number.isInteger(numericYear) || numericYear < 1900 || numericYear > 3000) {
    throw new Error('Year must be a valid four-digit year.');
  }
  return numericYear + '-' + normalizeMonth_(month);
}

function requireFields_(data, fields) {
  fields.forEach(function(field) {
    if (data[field] === undefined || data[field] === null || String(data[field]).trim() === '') {
      throw new Error(field + ' is required.');
    }
  });
}

function getSheet_(sheetName) {
  if (!globalThis.__CARBON_DB_SETUP_RUNNING__) setupDatabase();
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Missing sheet: ' + sheetName);
  return sheet;
}

function getHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.reduce(function(map, header, index) {
    map[header] = index + 1;
    return map;
  }, {});
}

function validateSheetHeaders_(sheet, expectedHeaders) {
  const actualHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), expectedHeaders.length)).getValues()[0]
    .slice(0, expectedHeaders.length);
  const missing = expectedHeaders.filter(function(header) { return actualHeaders.indexOf(header) === -1; });
  const mismatched = expectedHeaders.filter(function(header, index) { return actualHeaders[index] !== header; });
  if (missing.length || mismatched.length || sheet.getLastColumn() < expectedHeaders.length) {
    const message = 'Sheet ' + sheet.getName() + ' headers are incorrect. Expected: ' + expectedHeaders.join(', ') + '. Actual: ' + actualHeaders.join(', ');
    Logger.log(message);
    throw new Error(message);
  }
  return true;
}

function sheetRowsToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return cell !== ''; });
  }).map(function(row, rowIndex) {
    const object = { _rowNumber: rowIndex + 2 };
    headers.forEach(function(header, index) {
      object[header] = row[index];
    });
    return object;
  });
}

function appendObjectRow_(sheet, object) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(function(header) { return object[header] !== undefined ? object[header] : ''; }));
  return object;
}

function updateObjectRow_(sheet, rowNumber, object) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const existing = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const row = headers.map(function(header, index) {
    return object[header] !== undefined ? object[header] : existing[index];
  });
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  return object;
}

function findRowById_(sheetName, idField, idValue) {
  const sheet = getSheet_(sheetName);
  const rows = sheetRowsToObjects_(sheet);
  const found = rows.find(function(row) { return String(row[idField]) === String(idValue); });
  if (!found) throw new Error('Record not found: ' + idValue);
  return { sheet: sheet, row: found, rowNumber: found._rowNumber };
}

function applyRecordFilters_(records, filters) {
  filters = filters || {};
  return records.filter(function(record) {
    return (!filters.year || String(record.year) === String(filters.year)) &&
      (!filters.month || String(record.month).padStart(2, '0') === String(filters.month).padStart(2, '0')) &&
      (!filters.department_id || String(record.department_id) === String(filters.department_id)) &&
      (!filters.factor_id || String(record.factor_id) === String(filters.factor_id)) &&
      (!filters.activity_id || String(record.activity_id) === String(filters.activity_id)) &&
      (!filters.activity_name || String(record.activity_name).toLowerCase().indexOf(String(filters.activity_name).toLowerCase()) !== -1) &&
      (!filters.scope || String(record.scope) === String(filters.scope)) &&
      (!filters.category || String(record.category) === String(filters.category));
  });
}

function sumBy_(records, keyField, valueField) {
  const totals = {};
  records.forEach(function(record) {
    const key = record[keyField] || 'Unspecified';
    totals[key] = (totals[key] || 0) + toNumber_(record[valueField]);
  });
  return Object.keys(totals).map(function(key) { return { label: key, value: totals[key] }; })
    .sort(function(a, b) { return b.value - a.value; });
}

function getUniqueValues_(records, field) {
  return Array.from(new Set(records.map(function(record) { return record[field]; }).filter(Boolean))).sort();
}
