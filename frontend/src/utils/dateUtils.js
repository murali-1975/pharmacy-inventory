/**
 * Utility functions for date and time formatting across the application.
 * All functions use the machine's local timezone (e.g., IST for users in India)
 * to ensure dates reflect the user's expected time.
 */

/**
 * Formats a date string to dd-mm-yyyy format using local time.
 * @param {string} dateString - The date string from the backend (usually yyyy-mm-dd or ISO).
 * @returns {string} - Formatted date string (dd-mm-yyyy) or "—" if null.
 */
export const formatDate = (dateString) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  
  return `${dd}-${mm}-${yyyy}`;
};

/**
 * Formats a date string to dd-mm-yyyy hh:mm AM/PM format using local time.
 * @param {string} dateString - The date string from the backend.
 * @returns {string} - Formatted date-time string or "—" if null.
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const hh = String(hours).padStart(2, "0");
  
  return `${dd}-${mm}-${yyyy} ${hh}:${minutes} ${ampm}`;
};
