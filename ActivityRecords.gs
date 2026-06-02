function getActivityRecords(filters) {
  Logger.log('getActivityRecords called with filters: ' + JSON.stringify(filters || {}));
  try {
    const sheet = getSheet_(SHEET_NAMES.RECORDS);
    Logger.log('Reading sheet name: ' + sheet.getName());
    validateSheetHeaders_(sheet, HEADERS.Activity_Records);

    const headersFound = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.Activity_Records.length)).getValues()[0]
      .slice(0, HEADERS.Activity_Records.length);
    Logger.log('Activity_Records headers found: ' + headersFound.join(', '));
    Logger.log('Activity_Records sheet dimensions: lastRow=' + sheet.getLastRow() + ', lastColumn=' + sheet.getLastColumn());

    const rows = readActivityRecordsForClient_(sheet);
    Logger.log('Activity_Records rows found before filters: ' + rows.length);

    const filteredRows = applyRecordFilters_(rows, filters);
    Logger.log('Activity_Records rows found after filters: ' + filteredRows.length);

    const records = filteredRows.sort(function(a, b) {
      return String(b.period).localeCompare(String(a.period)) || String(a.department_name).localeCompare(String(b.department_name));
    });

    Logger.log('getActivityRecords final return is array: ' + Array.isArray(records) + ', count=' + records.length);
    return records;
  } catch (error) {
    Logger.log('Cannot load Activity_Records: ' + error.message + '\n' + (error.stack || ''));
    throw new Error('Activity_Records sheet not found or headers are invalid. ' + error.message);
  }
}

function readActivityRecordsForClient_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return cell !== ''; });
  }).map(function(row) {
    const record = {};
    HEADERS.Activity_Records.forEach(function(header) {
      const columnIndex = headers.indexOf(header);
      record[header] = sanitizeForClient_(columnIndex === -1 ? '' : row[columnIndex]);
    });
    return record;
  });
}

function sanitizeForClient_(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return '';
  return value;
}


function buildActivityRecordPayload_(data, existing) {
  data = data || {};
  requireFields_(data, ['year', 'month', 'department_id', 'activity_id', 'amount']);
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount must be numeric and greater than or equal to 0.');

  const departments = getDepartments({ includeInactive: true });
  const department = departments.find(function(item) { return String(item.department_id) === String(data.department_id); });
  if (!department) throw new Error('Department not found.');

  const allowedActivities = getActivitiesByDepartment(department.department_id);
  const activityWithFactor = allowedActivities.find(function(item) { return String(item.activity_id) === String(data.activity_id); });
  if (!activityWithFactor) throw new Error('Selected activity is not assigned to this department or is inactive.');
  const factor = getFactorById(activityWithFactor.factor_id);
  if (!toBoolean_(factor.is_active)) throw new Error('Selected activity default emission factor is inactive.');

  const totalFactor = toNumber_(factor.total_co2e_factor);
  const kgco2e = amount * totalFactor;
  const now = nowIso_();

  return {
    record_id: data.record_id || generateId_('R'),
    year: Number(data.year),
    month: normalizeMonth_(data.month),
    period: makePeriod_(data.year, data.month),
    department_id: department.department_id,
    department_name: department.department_name,
    activity_id: activityWithFactor.activity_id,
    activity_name: activityWithFactor.activity_name,
    activity_group: activityWithFactor.activity_group,
    scope: activityWithFactor.scope,
    category: activityWithFactor.category,
    unit: activityWithFactor.unit,
    factor_id: factor.factor_id,
    amount: amount,
    snapshot_total_co2e_factor: totalFactor,
    snapshot_total_co2e_unit: factor.total_co2e_unit || 'kg CO2e/' + (activityWithFactor.unit || 'unit'),
    emission_kgco2e: kgco2e,
    emission_tco2e: kgco2e / 1000,
    factor_source: factor.factor_source,
    factor_year: factor.factor_year,
    gwp_version: factor.gwp_version,
    remark: data.remark || '',
    created_at: existing ? existing.created_at : now,
    updated_at: now
  };
}

function saveActivityRecord(data) {
  const payload = buildActivityRecordPayload_(data);
  appendObjectRow_(getSheet_(SHEET_NAMES.RECORDS), payload);
  Logger.log('Saved Activity_Records record_id=' + payload.record_id + ', period=' + payload.period + ', emission_tco2e=' + payload.emission_tco2e);
  return payload;
}

function updateActivityRecord(data) {
  data = data || {};
  requireFields_(data, ['record_id']);
  const found = findRowById_(SHEET_NAMES.RECORDS, 'record_id', data.record_id);
  const payload = buildActivityRecordPayload_(data, found.row);
  updateObjectRow_(found.sheet, found.rowNumber, payload);
  Logger.log('Updated Activity_Records record_id=' + payload.record_id + ', row=' + found.rowNumber);
  return payload;
}

function deleteActivityRecord(recordId) {
  const found = findRowById_(SHEET_NAMES.RECORDS, 'record_id', recordId);
  found.sheet.deleteRow(found.rowNumber);
  Logger.log('Deleted Activity_Records record_id=' + recordId + ', row=' + found.rowNumber);
  return { success: true };
}

function duplicateActivityRecord(recordId, overrides) {
  const found = findRowById_(SHEET_NAMES.RECORDS, 'record_id', recordId);
  const source = found.row;
  const next = Object.assign({}, source, overrides || {});
  delete next.record_id;
  if (!overrides || (!overrides.year && !overrides.month)) {
    let year = Number(source.year);
    let month = Number(source.month) + 1;
    if (month > 12) { month = 1; year += 1; }
    next.year = year;
    next.month = month;
  }
  const duplicated = saveActivityRecord(next);
  Logger.log('Duplicated Activity_Records source=' + recordId + ', new=' + duplicated.record_id);
  return duplicated;
}

function duplicateLastMonth(data) {
  data = data || {};
  requireFields_(data, ['year', 'month', 'department_id', 'activity_id']);
  const targetPeriod = makePeriod_(data.year, data.month);
  let sourceYear = Number(data.year);
  let sourceMonth = Number(data.month) - 1;
  if (sourceMonth < 1) { sourceMonth = 12; sourceYear -= 1; }
  const sourcePeriod = makePeriod_(sourceYear, sourceMonth);
  const records = getActivityRecords({ department_id: data.department_id, activity_id: data.activity_id });
  const source = records.find(function(row) { return row.period === sourcePeriod; });
  if (!source) throw new Error('No matching last-month record found for ' + sourcePeriod + '.');
  return duplicateActivityRecord(source.record_id, { year: Number(data.year), month: Number(data.month), period: targetPeriod });
}
