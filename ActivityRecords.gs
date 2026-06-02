function getActivityRecords(filters) {
  return applyRecordFilters_(sheetRowsToObjects_(getSheet_(SHEET_NAMES.RECORDS)), filters)
    .sort(function(a, b) { return String(b.period).localeCompare(String(a.period)) || String(a.department_name).localeCompare(String(b.department_name)); });
}

function buildActivityRecordPayload_(data, existing) {
  data = data || {};
  requireFields_(data, ['year', 'month', 'department_id', 'factor_id', 'amount']);
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount must be numeric and greater than or equal to 0.');

  const departments = getDepartments({ includeInactive: true });
  const department = departments.find(function(item) { return String(item.department_id) === String(data.department_id); });
  if (!department) throw new Error('Department not found.');

  const factors = getEmissionFactors({ includeInactive: true });
  const factor = factors.find(function(item) { return String(item.factor_id) === String(data.factor_id); });
  if (!factor) throw new Error('Emission factor not found.');

  const co2Factor = toNumber_(factor.co2_factor);
  const fossilCh4Factor = toNumber_(factor.fossil_ch4_factor);
  const ch4Factor = toNumber_(factor.ch4_factor);
  const n2oFactor = toNumber_(factor.n2o_factor);
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
    factor_id: factor.factor_id,
    activity_name: factor.activity_name,
    activity_group: factor.activity_group,
    scope: factor.scope,
    category: factor.category,
    unit: factor.unit,
    amount: amount,
    snapshot_co2_factor: co2Factor,
    snapshot_fossil_ch4_factor: fossilCh4Factor,
    snapshot_ch4_factor: ch4Factor,
    snapshot_n2o_factor: n2oFactor,
    snapshot_total_co2e_factor: totalFactor,
    emission_co2: amount * co2Factor,
    emission_fossil_ch4: amount * fossilCh4Factor,
    emission_ch4: amount * ch4Factor,
    emission_n2o: amount * n2oFactor,
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
  return payload;
}

function updateActivityRecord(data) {
  data = data || {};
  requireFields_(data, ['record_id']);
  const found = findRowById_(SHEET_NAMES.RECORDS, 'record_id', data.record_id);
  const payload = buildActivityRecordPayload_(data, found.row);
  updateObjectRow_(found.sheet, found.rowNumber, payload);
  return payload;
}

function deleteActivityRecord(recordId) {
  const found = findRowById_(SHEET_NAMES.RECORDS, 'record_id', recordId);
  found.sheet.deleteRow(found.rowNumber);
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
  return saveActivityRecord(next);
}

function duplicateLastMonth(data) {
  data = data || {};
  requireFields_(data, ['year', 'month', 'department_id', 'factor_id']);
  const targetPeriod = makePeriod_(data.year, data.month);
  let sourceYear = Number(data.year);
  let sourceMonth = Number(data.month) - 1;
  if (sourceMonth < 1) { sourceMonth = 12; sourceYear -= 1; }
  const sourcePeriod = makePeriod_(sourceYear, sourceMonth);
  const records = getActivityRecords({ department_id: data.department_id, factor_id: data.factor_id });
  const source = records.find(function(row) { return row.period === sourcePeriod; });
  if (!source) throw new Error('No matching last-month record found for ' + sourcePeriod + '.');
  return duplicateActivityRecord(source.record_id, { year: Number(data.year), month: Number(data.month), period: targetPeriod });
}
