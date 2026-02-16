/**
 * Error Handler Utility
 * Translates Supabase and database errors into user-friendly messages
 */

export const handleError = (error: any): string => {
  // Handle null/undefined
  if (!error) return 'An unexpected error occurred';

  // Get error message
  const message = error.message || error.toString();
  const code = error.code;

  // Supabase/PostgreSQL error codes
  if (code === '23505') {
    return 'This record already exists';
  }

  if (code === '23503') {
    return 'Cannot delete this record because it is referenced by other data';
  }

  if (code === '23514') {
    return 'Invalid data provided';
  }

  if (code === '42501') {
    return 'You do not have permission to perform this action';
  }

  // Auth errors
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password';
  }

  if (message.includes('Email not confirmed')) {
    return 'Please verify your email before logging in';
  }

  if (message.includes('User already registered')) {
    return 'An account with this email already exists';
  }

  if (message.includes('Password should be at least')) {
    return 'Password must be at least 6 characters';
  }

  // Network errors
  if (message.includes('Failed to fetch') || message.includes('Network request failed')) {
    return 'No internet connection. Please check your network and try again';
  }

  if (message.includes('timeout')) {
    return 'Request timed out. Please try again';
  }

  // Storage errors
  if (message.includes('Payload too large')) {
    return 'File is too large. Maximum size is 10MB';
  }

  if (message.includes('Invalid file type')) {
    return 'Invalid file type. Please upload an image';
  }

  // RLS (Row Level Security) errors
  if (message.includes('new row violates row-level security policy')) {
    return 'You do not have permission to access this data';
  }

  // Generic errors
  if (message.includes('not authenticated')) {
    return 'Please log in to continue';
  }

  // Default fallback
  if (message.length > 0 && message.length < 200) {
    return message;
  }

  return 'An unexpected error occurred. Please try again';
};

/**
 * Log error to console in development
 */
export const logError = (context: string, error: any): void => {
  if (__DEV__) {
    console.error(`[${context}]`, error);
  }
};
