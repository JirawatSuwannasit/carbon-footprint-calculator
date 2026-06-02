function getCompanySettings() {
  const rows = sheetRowsToObjects_(getSheet_(SHEET_NAMES.COMPANY));
  return rows[0] || {};
}

function saveCompanySettings(data) {
  data = data || {};
  requireFields_(data, ['company_name', 'site_name', 'report_year', 'prepared_by']);
  const sheet = getSheet_(SHEET_NAMES.COMPANY);
  const current = sheetRowsToObjects_(sheet)[0];
  const now = nowIso_();
  const payload = {
    company_id: data.company_id || (current && current.company_id) || 'COMPANY-001',
    company_name: data.company_name,
    site_name: data.site_name,
    report_year: data.report_year,
    base_year: data.base_year || '',
    prepared_by: data.prepared_by,
    created_at: current ? current.created_at : now,
    updated_at: now
  };
  if (current) updateObjectRow_(sheet, current._rowNumber, payload);
  else appendObjectRow_(sheet, payload);
  return payload;
}
