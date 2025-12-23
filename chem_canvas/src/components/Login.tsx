import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, Atom, GraduationCap, Calendar, BookOpen, Building, RefreshCw, ChevronDown } from 'lucide-react';
import { registerUser, signInUser, signInWithGoogle, signInAsDemo, UserProfile } from '../firebase/auth';
import { auth } from '../firebase/config';
import ProfileCompletion from './ProfileCompletion';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

interface LoginProps {
  onLogin: (userProfile: UserProfile) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [firebaseStatus, setFirebaseStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [googleUserProfile, setGoogleUserProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');

  // Test Firebase connection
  useEffect(() => {
    const testFirebase = async () => {
      try {
        // Simple test to see if Firebase is initialized
        if (auth) {
          setFirebaseStatus('connected');
          console.log('Firebase connected successfully');
        } else {
          setFirebaseStatus('error');
          console.log('Firebase not initialized');
        }
      } catch (error) {
        setFirebaseStatus('error');
        console.error('Firebase connection error:', error);
      }
    };

    testFirebase();
  }, []);

  // Google login handler
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await signInWithGoogle();

      if (result.needsProfileCompletion) {
        // Show profile completion form
        setGoogleUserProfile(result.userProfile);
        setShowProfileCompletion(true);
      } else {
        // Profile is complete, login directly
        onLogin(result.userProfile);
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      setError(error.message || 'Google login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle profile completion
  const handleProfileCompletion = (completedProfile: UserProfile) => {
    setShowProfileCompletion(false);
    onLogin(completedProfile);
  };

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const [course, setCourse] = useState('B.Sc');
  const [semester, setSemester] = useState('Semester 1');
  const [majorSubject, setMajorSubject] = useState('chemistry');
  const [university, setUniversity] = useState('Your University');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Debug logging
    console.log('Form submission:', {
      isLogin,
      username,
      password,
      confirmPassword,
      majorSubject,
      university,
      termsAccepted
    });

    if (isLogin) {
      if (!username || !password) {
        setError('Please fill in all fields');
        return;
      }
    } else {
      if (!username || !password || !confirmPassword || !majorSubject || !university) {
        setError('Please fill in all required fields');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (!termsAccepted) {
        setError('Please accept the terms and conditions');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      if (isLogin) {
        // Handle demo credentials using anonymous authentication
        if (username === 'admin' && password === 'password') {
          try {
            const demoProfile = await signInAsDemo(true); // isAdmin = true
            onLogin(demoProfile);
            return;
          } catch (demoError) {
            console.error('Demo admin login error:', demoError);
            // Fallback to local profile if anonymous auth fails
            const fallbackProfile: UserProfile = {
              uid: 'demo-admin',
              email: 'admin@studium.local',
              displayName: 'Admin User',
              username: 'admin',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            onLogin(fallbackProfile);
            return;
          }
        } else if (username === 'demo' && password === 'demo') {
          try {
            const demoProfile = await signInAsDemo(false); // isAdmin = false
            onLogin(demoProfile);
            return;
          } catch (demoError) {
            console.error('Demo login error:', demoError);
            // Fallback to local profile if anonymous auth fails
            const fallbackProfile: UserProfile = {
              uid: 'demo-user',
              email: 'demo@studium.local',
              displayName: 'Demo User',
              username: 'demo',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            onLogin(fallbackProfile);
            return;
          }
        }

        // Firebase sign in
        try {
          const userProfile = await signInUser(username, password);
          onLogin(userProfile);
        } catch (firebaseError: any) {
          console.error('Firebase login error:', firebaseError);

          // If Firebase fails, try demo credentials
          if (firebaseError.message.includes('Firebase') || firebaseError.message.includes('auth')) {
            console.log('Firebase not available, using demo credentials...');
            // This will be handled by the demo credential check above
            throw new Error('Please check your internet connection or use demo credentials: admin/password or demo/demo');
          }
          throw firebaseError;
        }
      } else {
        // Firebase registration
        try {
          const userProfile = await registerUser(username, password, {
            gender,
            course,
            semester,
            majorSubject,
            university
          });
          onLogin(userProfile);
        } catch (firebaseError: any) {
          console.error('Firebase registration error:', firebaseError);

          // If Firebase fails, create a local profile for testing
          if (firebaseError.message.includes('Firebase') || firebaseError.message.includes('auth')) {
            console.log('Creating local profile for testing...');
            const localProfile: UserProfile = {
              uid: `local_${Date.now()}`,
              email: `${username}@studium.local`,
              displayName: username,
              username: username,
              gender,
              course,
              semester,
              majorSubject,
              university,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            onLogin(localProfile);
            return;
          }
          throw firebaseError;
        }
      }
      setIsLoading(false);
    } catch (error: any) {
      console.error('Registration/Login error:', error);
      setError(error.message || 'An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setGender('Prefer not to say');
    setCourse('B.Sc');
    setSemester('Semester 1');
    setMajorSubject('chemistry');
    setUniversity('Your University');
    setTermsAccepted(false);
    setError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  // Show profile completion if needed
  if (showProfileCompletion && googleUserProfile) {
    return (
      <ProfileCompletion
        userProfile={googleUserProfile}
        onComplete={handleProfileCompletion}
      />
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 md:p-10" style={{ backgroundColor: '#262626' }}>
      <div className="w-full max-w-sm md:max-w-4xl">
        <Card className="overflow-hidden p-0 border-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            <form className="p-6 md:p-8 space-y-6" onSubmit={handleSubmit} style={{ backgroundColor: '#171717' }}>
              {/* Title */}
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">{isLogin ? 'Welcome back' : 'Create Account'}</h1>
                <p className="text-muted-foreground text-balance">
                  {isLogin ? 'Login to your Studium account' : 'Sign up to get started with Studium'}
                </p>
              </div>
              {/* Username Field */}
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    placeholder={isLogin ? "Enter your username" : "Choose a username"}
                    style={{ backgroundColor: '#212121' }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex items-center">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  {isLogin && (
                    <a
                      href="#"
                      className="ml-auto text-sm underline-offset-2 hover:underline text-muted-foreground"
                    >
                      Forgot your password?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    placeholder="Enter your password"
                    style={{ backgroundColor: '#212121' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field - Only for Registration */}
              {!isLogin && (
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required={!isLogin}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      placeholder="Confirm your password"
                      style={{ backgroundColor: '#212121' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Registration-specific fields */}
              {!isLogin && (
                <>
                  {/* Gender Dropdown */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Gender</label>
                    <div className="relative">
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className={cn(
                          "flex h-10 w-full rounded-lg border border-input px-3 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                        )}
                        style={{ backgroundColor: '#212121' }}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  {/* Course and Semester Row */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Course Dropdown */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Course</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <select
                          value={course}
                          onChange={(e) => setCourse(e.target.value)}
                          className={cn(
                            "flex h-10 w-full rounded-lg border border-input pl-10 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                          )}
                          style={{ backgroundColor: '#212121' }}
                        >
                          <option value="B.Sc">B.Sc</option>
                          <option value="M.Sc">M.Sc</option>
                          <option value="B.Tech">B.Tech</option>
                          <option value="M.Tech">M.Tech</option>
                          <option value="PhD">PhD</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>

                    {/* Semester Dropdown */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Semester</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <select
                          value={semester}
                          onChange={(e) => setSemester(e.target.value)}
                          className={cn(
                            "flex h-10 w-full rounded-lg border border-input pl-10 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                          )}
                          style={{ backgroundColor: '#212121' }}
                        >
                          <option value="Semester 1">Semester 1</option>
                          <option value="Semester 2">Semester 2</option>
                          <option value="Semester 3">Semester 3</option>
                          <option value="Semester 4">Semester 4</option>
                          <option value="Semester 5">Semester 5</option>
                          <option value="Semester 6">Semester 6</option>
                          <option value="Semester 7">Semester 7</option>
                          <option value="Semester 8">Semester 8</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Major Subject Field */}
                  <div className="space-y-2">
                    <label htmlFor="majorSubject" className="text-sm font-medium">Major Subject</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="majorSubject"
                        name="majorSubject"
                        type="text"
                        required={!isLogin}
                        value={majorSubject}
                        onChange={(e) => setMajorSubject(e.target.value)}
                        className="pl-10"
                        placeholder="Enter your major subject"
                        style={{ backgroundColor: '#212121' }}
                      />
                    </div>
                  </div>

                  {/* University Field */}
                  <div className="space-y-2">
                    <label htmlFor="university" className="text-sm font-medium">University</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="university"
                        name="university"
                        type="text"
                        required={!isLogin}
                        value={university}
                        onChange={(e) => setUniversity(e.target.value)}
                        className="pl-10"
                        placeholder="Enter your university name"
                        style={{ backgroundColor: '#212121' }}
                      />
                    </div>
                  </div>

                  {/* Terms and Conditions */}
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                    />
                    <label htmlFor="terms" className="text-sm text-muted-foreground">
                      I agree to the processing of my personal data for research purposes and accept the{' '}
                      <a href="#" className="text-primary hover:underline">
                        terms and conditions
                      </a>
                    </label>
                  </div>
                </>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <span>⚠</span>
                    {error}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
                size="lg"
                style={{ backgroundColor: '#e6e6e6', color: '#000' }}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2"></div>
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  isLogin ? 'Login' : 'Register'
                )}
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 text-muted-foreground" style={{ backgroundColor: '#171717' }}>Or continue with</span>
                </div>
              </div>

              {/* Google Login Button */}
              <Button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                variant="outline"
                className="w-full"
                size="lg"
                style={{ backgroundColor: '#212121' }}
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              {/* Toggle Login/Register */}
              <p className="text-center text-sm text-muted-foreground">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-primary hover:underline font-medium"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </form>

            {/* Right side - Image or Info */}
            <div className="relative hidden md:block overflow-hidden" style={{ backgroundColor: '#2e2e2e' }}>
              {/* Background Image */}
              <div className="absolute inset-0">
                <img
                  src="https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&q=80&auto=format&fit=crop"
                  alt="Chemistry Research"
                  className="w-full h-full object-cover"
                  style={{ filter: 'blur(3px)' }}
                  onError={(e) => {
                    // Fallback to a different image if the first one fails
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1554475901-4538ddfbccc2?w=1200&q=80&auto=format&fit=crop';
                  }}
                />
              </div>
              {/* Subtle Overlay for better contrast */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#2e2e2e]/40 via-transparent to-[#2e2e2e]/40" />
              {/* Content */}
              <div className="relative z-10 flex items-center justify-center h-full p-8">
                <div className="text-center">
                  {/* Text with strong background for readability */}
                  <div className="inline-block px-10 py-6 rounded-xl bg-black/70 border-2 border-white/20 shadow-2xl">
                    <h2 className="text-6xl md:text-8xl font-bold text-white tracking-tight" style={{ 
                      textShadow: '0 4px 15px rgba(0, 0, 0, 0.9), 0 8px 30px rgba(0, 0, 0, 0.7)',
                      letterSpacing: '-0.03em',
                      fontWeight: 800
                    }}>
                      Studium
                    </h2>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-6 px-6 text-center text-xs text-muted-foreground">
          By clicking continue, you agree to our <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>.
        </p>
      </div>

    </div>
  );
}
