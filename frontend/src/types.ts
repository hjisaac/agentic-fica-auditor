export enum AuditStatus {
  ACCEPT = 'ACCEPT',
  REVIEW = 'REVIEW',
  REJECT = 'REJECT'
}

export enum CaseType {
  KYC = 'KYC',
  KYB = 'KYB'
}

export enum StepType {
  THOUGHT = 'THOUGHT',
  ACTION = 'ACTION',
  OBSERVATION = 'OBSERVATION',
  DECISION = 'DECISION'
}

export interface BatchItem {
  id?: string;
  first_names: string;
  last_name: string;
  id_number: string;
  bank_name?: string;
  account_number?: string;
  status?: AuditStatus;
  risk_score?: number;
  error?: string;
}
