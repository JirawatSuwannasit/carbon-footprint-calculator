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
    seedActivities_();
    seedDepartmentActivities_();
    return { success: true, message: 'Database setup completed.' };
  } finally {
    globalThis.__CARBON_DB_SETUP_RUNNING__ = false;
  }
}

function ensureSheetHeaders_(sheet, headers) {
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const existingHeaders = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
  const firstHeaders = existingHeaders.slice(0, headers.length);
  if (firstHeaders.join('|') === headers.join('|')) {
    sheet.setFrozenRows(1);
    return;
  }

  const existingRows = sheet.getLastRow() > 1 ? sheetRowsToObjectsWithoutSetup_(sheet) : [];
  const migratedRows = existingRows.map(function(row) { return migrateRowForHeaders_(row, headers); });
  if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), headers.length).clearContent();
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
  if (headers.indexOf('factor_name') !== -1 && !migrated.factor_name) {
    migrated.factor_name = row.factor_name || row.activity_name || '';
  }
  if (headers.indexOf('group') !== -1 && !migrated.group) {
    migrated.group = row.group || row['activity_' + 'group'] || '';
  }
  if (headers.indexOf('activity_id') !== -1 && !migrated.activity_id && row.activity_name) {
    migrated.activity_id = row.activity_id || '';
  }
  if (headers.indexOf('default_factor_id') !== -1 && !migrated.default_factor_id) {
    migrated.default_factor_id = row.default_factor_id || row.factor_id || '';
  }
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



function seedActivities_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.ACTIVITIES);
  if (sheet.getLastRow() > 1) return;
  const factorsByName = getEmissionFactors({ includeInactive: true }).reduce(function(map, factor) {
    map[String(factor.factor_name).toLowerCase()] = factor;
    return map;
  }, {});
  getSampleActivities_().forEach(function(activity) {
    const factor = factorsByName[String(activity.default_factor_name).toLowerCase()];
    if (factor) {
      saveActivity({
        activity_name: activity.activity_name,
        group: activity.group,
        scope: activity.scope,
        category: activity.category,
        unit: activity.unit,
        default_factor_id: factor.factor_id,
        is_active: true
      });
    }
  });
}


function seedDepartmentActivities_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.DEPARTMENT_ACTIVITIES);
  const existingRows = sheetRowsToObjects_(sheet);
  if (existingRows.some(function(row) { return row.activity_id; })) return;
  const departments = getDepartments({ includeInactive: true });
  const activities = getActivities({ includeInactive: true });
  const departmentByName = departments.reduce(function(map, department) {
    map[String(department.department_name).toLowerCase()] = department;
    return map;
  }, {});
  const activityByName = activities.reduce(function(map, activity) {
    map[String(activity.activity_name).toLowerCase()] = activity;
    return map;
  }, {});
  const mappings = [
    ['Operations', 'Diesel Fuel Combustion'],
    ['Operations', 'Purchased Electricity'],
    ['Facilities', 'Purchased Electricity'],
    ['Facilities', 'Landfilled Waste'],
    ['Logistics', 'Diesel Fuel Combustion'],
    ['Logistics', 'Gasoline Fuel Combustion'],
    ['Administration', 'Purchased Electricity'],
    ['Administration', 'Business Air Travel']
  ];
  mappings.forEach(function(item) {
    const department = departmentByName[String(item[0]).toLowerCase()];
    const activity = activityByName[String(item[1]).toLowerCase()];
    if (department && activity) {
      saveDepartmentActivity({ department_id: department.department_id, activity_id: activity.activity_id });
    }
  });
}

function getSampleEmissionFactors_() {
  return [
    { factor_name: 'Diesel Fuel Combustion Factor', co2_factor: 2.68, fossil_ch4_factor: 0, ch4_factor: 0.0001, n2o_factor: 0.00006, total_co2e_factor: 2.71, total_co2e_unit: 'kg CO2e/liter', factor_source: 'Sample internal factor', factor_year: 2025, gwp_version: 'AR6' },
    { factor_name: 'Gasoline Fuel Combustion Factor', co2_factor: 2.31, fossil_ch4_factor: 0, ch4_factor: 0.0002, n2o_factor: 0.00005, total_co2e_factor: 2.34, total_co2e_unit: 'kg CO2e/liter', factor_source: 'Sample internal factor', factor_year: 2025, gwp_version: 'AR6' },
    { factor_name: 'Purchased Electricity Grid Factor', co2_factor: 0, fossil_ch4_factor: 0, ch4_factor: 0, n2o_factor: 0, total_co2e_factor: 0.45, total_co2e_unit: 'kg CO2e/kWh', factor_source: 'Sample grid factor', factor_year: 2025, gwp_version: 'AR6' },
    { factor_name: 'Business Air Travel Factor', co2_factor: 0, fossil_ch4_factor: 0, ch4_factor: 0, n2o_factor: 0, total_co2e_factor: 0.15, total_co2e_unit: 'kg CO2e/passenger-km', factor_source: 'Sample travel factor', factor_year: 2025, gwp_version: 'AR6' },
    { factor_name: 'Landfilled Waste Factor', co2_factor: 0, fossil_ch4_factor: 0, ch4_factor: 0, n2o_factor: 0, total_co2e_factor: 0.57, total_co2e_unit: 'kg CO2e/kg', factor_source: 'Sample waste factor', factor_year: 2025, gwp_version: 'AR6' }
  ];
}


function getSampleActivities_() {
  return [
    { activity_name: 'Diesel Fuel Combustion', group: 'Stationary Fuel', scope: 'Scope 1', category: 'Fuel combustion', unit: 'liter', default_factor_name: 'Diesel Fuel Combustion Factor' },
    { activity_name: 'Gasoline Fuel Combustion', group: 'Mobile Fuel', scope: 'Scope 1', category: 'Company vehicles', unit: 'liter', default_factor_name: 'Gasoline Fuel Combustion Factor' },
    { activity_name: 'Purchased Electricity', group: 'Electricity', scope: 'Scope 2', category: 'Location-based electricity', unit: 'kWh', default_factor_name: 'Purchased Electricity Grid Factor' },
    { activity_name: 'Business Air Travel', group: 'Business Travel', scope: 'Scope 3', category: 'Air travel', unit: 'passenger-km', default_factor_name: 'Business Air Travel Factor' },
    { activity_name: 'Landfilled Waste', group: 'Waste', scope: 'Scope 3', category: 'Waste generated in operations', unit: 'kg', default_factor_name: 'Landfilled Waste Factor' }
  ];
}

function importSampleEmissionFactors() {
  const existing = getEmissionFactors({ includeInactive: true }).map(function(f) { return String(f.factor_name).toLowerCase(); });
  let imported = 0;
  getSampleEmissionFactors_().forEach(function(factor) {
    if (existing.indexOf(String(factor.factor_name).toLowerCase()) === -1) {
      saveEmissionFactor(factor);
      imported++;
    }
  });
  return { success: true, imported: imported };
}
