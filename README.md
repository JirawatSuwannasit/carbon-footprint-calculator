# Internal Carbon Footprint Calculator

A simple Google Apps Script web application that uses Google Sheets as the database for one company's internal monthly carbon accounting workflow. It is designed for an Environment Engineer to collect activity data, snapshot emission factors, calculate emissions, review dashboards, print reports, and export CSV files.

## Features

- Dashboard with year, month, department, and scope filters
- Summary cards for total emissions, scope totals, top department, and top activity
- Chart.js charts for monthly trends, scope, department, activity, and top sources
- Add/edit/delete/duplicate activity records
- Automatic total CO2e factor snapshotting when a record is saved
- Gas factor references retained in the emission factor master, with activity records storing kgCO2e and tCO2e
- Department master with add/edit/deactivate actions
- Emission factor master with add/edit/deactivate and sample factor import
- Printable report with company info, summaries, records, and factor references
- Excel-compatible CSV export
- `setupDatabase()` creates required sheets and headers automatically

## Google Sheet database

The database is the spreadsheet attached to the Apps Script project. `setupDatabase()` creates these sheets:

1. `Company_Settings`
2. `Departments`
3. `Emission_Factors`
4. `Activity_Records`

The function also seeds default company settings, sample departments, and sample emission factors if the relevant sheets are empty.

## Calculation logic

When an activity record is saved, the app:

1. Reads the selected active or historical emission factor.
2. Copies only the total CO2e factor reference into the activity record snapshot fields:
   - `snapshot_total_co2e_factor`
   - `snapshot_total_co2e_unit`
3. Calculates and stores:
   - `emission_kgco2e = amount × snapshot_total_co2e_factor`
   - `emission_tco2e = emission_kgco2e / 1000`

CO2, Fossil CH4, CH4, and N2O factors are stored only in `Emission_Factors` for reference. Existing activity records are not recalculated when the master factor changes unless the user edits that record.

## Project files

- `appsscript.json` - Apps Script manifest
- `Code.gs` - web app entry point
- `Database.gs` - sheet setup and seed data
- `Utils.gs` - shared helpers for IDs, header mapping, row mapping, filters, and validation
- `Company.gs` - company settings API
- `Departments.gs` - department master API
- `EmissionFactors.gs` - emission factor master API
- `ActivityRecords.gs` - activity record API and calculations
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
7. Confirm the four sheets were created and sample data was inserted.

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


## Troubleshooting Activity Records

If the Activity Records page is empty, first confirm the `Activity_Records` sheet exists and that the first columns match the expected headers in `Utils.gs`. The web app now shows an empty-state message when no records match the filters and a clear error toast/table message when the backend cannot read the sheet. Technical details are also written to the browser console and Apps Script `Logger` from `getActivityRecords()`.

Button actions now show loading text, disable during processing to prevent double submissions, and display success/error notifications after completion.

## CSV export

The Report page's **Export CSV** button exports filtered `Activity_Records` data as a comma-separated file that can be opened in Excel or other spreadsheet tools.

## Notes for production use

- Confirm all emission factor values, units, source references, years, and GWP versions before official reporting.
- Keep the Google Sheet protected so only the Environment Engineer or designated owner can edit data.
- Consider periodic spreadsheet backups before major data imports or edits.
