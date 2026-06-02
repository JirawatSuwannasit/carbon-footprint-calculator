function setupDatabase() {
  if (globalThis.__CARBON_DB_SETUP_RUNNING__) return { success: true, message: 'Database setup already running.' };
  globalThis.__CARBON_DB_SETUP_RUNNING__ = true;
  try {
    const spreadsheet = getSpreadsheet_();
    Object.keys(HEADERS).forEach(function(sheetName) {
      let sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
      ensureSheetHeaders_(sheet, HEADERS[sheetName]);
      sheet.autoResizeColumns(1, HEADERS[sheetName].length);
    });
    seedDefaultCompanySettings_();
    seedDepartments_();
    seedEmissionFactors_();
    return { success: true, message: 'Database setup completed.' };
  } finally {
    globalThis.__CARBON_DB_SETUP_RUNNING__ = false;
  }
}

function ensureSheetHeaders_(sheet, headers) {
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const existingHeaders = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].filter(function(header) { return header !== ''; }) : [];
  if (existingHeaders.join('|') === headers.join('|') && sheet.getLastColumn() === headers.length) {
    sheet.setFrozenRows(1);
    return;
  }

  const existingRows = sheet.getLastRow() > 1 ? sheetRowsToObjectsWithoutSetup_(sheet) : [];
  const migratedRows = existingRows.map(function(row) { return migrateRowForHeaders_(row, headers); });
  sheet.clearContents();
  if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  if (sheet.getMaxColumns() > headers.length) sheet.deleteColumns(headers.length + 1, sheet.getMaxColumns() - headers.length);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (migratedRows.length) {
    sheet.getRange(2, 1, migratedRows.length, headers.length).setValues(migratedRows.map(function(row) {
      return headers.map(function(header) { return row[header] !== undefined ? row[header] : ''; });
    }));
  }
  sheet.setFrozenRows(1);
}

function sheetRowsToObjectsWithoutSetup_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return cell !== ''; });
  }).map(function(row) {
    const object = {};
    headers.forEach(function(header, index) {
      if (header) object[header] = row[index];
    });
    return object;
  });
}

function migrateRowForHeaders_(row, headers) {
  const migrated = {};
  headers.forEach(function(header) { migrated[header] = row[header] !== undefined ? row[header] : ''; });
  if (headers.indexOf('snapshot_total_co2e_unit') !== -1 && !migrated.snapshot_total_co2e_unit) {
    migrated.snapshot_total_co2e_unit = row.total_co2e_unit || (row.unit ? 'kg CO2e/' + row.unit : 'kg CO2e/unit');
  }
  if (headers.indexOf('emission_kgco2e') !== -1 && !migrated.emission_kgco2e && row.amount !== undefined && row.snapshot_total_co2e_factor !== undefined) {
    migrated.emission_kgco2e = toNumber_(row.amount) * toNumber_(row.snapshot_total_co2e_factor);
  }
  if (headers.indexOf('emission_tco2e') !== -1 && !migrated.emission_tco2e && migrated.emission_kgco2e !== '') {
    migrated.emission_tco2e = toNumber_(migrated.emission_kgco2e) / 1000;
  }
  if (headers.indexOf('total_co2e_unit') !== -1 && !migrated.total_co2e_unit) {
    migrated.total_co2e_unit = row.unit ? 'kg CO2e/' + row.unit : 'kg CO2e/unit';
  }
  return migrated;
}

function seedDefaultCompanySettings_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.COMPANY);
  if (sheet.getLastRow() > 1) return;
  const now = nowIso_();
  appendObjectRow_(sheet, {
    company_id: 'COMPANY-001',
    company_name: 'Example Company',
    site_name: 'Main Site',
    report_year: new Date().getFullYear(),
    base_year: new Date().getFullYear() - 1,
    prepared_by: 'Environment Engineer',
    created_at: now,
    updated_at: now
  });
}

function seedDepartments_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.DEPARTMENTS);
  if (sheet.getLastRow() > 1) return;
  const now = nowIso_();
  [
    ['Operations', 'Manufacturing and plant operations'],
    ['Facilities', 'Buildings, utilities, and maintenance'],
    ['Logistics', 'Fleet, transport, and warehousing'],
    ['Administration', 'Office and shared services']
  ].forEach(function(item) {
    appendObjectRow_(sheet, {
      department_id: generateId_('D'),
      department_name: item[0],
      description: item[1],
      is_active: true,
      created_at: now,
      updated_at: now
    });
  });
}

function seedEmissionFactors_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.FACTORS);
  if (sheet.getLastRow() > 1) return;
  getSampleEmissionFactors_().forEach(function(factor) {
    saveEmissionFactor(factor);
  });
}

function getSampleEmissionFactors_() {
  return [
    { activity_name: 'Diesel Fuel Combustion', activity_group: 'Stationary Fuel', scope: 'Scope 1', category: 'Fuel combustion', unit: 'liter', co2_factor: 2.68, fossil_ch4_factor: 0, ch4_factor: 0.0001, n2o_factor: 0.00006, total_co2e_factor: 2.71, factor_source: 'Sample internal factor', factor_year: 2025, gwp_version: 'AR6' },
    { activity_name: 'Gasoline Fuel Combustion', activity_group: 'Mobile Fuel', scope: 'Scope 1', category: 'Company vehicles', unit: 'liter', co2_factor: 2.31, fossil_ch4_factor: 0, ch4_factor: 0.0002, n2o_factor: 0.00005, total_co2e_factor: 2.34, factor_source: 'Sample internal factor', factor_year: 2025, gwp_version: 'AR6' },
    { activity_name: 'Purchased Electricity', activity_group: 'Electricity', scope: 'Scope 2', category: 'Location-based electricity', unit: 'kWh', co2_factor: 0, fossil_ch4_factor: 0, ch4_factor: 0, n2o_factor: 0, total_co2e_factor: 0.45, factor_source: 'Sample grid factor', factor_year: 2025, gwp_version: 'AR6' },
    { activity_name: 'Business Air Travel', activity_group: 'Business Travel', scope: 'Scope 3', category: 'Air travel', unit: 'passenger-km', co2_factor: 0, fossil_ch4_factor: 0, ch4_factor: 0, n2o_factor: 0, total_co2e_factor: 0.15, factor_source: 'Sample travel factor', factor_year: 2025, gwp_version: 'AR6' },
    { activity_name: 'Landfilled Waste', activity_group: 'Waste', scope: 'Scope 3', category: 'Waste generated in operations', unit: 'kg', co2_factor: 0, fossil_ch4_factor: 0, ch4_factor: 0, n2o_factor: 0, total_co2e_factor: 0.57, factor_source: 'Sample waste factor', factor_year: 2025, gwp_version: 'AR6' }
  ];
}

function importSampleEmissionFactors() {
  const existing = getEmissionFactors({ includeInactive: true }).map(function(f) { return String(f.activity_name).toLowerCase(); });
  let imported = 0;
  getSampleEmissionFactors_().forEach(function(factor) {
    if (existing.indexOf(String(factor.activity_name).toLowerCase()) === -1) {
      saveEmissionFactor(factor);
      imported++;
    }
  });
  return { success: true, imported: imported };
}
