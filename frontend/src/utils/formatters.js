/**
 * Standard utility for formatting Indian Currency (INR).
 * Rounds to the nearest whole number as per administrative requirements.
 * Example: 32506.868 -> ₹32,507
 */
export const formatINR = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);
};
