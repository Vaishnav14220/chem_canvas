import React, { useState, useEffect } from 'react';
import { User, GraduationCap, Calendar, BookOpen, Building, ChevronDown, X, Save, RefreshCw, Key, Copy, Eye, EyeOff } from 'lucide-react';
import { updateUserProfile, UserProfile } from '../firebase/auth';

interface ProfileUpdateProps {
  userProfile: UserProfile;
  onClose: () => void;
  onUpdate: (updatedProfile: UserProfile) => void;
}

export default function ProfileUpdate({ userProfile, onClose, onUpdate }: ProfileUpdateProps) {
  const [username, setUsername] = useState(userProfile.username || '');
  const [gender, setGender] = useState(userProfile.gender || 'Prefer not to say');
  const [course, setCourse] = useState(userProfile.course || 'B.Sc');
  const [semester, setSemester] = useState(userProfile.semester || 'Semester 1');
  const [majorSubject, setMajorSubject] = useState(userProfile.majorSubject || '');
  const [university, setUniversity] = useState(userProfile.university || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  // Check if form has changes
  const hasChanges = 
    username !== userProfile.username ||
    gender !== userProfile.gender ||
    course !== userProfile.course ||
    semester !== userProfile.semester ||
    majorSubject !== userProfile.majorSubject ||
    university !== userProfile.university;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !majorSubject || !university) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const updatedProfile = await updateUserProfile({
        username,
        gender,
        course,
        semester,
        majorSubject,
        university
      });

      const completeProfile: UserProfile = {
        ...userProfile,
        username,
        gender,
        course,
        semester,
        majorSubject,
        university,
        updatedAt: new Date()
      };

      setSuccess('Profile updated successfully!');
      onUpdate(completeProfile);
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Profile update error:', error);
      setError(error.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setUsername(userProfile.username || '');
    setGender(userProfile.gender || 'Prefer not to say');
    setCourse(userProfile.course || 'B.Sc');
    setSemester(userProfile.semester || 'Semester 1');
    setMajorSubject(userProfile.majorSubject || '');
    setUniversity(userProfile.university || '');
    setError('');
    setSuccess('');
  };

  const handleCopyApiKey = async () => {
    if (userProfile.geminiApiKey) {
      try {
        await navigator.clipboard.writeText(userProfile.geminiApiKey);
        setApiKeyCopied(true);
        setTimeout(() => setApiKeyCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy API key:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Update Profile</h2>
            <p className="text-gray-400 text-sm mt-1">Modify your academic information</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
              <p className="text-green-200 text-sm">{success}</p>
            </div>
          )}

          {/* Username Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Username <span className="text-red-400">*</span>
            </label>
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
                className="block w-full pl-10 pr-3 py-4 border border-gray-600 rounded-lg bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your username"
              />
            </div>
          </div>

          {/* Gender Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Gender
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="block w-full pl-10 pr-10 py-4 border border-gray-600 rounded-lg bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
              >
                <option value="Prefer not to say">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Course Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Course
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <GraduationCap className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="block w-full pl-10 pr-10 py-4 border border-gray-600 rounded-lg bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
              >
                <option value="B.Sc">B.Sc</option>
                <option value="M.Sc">M.Sc</option>
                <option value="B.Tech">B.Tech</option>
                <option value="M.Tech">M.Tech</option>
                <option value="B.Pharm">B.Pharm</option>
                <option value="M.Pharm">M.Pharm</option>
                <option value="BDS">BDS</option>
                <option value="MBBS">MBBS</option>
                <option value="Other">Other</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Semester Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Semester
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="block w-full pl-10 pr-10 py-4 border border-gray-600 rounded-lg bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
              >
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
                <option value="Semester 3">Semester 3</option>
                <option value="Semester 4">Semester 4</option>
                <option value="Semester 5">Semester 5</option>
                <option value="Semester 6">Semester 6</option>
                <option value="Semester 7">Semester 7</option>
                <option value="Semester 8">Semester 8</option>
                <option value="Graduate">Graduate</option>
                <option value="Post Graduate">Post Graduate</option>
                <option value="Research">Research</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Major Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Major Subject <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <BookOpen className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="majorSubject"
                name="majorSubject"
                type="text"
                required
                value={majorSubject}
                onChange={(e) => setMajorSubject(e.target.value)}
                className="block w-full pl-10 pr-3 py-4 border border-gray-600 rounded-lg bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="e.g., Chemistry, Physics, Biology"
              />
            </div>
          </div>

          {/* University */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              University <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="university"
                name="university"
                type="text"
                required
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                className="block w-full pl-10 pr-3 py-4 border border-gray-600 rounded-lg bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="e.g., Harvard University, MIT, Stanford"
              />
            </div>
          </div>

          {/* Gemini API Key */}
          {userProfile.geminiApiKey && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Gemini API Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={userProfile.geminiApiKey}
                  readOnly
                  className="block w-full pl-10 pr-20 py-4 border border-gray-600 rounded-lg bg-gray-800/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
                />
                <div className="absolute inset-y-0 right-0 flex items-center space-x-1 pr-2">
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                    title={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4 text-gray-400 hover:text-white" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400 hover:text-white" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyApiKey}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                    title="Copy API key"
                  >
                    <Copy className="h-4 w-4 text-gray-400 hover:text-white" />
                  </button>
                </div>
              </div>
              {apiKeyCopied && (
                <p className="text-green-400 text-xs mt-1">API key copied to clipboard!</p>
              )}
              <p className="text-gray-400 text-xs mt-1">
                This API key is automatically assigned to you from our secure pool and stored in Firebase.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-6 border-t border-gray-700">
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading || !hasChanges}
              className="flex items-center px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </button>
            
            <div className="flex-1"></div>
            
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-2 border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isLoading || !hasChanges}
              className="flex items-center px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
