import { MayaESIMStatus, ParsedMayaStatus } from '@/types/maya';

/**
 * Centralized Maya eSIM status parsing utility
 * Handles both JSON and legacy string formats consistently
 */
export class MayaStatusParser {
  /**
   * Parse Maya real_status from any format (JSON string, object, or legacy string)
   */
  static parseRealStatus(input: any): MayaESIMStatus {
    if (!input) return {};

    try {
      // Handle JSON string format
      if (typeof input === 'string') {
        const trimmed = input.trim();
        
        // Try parsing as JSON first
        if (trimmed.startsWith('{')) {
          const parsed = JSON.parse(trimmed);
          return {
            state: parsed.state || parsed.esim?.state,
            network_status: parsed.network_status || parsed.esim?.network_status,
            service_status: parsed.service_status || parsed.esim?.service_status
          };
        }
        
        // Parse legacy string format: "state: RELEASED, service: ACTIVE, network: ENABLED"
        return this.parseLegacyString(trimmed);
      }
      
      // Handle object format
      if (typeof input === 'object') {
        return {
          state: input.state || input.esim?.state,
          network_status: input.network_status || input.esim?.network_status,
          service_status: input.service_status || input.esim?.service_status
        };
      }
      
      return {};
    } catch (error) {
      console.error('Maya status parsing error:', error, 'Input:', input);
      return {};
    }
  }

  /**
   * Parse legacy string format: "state: RELEASED, service: ACTIVE, network: ENABLED"
   */
  private static parseLegacyString(input: string): MayaESIMStatus {
    const result: MayaESIMStatus = {};
    
    const parts = input.split(',');
    for (const part of parts) {
      const [key, value] = part.split(':');
      if (key && value) {
        const cleanKey = key.trim().toLowerCase();
        const cleanValue = value.trim().toUpperCase();
        
        switch (cleanKey) {
          case 'state':
            result.state = cleanValue;
            break;
          case 'service':
            result.service_status = cleanValue;
            break;
          case 'network':
            result.network_status = cleanValue;
            break;
        }
      }
    }
    
    return result;
  }

  /**
   * Get processed Maya status for frontend display
   */
  static getProcessedStatus(realStatus: any, supplierName?: string): ParsedMayaStatus {
    const isMaya = supplierName?.toLowerCase() === 'maya';
    
    if (!isMaya) {
      // Return default for non-Maya eSIMs
      return {
        displayStatus: 'Unknown',
        isConnected: false,
        isActive: false,
        statusColor: 'bg-gray-100 text-gray-800 border-gray-200',
        statusText: 'Unknown'
      };
    }

    const parsed = this.parseRealStatus(realStatus);
    const { state, network_status, service_status } = parsed;
    
    // Apply Maya business rules
    let displayStatus = network_status || 'UNKNOWN';
    let isConnected = false;
    let isActive = false;
    
    // Maya Rule: RELEASED + ENABLED = NOT_ACTIVE (awaiting customer connection)
    if (state === 'RELEASED' && network_status === 'ENABLED') {
      displayStatus = 'NOT_ACTIVE';
      isConnected = false;
      isActive = false;
    } else if (network_status === 'ENABLED' && state !== 'RELEASED') {
      // Truly connected and active
      displayStatus = 'ENABLED';
      isConnected = true;
      isActive = true;
    } else if (network_status === 'DISABLED') {
      displayStatus = 'DISABLED';
      isConnected = false;
      isActive = false;
    }

    // Get display colors and text
    const statusColor = this.getStatusColor(displayStatus);
    const statusText = this.getStatusText(displayStatus);

    return {
      state,
      network_status,
      service_status,
      displayStatus,
      isConnected,
      isActive,
      statusColor,
      statusText
    };
  }

  /**
   * Get Tailwind CSS classes for status colors
   */
  private static getStatusColor(status: string): string {
    switch (status.toUpperCase()) {
      case 'ENABLED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'NOT_ACTIVE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'DISABLED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'SUSPENDED':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  /**
   * Get user-friendly status text
   */
  private static getStatusText(status: string): string {
    switch (status.toUpperCase()) {
      case 'ENABLED':
        return 'Connected';
      case 'NOT_ACTIVE':
        return 'Not Active';
      case 'DISABLED':
        return 'Suspended';
      default:
        return status.toUpperCase();
    }
  }

  /**
   * Create standardized Maya real_status JSON for storage
   */
  static createStandardizedStatus(esim: any): string {
    return JSON.stringify({
      state: esim.state || 'UNKNOWN',
      service_status: esim.service_status || 'UNKNOWN',
      network_status: esim.network_status || 'UNKNOWN'
    });
  }

  /**
   * Validate if stored real_status needs migration to new format
   */
  static needsFormatMigration(realStatus: any): boolean {
    if (!realStatus) return false;
    
    if (typeof realStatus === 'string') {
      const trimmed = realStatus.trim();
      // If it's not JSON, it needs migration
      return !trimmed.startsWith('{');
    }
    
    return false;
  }
}

/**
 * Legacy compatibility function - use MayaStatusParser.getProcessedStatus instead
 * @deprecated
 */
export function parseMayaStatus(input: any): { state?: string; network_status?: string } {
  const parsed = MayaStatusParser.parseRealStatus(input);
  return {
    state: parsed.state,
    network_status: parsed.network_status
  };
}