/**
 * Google Sheets API service.
 * Calls are made directly from the browser using the user's OAuth access token
 * (acquired during Google sign-in with Sheets + Drive scopes).
 *
 * For a production app you would proxy these through Firebase Cloud Functions
 * to avoid exposing access tokens and to handle token refresh properly.
 */
import type { TrackerConfig, DataRow } from '../types';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

const HEADER_BG_COLOR = { red: 0.22, green: 0.46, blue: 0.9 } as const;

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

/** Column letter from 1-based index (1→A, 27→AA, etc.) */
export function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Create a new Google Spreadsheet, add headers, freeze the top row,
 * and add summary formulas at the bottom.
 */
export async function createSpreadsheet(
  config: Omit<TrackerConfig, 'id' | 'userId' | 'sheetId' | 'sheetUrl' | 'createdAt' | 'updatedAt'>,
  accessToken: string,
): Promise<{ sheetId: string; sheetUrl: string }> {
  // 1. Create the spreadsheet
  const createRes = await fetch(SHEETS_BASE, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify({ properties: { title: config.title } }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create spreadsheet: ${err}`);
  }

  const sheet = await createRes.json();
  const sheetId: string = sheet.spreadsheetId;
  const sheetUrl: string = sheet.spreadsheetUrl;
  const gid: number = sheet.sheets[0].properties.sheetId;

  // 2. Write header row
  const headerRow = config.columns.map((c) => c.name);
  await fetch(`${SHEETS_BASE}/${sheetId}/values/A1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: headers(accessToken),
    body: JSON.stringify({ values: [headerRow] }),
  });

  // 3. Format: bold headers, freeze row 1, set column widths
  const requests: object[] = [
    // Bold header row
    {
      repeatCell: {
        range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: HEADER_BG_COLOR } },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    },
    // Freeze row 1
    {
      updateSheetProperties: {
        properties: { sheetId: gid, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Auto-resize all columns
    {
      autoResizeDimensions: {
        dimensions: { sheetId: gid, dimension: 'COLUMNS', startIndex: 0, endIndex: config.columns.length },
      },
    },
  ];

  await fetch(`${SHEETS_BASE}/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify({ requests }),
  });

  // 4. Add summary formulas in a "Summary" tab
  if (config.summaryFormulas.length > 0) {
    // Add a second sheet for summaries
    const addSheetRes = await fetch(`${SHEETS_BASE}/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: headers(accessToken),
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: 'Summary' } } }],
      }),
    });
    const addSheetData = await addSheetRes.json();
    const summaryGid: number = addSheetData.replies[0].addSheet.properties.sheetId;

    // Write summary labels and formulas (reference the Data sheet)
    // For simplicity, rename sheet1 to "Data" first.
    await fetch(`${SHEETS_BASE}/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: headers(accessToken),
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: gid, title: 'Data' },
              fields: 'title',
            },
          },
        ],
      }),
    });

    // Now write the summary formulas referencing the Data sheet
    const correctedValues = config.summaryFormulas.map((f) => {
      // Replace bare cell references (ranges and single cells) with sheet-qualified ones
      const formula = f.formula.replace(/(?<!Data!)([A-Z]+\d+(?::[A-Z]+\d+)?)/g, "Data!$1");
      return [f.label, formula];
    });

    await fetch(
      `${SHEETS_BASE}/${sheetId}/values/Summary!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: headers(accessToken),
        body: JSON.stringify({ values: correctedValues }),
      },
    );

    // Bold summary labels
    await fetch(`${SHEETS_BASE}/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: headers(accessToken),
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId: summaryGid, startRowIndex: 0, endRowIndex: correctedValues.length, startColumnIndex: 0, endColumnIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          },
        ],
      }),
    });
  }

  return { sheetId, sheetUrl };
}

/**
 * Append a new data row to the sheet.
 */
export async function appendRow(
  sheetId: string,
  values: (string | number | null)[],
  accessToken: string,
): Promise<number> {
  const res = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/Data!A:Z:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: headers(accessToken),
      body: JSON.stringify({ values: [values] }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to append row: ${err}`);
  }

  const data = await res.json();
  // Extract the row number from the updated range (e.g. "Data!A5:D5" → 5)
  const range: string = data.updates?.updatedRange ?? '';
  const match = range.match(/(\d+):/);
  return match ? parseInt(match[1], 10) : -1;
}

/**
 * Update an existing row in the sheet.
 */
export async function updateRow(
  sheetId: string,
  rowIndex: number,
  values: (string | number | null)[],
  accessToken: string,
): Promise<void> {
  const endCol = colLetter(values.length);
  const range = `Data!A${rowIndex}:${endCol}${rowIndex}`;

  const res = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: headers(accessToken),
      body: JSON.stringify({ values: [values] }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update row: ${err}`);
  }
}

/**
 * Delete a row by its 1-based row index (using batchUpdate to delete the row).
 */
export async function deleteRow(
  sheetId: string,
  rowIndex: number,
  accessToken: string,
): Promise<void> {
  // We need the numeric sheetId for batchUpdate – fetch it first
  const metaRes = await fetch(`${SHEETS_BASE}/${sheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();
  const dataSheet = (meta.sheets as Array<{ properties: { title: string; sheetId: number } }>).find(
    (s) => s.properties.title === 'Data',
  );
  const gid = dataSheet?.properties.sheetId ?? 0;

  await fetch(`${SHEETS_BASE}/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: gid,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-based
              endIndex: rowIndex,
            },
          },
        },
      ],
    }),
  });
}

/**
 * Read all data rows (excluding header) from the sheet.
 */
export async function readRows(
  sheetId: string,
  accessToken: string,
): Promise<string[][]> {
  const res = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/Data!A2:Z1000`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data.values ?? []) as string[][];
}

/**
 * Move the spreadsheet to the user's "My Drive" (it already is there by default,
 * this just makes it available as a shareable link).
 */
export async function makeSpreadsheetPublicViewable(
  sheetId: string,
  accessToken: string,
): Promise<void> {
  await fetch(`${DRIVE_BASE}/files/${sheetId}/permissions`, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify({ type: 'anyone', role: 'reader' }),
  });
}

/**
 * Build the flat values array for a row from the column config and row data.
 */
export function buildRowValues(
  columns: TrackerConfig['columns'],
  rowData: DataRow['values'],
): (string | number | null)[] {
  return columns.map((col) => {
    if (col.formula) {
      // Let Google Sheets evaluate the formula
      return col.formula;
    }
    const val = rowData[col.name];
    if (val === undefined || val === null) return null;
    return val;
  });
}
