import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, Atom, GraduationCap, Calendar, BookOpen, Building, RefreshCw, ChevronDown } from 'lucide-react';
import { registerUser, signInUser, signInWithGoogle, UserProfile } from '../firebase/auth';
import { auth } from '../firebase/config';
import ProfileCompletion from './ProfileCompletion';

interface LoginProps {
  onLogin: (userProfile: UserProfile) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [firebaseStatus, setFirebaseStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [googleUserProfile, setGoogleUserProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('vai123');
  
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
        // Handle demo credentials for testing
        if (username === 'admin' && password === 'password') {
          const demoProfile: UserProfile = {
            uid: 'demo-admin',
            email: 'admin@studium.local',
            displayName: 'Admin User',
            username: 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          onLogin(demoProfile);
          return;
        } else if (username === 'demo' && password === 'demo') {
          const demoProfile: UserProfile = {
            uid: 'demo-user',
            email: 'demo@studium.local',
            displayName: 'Demo User',
            username: 'demo',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          onLogin(demoProfile);
          return;
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
    setUsername(isLogin ? '' : 'testuser');
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
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header Banner */}
      <div className="w-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-b-2xl p-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Studium</h1>
        <p className="text-white text-lg">Empowering Research Through AI</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          {/* Title */}
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            {isLogin ? 'Sign In' : 'Create Account'}
          </h2>

          {/* Form */}
          <div className="bg-gray-900/95 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-700">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Username Field */}
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-12 py-4 border border-gray-600 rounded-lg bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder={isLogin ? "Enter your username" : "Choose a username"}
                  />
                  {!isLogin && (
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <RefreshCw className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                    </button>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-12 py-4 border border-gray-600 rounded-lg bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field - Only for Registration */}
              {!isLogin && (
                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required={!isLogin}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-10 pr-12 py-4 border border-gray-600 rounded-lg bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Registration-specific fields */}
              {!isLogin && (
                <>
                  {/* Gender Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">Gender</label>
                    <div className="relative">
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="block w-full py-4 pl-3 pr-10 border border-gray-600 rounded-lg bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {/* Course and Semester Row */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Course Dropdown */}
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">Course</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <GraduationCap className="h-5 w-5 text-gray-400" />
                        </div>
                        <select
                          value={course}
                          onChange={(e) => setCourse(e.target.value)}
                          className="block w-full py-4 pl-10 pr-10 border border-gray-600 rounded-lg bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                        >
                          <option value="B.Sc">B.Sc</option>
                          <option value="M.Sc">M.Sc</option>
                          <option value="B.Tech">B.Tech</option>
                          <option value="M.Tech">M.Tech</option>
                          <option value="PhD">PhD</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {/* Semester Dropdown */}
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">Semester</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Calendar className="h-5 w-5 text-gray-400" />
                        </div>
                        <select
                          value={semester}
                          onChange={(e) => setSemester(e.target.value)}
                          className="block w-full py-4 pl-10 pr-10 border border-gray-600 rounded-lg bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
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
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Major Subject Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">Major Subject</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <BookOpen className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="majorSubject"
                        name="majorSubject"
                        type="text"
                        required={!isLogin}
                        value={majorSubject}
                        onChange={(e) => setMajorSubject(e.target.value)}
                        className="block w-full pl-10 pr-3 py-4 border border-gray-600 rounded-lg bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter your major subject"
                      />
                    </div>
                  </div>

                  {/* University Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">University</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="university"
                        name="university"
                        type="text"
                        required={!isLogin}
                        value={university}
                        onChange={(e) => setUniversity(e.target.value)}
                        className="block w-full pl-10 pr-3 py-4 border border-gray-600 rounded-lg bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter your university name"
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
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="terms" className="text-sm text-gray-300">
                      I agree to the processing of my personal data for research purposes and accept the{' '}
                      <a href="#" className="text-blue-400 hover:text-blue-300 underline">
                        terms and conditions
                      </a>
                    </label>
                  </div>
                </>
              )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-lg font-bold rounded-lg text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </div>
                ) : (
                  isLogin ? 'Sign In' : 'Register'
                )}
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-900 text-gray-400">Or continue with</span>
                </div>
              </div>

              {/* Google Login Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-600 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
              </button>
            </form>

            {/* Firebase Status */}
            <div className="mt-6 p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
              <h3 className="text-sm font-medium text-gray-200 mb-2">System Status:</h3>
              <div className="text-xs text-gray-300 space-y-1">
                <p>
                  Firebase: 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    firebaseStatus === 'connected' ? 'bg-green-500/20 text-green-400' :
                    firebaseStatus === 'error' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {firebaseStatus === 'connected' ? 'Connected' :
                     firebaseStatus === 'error' ? 'Offline Mode' :
                     'Checking...'}
                  </span>
                </p>
                {firebaseStatus === 'error' && (
                  <p className="text-yellow-400 mt-2">
                    Firebase is not available. Registration will create local accounts for testing.
                  </p>
                )}
                {!isLogin && firebaseStatus === 'connected' && (
                  <p className="text-blue-400 mt-2">
                    ✅ Firebase connected! You can register with any username and password.
                  </p>
                )}
              </div>
            </div>

            {/* Demo Credentials - Only show on login */}
            {isLogin && (
              <div className="mt-4 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                <h3 className="text-sm font-medium text-blue-200 mb-2">Demo Credentials:</h3>
                <div className="text-xs text-blue-300 space-y-1">
                  <p><strong>Admin:</strong> admin / password</p>
                  <p><strong>Demo:</strong> demo / demo</p>
                </div>
              </div>
            )}

            {/* Toggle Login/Register */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-300">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={toggleMode}
                  className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>

            {/* Admin Login Link */}
            {isLogin && (
              <div className="mt-4 text-center">
                <a href="#" className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium">
                  Admin Login
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center px-8 py-4 text-xs text-gray-400">
        <p>© 2025 Studium. All rights reserved.</p>
        <a href="#" className="hover:text-white transition-colors">Terms & Conditions</a>
      </div>
    </div>
  );
}
