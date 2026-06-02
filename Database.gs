function setupDatabase() {
  if (globalThis.__CARBON_DB_SETUP_RUNNING__) return { success: true, message: 'Database setup already running.' };
  globalThis.__CARBON_DB_SETUP_RUNNING__ = true;
  try {
    const spreadsheet = getSpreadsheet_();
    Object.keys(HEADERS).forEach(function(sheetName) {
      let sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
      const headers = HEADERS[sheetName];
      const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
      const currentHeaders = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
      if (currentHeaders.slice(0, headers.length).join('|') !== headers.join('|')) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.setFrozenRows(1);
      }
      sheet.autoResizeColumns(1, headers.length);
    });
    seedDefaultCompanySettings_();
    seedDepartments_();
    seedEmissionFactors_();
    return { success: true, message: 'Database setup completed.' };
  } finally {
    globalThis.__CARBON_DB_SETUP_RUNNING__ = false;
  }
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
