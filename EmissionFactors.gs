function getEmissionFactors(options) {
  options = options || {};
  const term = String(options.search || '').toLowerCase();
  return sheetRowsToObjects_(getSheet_(SHEET_NAMES.FACTORS)).filter(function(row) {
    const activeMatch = options.includeInactive || toBoolean_(row.is_active);
    const termMatch = !term || [row.activity_name, row.activity_group, row.scope, row.category, row.factor_source].join(' ').toLowerCase().indexOf(term) !== -1;
    return activeMatch && termMatch;
  }).sort(function(a, b) { return String(a.activity_name).localeCompare(String(b.activity_name)); });
}

function buildEmissionFactorPayload_(data, existing) {
  data = data || {};
  requireFields_(data, ['activity_name', 'activity_group', 'scope', 'category', 'unit', 'total_co2e_factor']);
  const now = nowIso_();
  return {
    factor_id: data.factor_id || generateId_('EF'),
    activity_name: String(data.activity_name).trim(),
    activity_group: data.activity_group || '',
    scope: data.scope || '',
    category: data.category || '',
    unit: data.unit || '',
    co2_factor: toNumber_(data.co2_factor),
    fossil_ch4_factor: toNumber_(data.fossil_ch4_factor),
    ch4_factor: toNumber_(data.ch4_factor),
    n2o_factor: toNumber_(data.n2o_factor),
    total_co2e_factor: toNumber_(data.total_co2e_factor),
    total_co2e_unit: data.total_co2e_unit || 'kg CO2e/' + (data.unit || 'unit'),
    factor_source: data.factor_source || '',
    factor_year: data.factor_year || '',
    gwp_version: data.gwp_version || '',
    is_active: data.is_active === undefined ? true : toBoolean_(data.is_active),
    created_at: existing ? existing.created_at : now,
    updated_at: now
  };
}

function saveEmissionFactor(data) {
  const payload = buildEmissionFactorPayload_(data);
  appendObjectRow_(getSheet_(SHEET_NAMES.FACTORS), payload);
  return payload;
}

function updateEmissionFactor(data) {
  data = data || {};
  requireFields_(data, ['factor_id']);
  const found = findRowById_(SHEET_NAMES.FACTORS, 'factor_id', data.factor_id);
  const payload = buildEmissionFactorPayload_(data, found.row);
  updateObjectRow_(found.sheet, found.rowNumber, payload);
  return payload;
}

function deactivateEmissionFactor(factorId) {
  const found = findRowById_(SHEET_NAMES.FACTORS, 'factor_id', factorId);
  updateObjectRow_(found.sheet, found.rowNumber, { is_active: false, updated_at: nowIso_() });
  return { success: true };
}
