export async function withRetry<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error(`Operation failed after ${maxRetries} attempts:`, error);
        return null;
      }
      
      const delay = baseDelayMs * Math.pow(2, i); // Exponential backoff
      console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return null;
} 