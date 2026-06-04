function getDashboardData(filters) {
  const records = getActivityRecords(filters || {});
  const total = records.reduce(function(sum, row) { return sum + toNumber_(row.emission_tco2e); }, 0);
  const byScope = sumBy_(records, 'scope', 'emission_tco2e');
  const byDepartment = sumBy_(records, 'department_name', 'emission_tco2e');
  const byActivity = sumBy_(records, 'activity_name', 'emission_tco2e');
  const monthly = {};
  records.forEach(function(row) { monthly[row.period] = (monthly[row.period] || 0) + toNumber_(row.emission_tco2e); });
  const monthlyTrend = Object.keys(monthly).sort().map(function(period) { return { label: period, value: monthly[period] }; });
  const scopeTotals = { 'Scope 1': 0, 'Scope 2': 0, 'Scope 3': 0 };
  byScope.forEach(function(item) { scopeTotals[item.label] = item.value; });
  return {
    filters: filters || {},
    total_tco2e: total,
    scope1_tco2e: scopeTotals['Scope 1'] || 0,
    scope2_tco2e: scopeTotals['Scope 2'] || 0,
    scope3_tco2e: scopeTotals['Scope 3'] || 0,
    top_department: byDepartment[0] || { label: 'N/A', value: 0 },
    top_activity: byActivity[0] || { label: 'N/A', value: 0 },
    monthly_trend: monthlyTrend,
    by_scope: byScope,
    by_department: byDepartment,
    by_activity: byActivity,
    top_sources: byActivity.slice(0, 5),
    years: getUniqueValues_(sheetRowsToObjects_(getSheet_(SHEET_NAMES.RECORDS)), 'year')
  };
}
