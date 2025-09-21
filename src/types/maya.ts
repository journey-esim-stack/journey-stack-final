// Maya eSIM API response types
export interface MayaESIMStatus {
  state?: string;
  service_status?: string;
  network_status?: string;
}

export interface MayaESIMData {
  iccid?: string;
  activation_code?: string;
  manual_code?: string;
  smdp_address?: string;
  uid?: string;
  state?: string;
  service_status?: string;
  network_status?: string;
  plan?: {
    end_time?: string;
    data_quota_bytes?: number;
  };
}

export interface MayaAPIResponse {
  result: number;
  message?: string;
  developer_message?: string;
  errorCode?: string;
  error_code?: string;
  esim?: MayaESIMData;
  status?: MayaESIMStatus;
}

// Parsed Maya status for frontend consumption
export interface ParsedMayaStatus {
  state?: string;
  network_status?: string;
  service_status?: string;
  displayStatus: string;
  isConnected: boolean;
  isActive: boolean;
  statusColor: string;
  statusText: string;
}