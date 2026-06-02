# Internal Carbon Footprint Calculator

A simple Google Apps Script web application that uses Google Sheets as the database for one company's internal monthly carbon accounting workflow. It is designed for an Environment Engineer to collect activity data, snapshot emission factors, calculate emissions, review dashboards, print reports, and export CSV files.

## Features

- Dashboard with year, month, department, and scope filters
- Summary cards for total emissions, scope totals, top department, and top activity
- Chart.js charts for monthly trends, scope, department, activity, and top sources
- Add/edit/delete/duplicate activity records
- Automatic total CO2e factor snapshotting when a record is saved
- Emission factor values retained in the emission factor master, with activity records storing activity snapshots, factor snapshots, kgCO2e, and tCO2e
- Department master with add/edit/deactivate actions
- Emission factor master with add/edit/deactivate and sample factor import
- Activity master with default emission factors and department assignment controls
- Printable report with company info, summaries, records, and factor references
- Excel-compatible CSV export
- `setupDatabase()` creates required sheets and headers automatically

## Google Sheet database

The database is the spreadsheet attached to the Apps Script project. `setupDatabase()` creates these sheets:

1. `Company_Settings`
2. `Departments`
3. `Emission_Factors`
4. `Activity_Master`
5. `Department_Activities`
6. `Activity_Records`

The function also seeds default company settings, sample departments, sample emission factors, sample business activities, and sample department-activity mappings if the relevant sheets are empty.

## Calculation logic

When an activity record is saved, the app:

1. Reads the selected active activity from `Activity_Master` and its `default_factor_id` from `Emission_Factors`.
2. Copies only the total CO2e factor reference into the activity record snapshot fields:
   - `snapshot_total_co2e_factor`
   - `snapshot_total_co2e_unit`
3. Calculates and stores:
   - `emission_kgco2e = amount × snapshot_total_co2e_factor`
   - `emission_tco2e = emission_kgco2e / 1000`

`Activity_Master` stores business fields (`activity_name`, `group`, `scope`, `category`, and `unit`). `Emission_Factors` stores factor values and reference metadata only. `Department_Activities` maps departments to `Activity_Master` rows by `activity_id`, not directly to factor rows. Existing activity records are not recalculated when an activity or factor changes unless the user edits that record.

## Project files

- `appsscript.json` - Apps Script manifest
- `Code.gs` - web app entry point
- `Database.gs` - sheet setup and seed data
- `Utils.gs` - shared helpers for IDs, header mapping, row mapping, filters, and validation
- `Company.gs` - company settings API
- `Departments.gs` - department master API
- `EmissionFactors.gs` - emission factor database API
- `ActivityMaster.gs` - business activity master API
- `ActivityRecords.gs` - activity record API and calculations
- `DepartmentActivities.gs` - department-to-activity assignment API
- `Dashboard.gs` - dashboard aggregation API
- `Report.gs` - report data and CSV export API
- `Index.html` - single-page web app shell
- `Styles.html` - responsive and print CSS
- `Scripts.html` - frontend UI logic using `google.script.run`

## Setup in Google Apps Script

1. Create a new Google Sheet for the carbon calculator database.
2. Open **Extensions > Apps Script** from the Sheet.
3. Copy this repository's `.gs`, `.html`, and `appsscript.json` files into the Apps Script project.
4. Save the project.
5. Run `setupDatabase()` from the Apps Script editor once.
6. Approve the required spreadsheet permissions.
7. Confirm the six sheets were created and sample data was inserted.

## Using clasp with GitHub

Install and authenticate `clasp`:

```bash
npm install -g @google/clasp
clasp login
```

Create or connect the Apps Script project:

```bash
# Option A: create a new bound or standalone script, then push this source
clasp create --type sheets --title "Carbon Footprint Calculator"
clasp push

# Option B: clone an existing Apps Script project into this repo
clasp clone <SCRIPT_ID>
```

Recommended GitHub workflow:

```bash
git init
git add .
git commit -m "Initial carbon footprint calculator MVP"
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

Typical development loop:

```bash
# Pull latest Apps Script changes if edits were made in the online editor
clasp pull

# Push local GitHub source to Apps Script
clasp push

# Open the Apps Script editor
clasp open
```

If this is a repository-first project, keep source of truth in GitHub and use `clasp push` to deploy changes to Apps Script.

## Deploying as a Google Apps Script Web App

1. Push the source with `clasp push` or save it in the Apps Script editor.
2. In Apps Script, run `setupDatabase()` once and approve permissions.
3. Click **Deploy > New deployment**.
4. Select **Web app**.
5. Set **Execute as** to **Me**.
6. Set **Who has access** according to your internal policy. For a one-user internal app, choose yourself or your organization as appropriate.
7. Click **Deploy**.
8. Open the web app URL and verify the dashboard loads.

For subsequent releases, use **Deploy > Manage deployments > Edit** and select a new version.

## Sample seed data

### Departments

- Operations - Manufacturing and plant operations
- Facilities - Buildings, utilities, and maintenance
- Logistics - Fleet, transport, and warehousing
- Administration - Office and shared services

### Emission factors

The MVP includes sample factors for:

- Diesel Fuel Combustion
- Gasoline Fuel Combustion
- Purchased Electricity
- Business Air Travel
- Landfilled Waste

These are sample placeholder factors only. Replace them with your company's approved factor sources before using the calculator for official reporting.



## Activity master and department assignments

The app uses this architecture: `Departments → Department_Activities → Activity_Master → Emission_Factors`.

- `Emission_Factors` stores factor values and reference metadata only (`factor_name`, gas factors, total CO2e factor/unit, source/year/GWP).
- `Activity_Master` stores business activities (`activity_name`, `group`, `scope`, `category`, `unit`) and each activity's `default_factor_id`.
- `Department_Activities` maps departments to activities by `activity_id`; it does not store `factor_id`.

The Add Activity Record form disables the Activity Name dropdown until a department is selected, then loads only active assigned activities through `getActivitiesByDepartment(departmentId)`. If no active activities are assigned, the form shows "No activities assigned to this department. Please set activities in Department Master."

Activities can be managed in the **Activity Master** section inside the Emission Factor Master page. Department activity assignments are managed from the **Set Activities** button in each Department Master row.

## Troubleshooting Activity Records

If the Activity Records page is empty, first confirm the `Activity_Records` sheet exists and that the first columns match the expected headers in `Utils.gs`. The `getActivityRecords()` API contract is to return an array directly (`[]` when no records exist) and throw an error for sheet/header problems. The web app now logs the raw `getActivityRecords()` response shape, shows an empty-state message when no records match the filters, and shows a clear error toast/table message when the backend cannot read the sheet. Technical details are also written to the browser console and Apps Script `Logger` from `getActivityRecords()`.

Button actions now show loading text, disable during processing to prevent double submissions, and display success/error notifications after completion.

## CSV export

The Report page's **Export CSV** button exports filtered `Activity_Records` data as a comma-separated file that can be opened in Excel or other spreadsheet tools.

## Notes for production use

- Confirm all emission factor values, units, source references, years, and GWP versions before official reporting.
- Keep the Google Sheet protected so only the Environment Engineer or designated owner can edit data.
- Consider periodic spreadsheet backups before major data imports or edits.
