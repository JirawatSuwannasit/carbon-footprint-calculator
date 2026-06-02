function getReportData(filters) {
  filters = filters || {};
  const records = getActivityRecords(filters);
  const dashboard = getDashboardData(filters);
  const factorsById = getEmissionFactors({ includeInactive: true }).reduce(function(map, factor) {
    map[factor.factor_id] = factor;
    return map;
  }, {});
  const usedFactorIds = Array.from(new Set(records.map(function(row) { return row.factor_id; })));
  return {
    company: getCompanySettings(),
    filters: filters,
    summary: dashboard,
    records: records,
    factors: usedFactorIds.map(function(id) { return factorsById[id]; }).filter(Boolean)
  };
}

function exportRecordsCsv(filters) {
  const records = getActivityRecords(filters || {});
  const headers = HEADERS.Activity_Records;
  const lines = [headers.join(',')];
  records.forEach(function(record) {
    lines.push(headers.map(function(header) { return csvEscape_(record[header]); }).join(','));
  });
  return lines.join('\r\n');
}

function csvEscape_(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}
