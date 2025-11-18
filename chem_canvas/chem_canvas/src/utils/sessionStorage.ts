// Session storage utilities for authentication persistence

export interface SessionData {
  userProfile: any;
  isAuthenticated: boolean;
  loginTime: number;
  expiresAt: number;
}

// Cookie utilities
export const setCookie = (name: string, value: string, days: number = 2) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

export const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

export const deleteCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
};

// Session storage functions
export const saveSession = (userProfile: any) => {
  const sessionData: SessionData = {
    userProfile,
    isAuthenticated: true,
    loginTime: Date.now(),
    expiresAt: Date.now() + (2 * 24 * 60 * 60 * 1000) // 2 days from now
  };

  // Store in both localStorage and cookies for redundancy
  localStorage.setItem('studium_session', JSON.stringify(sessionData));
  setCookie('studium_session', JSON.stringify(sessionData), 2);
  
  console.log('Session saved for 2 days');
};

export const loadSession = (): SessionData | null => {
  try {
    // Try localStorage first
    let sessionData = localStorage.getItem('studium_session');
    
    // If not in localStorage, try cookies
    if (!sessionData) {
      sessionData = getCookie('studium_session');
    }

    if (sessionData) {
      const parsed: SessionData = JSON.parse(sessionData);
      
      // Check if session is still valid
      if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
        console.log('Valid session found, expires at:', new Date(parsed.expiresAt));
        return parsed;
      } else {
        console.log('Session expired, clearing...');
        clearSession();
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error loading session:', error);
    clearSession();
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem('studium_session');
  deleteCookie('studium_session');
  console.log('Session cleared');
};

export const isSessionValid = (): boolean => {
  const session = loadSession();
  return session !== null && session.isAuthenticated;
};

// Check session validity and return remaining time
export const getSessionStatus = (): { isValid: boolean; expiresAt?: Date; remainingHours?: number } => {
  const session = loadSession();
  
  if (!session) {
    return { isValid: false };
  }

  const remainingMs = session.expiresAt - Date.now();
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  
  return {
    isValid: true,
    expiresAt: new Date(session.expiresAt),
    remainingHours: Math.max(0, remainingHours)
  };
};

// Extend session by additional days
export const extendSession = (additionalDays: number = 2): boolean => {
  const session = loadSession();
  
  if (!session) {
    return false;
  }

  const newExpiresAt = Date.now() + (additionalDays * 24 * 60 * 60 * 1000);
  const extendedSession: SessionData = {
    ...session,
    expiresAt: newExpiresAt
  };

  localStorage.setItem('studium_session', JSON.stringify(extendedSession));
  setCookie('studium_session', JSON.stringify(extendedSession), additionalDays);
  
  console.log(`Session extended by ${additionalDays} days`);
  return true;
};
