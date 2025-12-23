import React, { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, GraduationCap, Calendar, BookOpen, Building, X, Save, RefreshCw, Key, Copy, Eye, EyeOff } from 'lucide-react';
import { updateUserProfile, UserProfile } from '../firebase/auth';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from './ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface ProfileUpdateProps {
  userProfile: UserProfile;
  onClose: () => void;
  onUpdate: (updatedProfile: UserProfile) => void;
}

// Zod schema for form validation
const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  gender: z.enum(['Prefer not to say', 'Male', 'Female', 'Other']),
  course: z.enum(['B.Sc', 'M.Sc', 'B.Tech', 'M.Tech', 'B.Pharm', 'M.Pharm', 'BDS', 'MBBS', 'Other']),
  semester: z.string().min(1, 'Please select a semester'),
  majorSubject: z
    .string()
    .min(2, 'Major subject must be at least 2 characters')
    .max(100, 'Major subject must be at most 100 characters'),
  university: z
    .string()
    .min(2, 'University name must be at least 2 characters')
    .max(200, 'University name must be at most 200 characters'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const genderOptions = [
  { value: 'Prefer not to say', label: 'Prefer not to say' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
] as const;

const courseOptions = [
  { value: 'B.Sc', label: 'B.Sc' },
  { value: 'M.Sc', label: 'M.Sc' },
  { value: 'B.Tech', label: 'B.Tech' },
  { value: 'M.Tech', label: 'M.Tech' },
  { value: 'B.Pharm', label: 'B.Pharm' },
  { value: 'M.Pharm', label: 'M.Pharm' },
  { value: 'BDS', label: 'BDS' },
  { value: 'MBBS', label: 'MBBS' },
  { value: 'Other', label: 'Other' },
] as const;

const semesterOptions = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
  'Graduate',
  'Post Graduate',
  'Research',
] as const;

export default function ProfileUpdate({ userProfile, onClose, onUpdate }: ProfileUpdateProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const initialValues = useMemo<ProfileFormData>(
    () => ({
      username: userProfile.username || '',
      gender: (userProfile.gender as ProfileFormData['gender']) || 'Prefer not to say',
      course: (userProfile.course as ProfileFormData['course']) || 'B.Sc',
      semester: userProfile.semester || 'Semester 1',
      majorSubject: userProfile.majorSubject || '',
      university: userProfile.university || '',
    }),
    [userProfile]
  );

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });

  // Watch form values to detect changes
  const watchedValues = form.watch();
  const hasChanges = (Object.keys(initialValues) as Array<keyof ProfileFormData>).some(
    (key) => watchedValues[key] !== initialValues[key]
  );

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const updatedProfile = await updateUserProfile({
        username: data.username,
        gender: data.gender,
        course: data.course,
        semester: data.semester,
        majorSubject: data.majorSubject,
        university: data.university,
      });

      const completeProfile: UserProfile = {
        ...userProfile,
        username: data.username,
        gender: data.gender,
        course: data.course,
        semester: data.semester,
        majorSubject: data.majorSubject,
        university: data.university,
        updatedAt: new Date(),
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
    form.reset(initialValues);
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
        <div className="flex items-center justify-between p-6 border-b border-gray-700" style={{ backgroundColor: '#171717' }}>
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6" style={{ backgroundColor: '#171717' }}>
          <FieldGroup className="space-y-6">
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
            <Controller
              name="username"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name} className="text-gray-300">
                    Username <span className="text-red-400">*</span>
                  </FieldLabel>
                  <FieldDescription className="text-gray-400">
                    This name will appear across the app.
                  </FieldDescription>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      className={`pl-10 text-white placeholder:text-gray-400 ${
                        fieldState.invalid ? 'border-red-500' : 'border-gray-600'
                      }`}
                      style={{ backgroundColor: '#212121' }}
                      placeholder="Enter your username"
                    />
                  </div>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} className="text-red-400" />}
                </Field>
              )}
            />

            {/* Gender Field */}
            <Controller
              name="gender"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                  <FieldContent>
                    <FieldLabel htmlFor="profile-gender" className="text-gray-300">
                      Gender
                    </FieldLabel>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} className="text-red-400" />}
                  </FieldContent>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="profile-gender"
                      aria-invalid={fieldState.invalid}
                      className="relative pl-10 border-gray-600 text-white min-w-[220px]"
                      style={{ backgroundColor: '#212121' }}
                    >
                      <User className="absolute left-3 h-4 w-4 text-gray-400" />
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent position="item-aligned" className="bg-gray-800 border-gray-600">
                      {genderOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-white">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {/* Course Field */}
            <Controller
              name="course"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                  <FieldContent>
                    <FieldLabel htmlFor="profile-course" className="text-gray-300">
                      Course
                    </FieldLabel>
                    <FieldDescription className="text-gray-400">
                      Helps us tailor examples and content.
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} className="text-red-400" />}
                  </FieldContent>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="profile-course"
                      aria-invalid={fieldState.invalid}
                      className="relative pl-10 border-gray-600 text-white min-w-[220px]"
                      style={{ backgroundColor: '#212121' }}
                    >
                      <GraduationCap className="absolute left-3 h-4 w-4 text-gray-400" />
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent position="item-aligned" className="bg-gray-800 border-gray-600">
                      {courseOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-white">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {/* Semester Field */}
            <Controller
              name="semester"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                  <FieldContent>
                    <FieldLabel htmlFor="profile-semester" className="text-gray-300">
                      Semester
                    </FieldLabel>
                    <FieldDescription className="text-gray-400">
                      Used to personalize study plans and difficulty.
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} className="text-red-400" />}
                  </FieldContent>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="profile-semester"
                      aria-invalid={fieldState.invalid}
                      className="relative pl-10 border-gray-600 text-white min-w-[220px]"
                      style={{ backgroundColor: '#212121' }}
                    >
                      <Calendar className="absolute left-3 h-4 w-4 text-gray-400" />
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent position="item-aligned" className="bg-gray-800 border-gray-600">
                      {semesterOptions.map((option) => (
                        <SelectItem key={option} value={option} className="text-white">
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {/* Major Subject Field */}
            <Controller
              name="majorSubject"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name} className="text-gray-300">
                    Major Subject <span className="text-red-400">*</span>
                  </FieldLabel>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <BookOpen className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      className={`pl-10 text-white placeholder:text-gray-400 ${
                        fieldState.invalid ? 'border-red-500' : 'border-gray-600'
                      }`}
                      style={{ backgroundColor: '#212121' }}
                      placeholder="e.g., Chemistry, Physics, Biology"
                    />
                  </div>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} className="text-red-400" />}
                </Field>
              )}
            />

            {/* University Field */}
            <Controller
              name="university"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name} className="text-gray-300">
                    University <span className="text-red-400">*</span>
                  </FieldLabel>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      className={`pl-10 text-white placeholder:text-gray-400 ${
                        fieldState.invalid ? 'border-red-500' : 'border-gray-600'
                      }`}
                      style={{ backgroundColor: '#212121' }}
                      placeholder="e.g., Harvard University, MIT, Stanford"
                    />
                  </div>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} className="text-red-400" />}
                </Field>
              )}
            />

            {/* Gemini API Key */}
            {userProfile.geminiApiKey && (
              <Field>
                <FieldLabel className="text-gray-300">Gemini API Key</FieldLabel>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={userProfile.geminiApiKey}
                    readOnly
                    className="pl-10 pr-20 py-4 border border-gray-600 rounded-lg bg-gray-800/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
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
                  <FieldDescription className="text-green-400 text-xs mt-1">
                    API key copied to clipboard!
                  </FieldDescription>
                )}
                <FieldDescription className="text-gray-400 text-xs mt-1">
                  This API key is automatically assigned to you from our secure pool and stored in Firebase.
                </FieldDescription>
              </Field>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-6 border-t" style={{ borderColor: '#e5e5e5' }}>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isLoading || !hasChanges}
                className="flex items-center border-gray-600 bg-[#212121] text-white hover:bg-[#2d2d2d] hover:border-gray-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>

              <div className="flex-1"></div>

              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="border-gray-600 bg-[#212121] text-white hover:bg-[#2d2d2d] hover:border-gray-500"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isLoading || !hasChanges}
                className="flex items-center font-medium"
                style={{ 
                  backgroundColor: '#e5e5e5',
                  color: '#000000',
                  borderColor: '#e5e5e5'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#d4d4d4';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#e5e5e5';
                }}
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
              </Button>
            </div>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
