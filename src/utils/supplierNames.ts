/**
 * Utility to map internal supplier names to display names
 */
export const getSupplierDisplayName = (supplierName: string | null | undefined): string => {
  if (!supplierName) return 'Unknown';
  
  const normalizedName = supplierName.toLowerCase().trim();
  
  if (normalizedName === 'esim_access') return 'Wander';
  if (normalizedName === 'maya') return 'Grid';
  
  return supplierName; // fallback to original
};
