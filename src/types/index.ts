export interface TrackerColumn {
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  formula?: string; // optional Google Sheets formula template
}

export interface TrackerConfig {
  id: string;
  userId: string;
  title: string;
  description: string;
  columns: TrackerColumn[];
  sheetId: string; // Google Sheets spreadsheet ID
  sheetUrl: string;
  summaryFormulas: SummaryFormula[];
  cashbackRate?: number; // e.g. 0.02 for 2%
  createdAt: Date;
  updatedAt: Date;
}

export interface SummaryFormula {
  label: string;
  formula: string; // e.g. "=SUM(C2:C1000)"
  column?: string; // target column for the formula
}

export interface DataRow {
  id: string;
  trackerId: string;
  values: Record<string, string | number | null>;
  rowIndex: number; // 1-based row index in the sheet (2+ because row 1 is headers)
  createdAt: Date;
  updatedAt: Date;
}

export interface ClarifyingQuestion {
  question: string;
  fieldName: string;
  options?: string[];
}

export interface ParsedTrackerIntent {
  title: string;
  description: string;
  columns: TrackerColumn[];
  summaryFormulas: SummaryFormula[];
  cashbackRate?: number;
  clarifyingQuestions?: ClarifyingQuestion[];
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  accessToken: string | null; // Google OAuth access token for Sheets API
}
