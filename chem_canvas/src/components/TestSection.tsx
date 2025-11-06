import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Target,
  BookOpen,
  PenTool,
  Download,
  RefreshCw,
  Award,
  TrendingUp,
  MessageSquare,
  FileCheck,
  X
} from 'lucide-react';
import * as geminiService from '../services/geminiService';

interface UploadedDocument {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

interface Question {
  id: string;
  type: 'multiple-choice' | 'short-answer' | 'essay' | 'true-false';
  question: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface TestResult {
  questionId: string;
  userAnswer: string;
  correctAnswer?: string;
  isCorrect: boolean;
  score: number;
  maxScore: number;
  feedback: string;
  mistakes?: string[];
  strengths?: string[];
  weaknesses?: string[];
  expectedAnswer?: string;
}

interface Test {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  timeLimit?: number; // in minutes
  totalPoints: number;
  createdAt: Date;
}

interface TestSession {
  testId: string;
  startTime: Date;
  endTime?: Date;
  answers: { [questionId: string]: string };
  isCompleted: boolean;
}

interface TestSectionProps {
  isOpen: boolean;
  onClose: () => void;
}

const TestSection: React.FC<TestSectionProps> = ({ isOpen, onClose }) => {
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedTests, setGeneratedTests] = useState<Test[]>([]);
  const [currentTest, setCurrentTest] = useState<Test | null>(null);
  const [testSession, setTestSession] = useState<TestSession | null>(null);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'tests' | 'take-test' | 'results'>('upload');
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(geminiService.isGeminiInitialized());

  useEffect(() => {
    setIsApiKeyConfigured(geminiService.isGeminiInitialized());
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (testSession && !testSession.isCompleted && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-submit when time runs out
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [testSession, timeRemaining]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      const content = await file.text();
      const newDocument: UploadedDocument = {
        id: Date.now().toString(),
        name: file.name,
        content: content,
        size: file.size,
        type: file.type,
        uploadedAt: new Date()
      };
      
      setUploadedDocuments(prev => [...prev, newDocument]);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeDocument = (documentId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const generateTestFromDocuments = async (difficulty: 'easy' | 'medium' | 'hard', questionCount: number) => {
    if (uploadedDocuments.length === 0) {
      alert('Please upload at least one document before generating a test.');
      return;
    }

    if (!geminiService.isGeminiInitialized()) {
      alert('Please configure your Gemini API key to generate tests.');
      return;
    }

    setIsGeneratingTest(true);

    try {
      // Build context from uploaded documents
      let documentContext = '**Document Context for Test Generation:**\n\n';
      uploadedDocuments.forEach((doc, index) => {
        documentContext += `**Document ${index + 1}: ${doc.name}**\n`;
        documentContext += `**File Size:** ${(doc.size / 1024).toFixed(1)} KB\n`;
        documentContext += `**Upload Date:** ${doc.uploadedAt.toLocaleDateString()}\n\n`;
        
        // Extract more content for better question generation
        const fullContent = doc.content;
        const contentLength = fullContent.length;
        
        if (contentLength <= 5000) {
          // For shorter documents, use the full content
          documentContext += `**Full Content:**\n${fullContent}\n\n`;
        } else {
          // For longer documents, extract key sections
          const firstPart = fullContent.substring(0, 3000);
          const middlePart = fullContent.substring(Math.floor(contentLength / 2) - 1500, Math.floor(contentLength / 2) + 1500);
          const lastPart = fullContent.substring(contentLength - 2000);
          
          documentContext += `**Content Overview:**\n`;
          documentContext += `**Beginning:**\n${firstPart}\n\n`;
          documentContext += `**Middle Section:**\n${middlePart}\n\n`;
          documentContext += `**Ending:**\n${lastPart}\n\n`;
        }
        
        documentContext += `---\n\n`;
      });

      const prompt = `${documentContext}

**Task:** Create a comprehensive assessment based on the uploaded documents. Analyze the content thoroughly and generate meaningful questions that test deep understanding of the material.

**Requirements:**
- Difficulty Level: ${difficulty}
- Number of Questions: ${questionCount}
- Question Types: Mix of multiple choice, short answer, true/false, and essay questions
- Total Points: ${questionCount * 10} (10 points per question)

**Question Generation Guidelines:**
1. **Content-Specific**: Base ALL questions directly on the document content provided
2. **Meaningful**: Create questions that test comprehension, analysis, and application of concepts
3. **Progressive Difficulty**: Start with basic recall and progress to analysis/application
4. **Real-World Application**: Include questions that show practical understanding
5. **Critical Thinking**: Test ability to analyze, compare, and evaluate concepts
6. **Specific Details**: Reference actual content, examples, data, or concepts from the documents

**Question Types to Include:**
- **Multiple Choice**: Test specific facts, concepts, and understanding with plausible distractors
- **Short Answer**: Require brief explanations of concepts or processes mentioned in the documents
- **True/False**: Test specific statements that can be verified from the document content
- **Essay**: Require analysis, comparison, or application of concepts from the documents

**IMPORTANT:** You must respond with ONLY valid JSON. No markdown formatting or additional text.

**Required JSON Format:**
{
  "title": "Comprehensive Assessment: [Main Topic from Documents]",
  "description": "This test evaluates understanding of key concepts, principles, and applications covered in the uploaded documents.",
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "Based on the document content, what is the primary purpose/function of [specific concept]?",
      "options": ["Option based on document", "Plausible distractor", "Another distractor", "Correct answer from document"],
      "correctAnswer": "Correct answer from document",
      "points": 10,
      "difficulty": "${difficulty}"
    },
    {
      "id": "q2", 
      "type": "short-answer",
      "question": "According to the document, explain the process/mechanism of [specific topic mentioned in document].",
      "correctAnswer": "Expected answer based on document content",
      "points": 10,
      "difficulty": "${difficulty}"
    },
    {
      "id": "q3",
      "type": "true-false", 
      "question": "The document states that [specific statement from document].",
      "correctAnswer": "true/false based on document",
      "points": 10,
      "difficulty": "${difficulty}"
    },
    {
      "id": "q4",
      "type": "essay",
      "question": "Analyze and compare the different approaches/methods discussed in the document for [specific topic]. Which approach would be most effective and why?", 
      "points": 10,
      "difficulty": "${difficulty}"
    }
  ]
}

**CRITICAL INSTRUCTIONS:**
- Reference specific content, data, examples, or concepts from the uploaded documents
- Create questions that cannot be answered without reading the documents
- Ensure all correct answers are directly supported by the document content
- Make distractors plausible but clearly incorrect based on the documents
- Test both factual knowledge and analytical thinking about the material

Generate exactly ${questionCount} meaningful questions based on the document content. Respond with ONLY the JSON object.`;

      const response = await geminiService.generateTextContent(prompt);
      
      // Clean and parse JSON response
      let testData;
      try {
        // Try to extract JSON from the response (in case it's wrapped in markdown or has extra text)
        let jsonString = response;
        
        // Remove markdown code blocks if present
        jsonString = jsonString.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Try to find JSON object in the response
        const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
        }
        
        testData = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Raw response:', response);
        
        // Fallback: create a content-aware test structure
        const documentTitles = uploadedDocuments.map(doc => doc.name).join(', ');
        const documentCount = uploadedDocuments.length;
        
        testData = {
          title: `Assessment: ${documentTitles}`,
          description: `Comprehensive test based on ${documentCount} uploaded document${documentCount > 1 ? 's' : ''}. This assessment evaluates understanding of key concepts and information presented in the materials.`,
          questions: [
            {
              id: 'q1',
              type: 'multiple-choice',
              question: `Based on the content in the uploaded documents, what appears to be the primary subject matter or topic?`,
              options: [
                'General knowledge',
                'Technical documentation', 
                'Educational material',
                'Specific subject matter from documents'
              ],
              correctAnswer: 'Specific subject matter from documents',
              points: 10,
              difficulty: difficulty
            },
            {
              id: 'q2',
              type: 'short-answer',
              question: `Identify and explain one key concept or piece of information that stood out to you from the uploaded documents.`,
              points: 10,
              difficulty: difficulty
            },
            {
              id: 'q3',
              type: 'true-false',
              question: `The uploaded documents contain detailed information that requires careful analysis and understanding.`,
              correctAnswer: 'true',
              points: 10,
              difficulty: difficulty
            },
            {
              id: 'q4',
              type: 'essay',
              question: `Based on your review of the uploaded documents, discuss the main themes or concepts covered and their practical applications or significance.`,
              points: 10,
              difficulty: difficulty
            }
          ]
        };
      }
      
      const newTest: Test = {
        id: Date.now().toString(),
        title: testData.title || 'Generated Test',
        description: testData.description || 'Test generated from uploaded documents',
        questions: testData.questions || [],
        totalPoints: testData.questions?.length * 10 || 0,
        createdAt: new Date()
      };

      setGeneratedTests(prev => [...prev, newTest]);
      setActiveTab('tests');
      
    } catch (error: any) {
      console.error('Error generating test:', error);
      alert(`Failed to generate test: ${error.message}`);
    } finally {
      setIsGeneratingTest(false);
    }
  };

  const startTest = (test: Test) => {
    setCurrentTest(test);
    setSelectedTest(test);
    setTestSession({
      testId: test.id,
      startTime: new Date(),
      answers: {},
      isCompleted: false
    });
    setTimeRemaining(test.timeLimit ? test.timeLimit * 60 : 0);
    setActiveTab('take-test');
    setShowResults(false);
    setTestResults([]);
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    if (!testSession) return;
    
    setTestSession(prev => prev ? {
      ...prev,
      answers: {
        ...prev.answers,
        [questionId]: answer
      }
    } : null);
  };

  const handleSubmitTest = async () => {
    if (!currentTest || !testSession) return;

    setIsCorrecting(true);
    setTestSession(prev => prev ? { ...prev, isCompleted: true, endTime: new Date() } : null);

    try {
      const results: TestResult[] = [];

      for (const question of currentTest.questions) {
        const userAnswer = testSession.answers[question.id] || '';
        
        if (question.type === 'essay') {
          // For essay questions, use AI to evaluate
          const evaluationPrompt = `Evaluate this student's answer comprehensively for the question: "${question.question}"

Student Answer: "${userAnswer}"

**IMPORTANT:** Respond with ONLY valid JSON. No markdown formatting or additional text.

Provide detailed analysis including:
1. Whether the answer is correct
2. Specific score out of ${question.points}
3. Detailed feedback explaining what's right and wrong
4. Specific mistakes made
5. Strengths of the answer
6. Weaknesses that need improvement
7. What the expected answer should include

Required JSON format:
{
  "isCorrect": true,
  "score": 8,
  "feedback": "Your answer demonstrates good understanding of the core concept. You correctly identified the main purpose as sales generation. However, you missed the specific mechanism mentioned in the document about lead generation. The document specifically states that AIDA is designed to drive sales through a systematic approach.",
  "mistakes": ["Missing specific sales mechanism details", "Didn't reference document specifics"],
  "strengths": ["Correct main concept", "Clear understanding of purpose", "Concise response"],
  "weaknesses": ["Lacks detail", "Missing document references", "Could be more comprehensive"],
  "expectedAnswer": "The document explains that AIDA is designed to drive sales through a systematic approach that includes attention, interest, desire, and action phases to convert prospects into customers."
}

Evaluate the answer thoroughly and respond with ONLY the JSON object.`;

          const evaluation = await geminiService.generateTextContent(evaluationPrompt);
          
          let evaluationData;
          try {
            // Clean and parse JSON response
            let jsonString = evaluation;
            jsonString = jsonString.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonString = jsonMatch[0];
            }
            evaluationData = JSON.parse(jsonString);
          } catch (parseError) {
            console.error('Essay evaluation JSON parse error:', parseError);
            evaluationData = {
              isCorrect: false,
              score: 5,
              feedback: 'Unable to parse evaluation response. Please check your answer.',
              mistakes: ['Evaluation parsing error']
            };
          }
          
          results.push({
            questionId: question.id,
            userAnswer,
            isCorrect: evaluationData.isCorrect || false,
            score: evaluationData.score || 0,
            maxScore: question.points,
            feedback: evaluationData.feedback || 'No feedback available',
            mistakes: evaluationData.mistakes || [],
            strengths: evaluationData.strengths || [],
            weaknesses: evaluationData.weaknesses || [],
            expectedAnswer: evaluationData.expectedAnswer || 'Not specified'
          });
        } else {
          // For other question types, provide detailed feedback
          const isCorrect = userAnswer.toLowerCase().trim() === (question.correctAnswer || '').toLowerCase().trim();
          const score = isCorrect ? question.points : 0;
          
          let detailedFeedback = '';
          let mistakes: string[] = [];
          let strengths: string[] = [];
          let weaknesses: string[] = [];
          
          if (isCorrect) {
            detailedFeedback = `Excellent! Your answer "${userAnswer}" is correct. You demonstrated good understanding of the concept and provided the right response.`;
            strengths = ['Correct answer', 'Good understanding of the topic', 'Accurate response'];
          } else {
            detailedFeedback = `Your answer "${userAnswer}" is not correct. The correct answer is "${question.correctAnswer || 'Not provided'}". This indicates a misunderstanding of the concept that needs to be addressed.`;
            mistakes = ['Incorrect answer provided'];
            weaknesses = ['Misunderstood the question concept', 'Need to review the material more thoroughly'];
          }
          
          results.push({
            questionId: question.id,
            userAnswer,
            correctAnswer: question.correctAnswer,
            isCorrect,
            score,
            maxScore: question.points,
            feedback: detailedFeedback,
            mistakes,
            strengths,
            weaknesses,
            expectedAnswer: question.correctAnswer || 'Not specified'
          });
        }
      }

      setTestResults(results);
      setShowResults(true);
      setActiveTab('results');
      
    } catch (error: any) {
      console.error('Error correcting test:', error);
      alert(`Failed to correct test: ${error.message}`);
    } finally {
      setIsCorrecting(false);
    }
  };

  const downloadTestResults = (format: 'markdown' | 'html' | 'pdf' = 'markdown') => {
    if (!currentTest || !testSession || testResults.length === 0) return;

    const totalScore = testResults.reduce((sum, result) => sum + result.score, 0);
    const maxScore = testResults.reduce((sum, result) => sum + result.maxScore, 0);
    const percentage = Math.round((totalScore / maxScore) * 100);
    const grade = percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F';
    const duration = testSession.endTime ? Math.round((testSession.endTime.getTime() - testSession.startTime.getTime()) / 1000 / 60) : 'N/A';

    if (format === 'markdown') {
      const report = `# 📊 Test Results Report

## 📋 Test Information
- **Test Title:** ${currentTest.title}
- **Date Taken:** ${testSession.startTime.toLocaleDateString()} at ${testSession.startTime.toLocaleTimeString()}
- **Duration:** ${duration} minutes
- **Total Questions:** ${testResults.length}

## 🎯 Overall Performance
| Metric | Score |
|--------|-------|
| **Total Score** | ${totalScore}/${maxScore} |
| **Percentage** | ${percentage}% |
| **Grade** | ${grade} |
| **Correct Answers** | ${testResults.filter(r => r.isCorrect).length}/${testResults.length} |
| **Accuracy Rate** | ${Math.round((testResults.filter(r => r.isCorrect).length / testResults.length) * 100)}% |

## 📝 Question-by-Question Analysis

${testResults.map((result, index) => {
  const question = currentTest.questions.find(q => q.id === result.questionId);
  const status = result.isCorrect ? '✅' : '❌';
  
  return `### ${status} Question ${index + 1}
**Question:** ${question?.question || 'Unknown'}
**Difficulty:** ${question?.difficulty || 'N/A'}
**Points:** ${result.score}/${result.maxScore}

**Your Answer:**
> ${result.userAnswer || 'No answer provided'}

${result.correctAnswer ? `**Correct Answer:**
> ${result.correctAnswer}` : ''}

**Detailed Feedback:**
> ${result.feedback}

${result.strengths && result.strengths.length > 0 ? `**Strengths:**
${result.strengths.map(s => `- ✅ ${s}`).join('\n')}` : ''}

${result.weaknesses && result.weaknesses.length > 0 ? `**Areas for Improvement:**
${result.weaknesses.map(w => `- ⚠️ ${w}`).join('\n')}` : ''}

${result.mistakes && result.mistakes.length > 0 ? `**Specific Mistakes:**
${result.mistakes.map(m => `- ❌ ${m}`).join('\n')}` : ''}

${result.expectedAnswer ? `**Expected Answer:**
> ${result.expectedAnswer}` : ''}

---
`;
}).join('\n')}

## 📈 Performance Summary

### ✅ Strengths
- Correctly answered ${testResults.filter(r => r.isCorrect).length} out of ${testResults.length} questions
- Achieved ${percentage}% overall score
- ${testResults.filter(r => r.isCorrect).length > testResults.length / 2 ? 'Demonstrated good understanding' : 'Shows potential for improvement'}

### ⚠️ Areas for Improvement
${testResults.filter(r => !r.isCorrect).length > 0 ? 
  `- ${testResults.filter(r => !r.isCorrect).length} questions need review
- Focus on: ${[...new Set(testResults.filter(r => !r.isCorrect).flatMap(r => r.weaknesses || []))].join(', ')}` : 
  '- Excellent performance across all areas!'}

## 🎓 Recommendations
${percentage >= 90 ? 
  '🌟 Outstanding performance! Continue to excel in your studies.' :
  percentage >= 80 ?
  '👍 Good work! Review the incorrect answers to strengthen your understanding.' :
  percentage >= 70 ?
  '📚 Solid foundation. Focus on the areas for improvement listed above.' :
  percentage >= 60 ?
  '🔄 Significant room for improvement. Consider reviewing the source material thoroughly.' :
  '📖 Extensive review needed. Focus on understanding the fundamental concepts.'}

---
*Generated by AI Test Correction System on ${new Date().toLocaleString()}*
`;

      const blob = new Blob([report], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-results-${currentTest.title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'html') {
      const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Results - ${currentTest.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 40px; background: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        h3 { color: #7f8c8d; }
        .score-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .score-number { font-size: 2.5em; font-weight: bold; margin: 10px 0; }
        .question-card { border: 1px solid #e1e8ed; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .correct { border-left: 5px solid #27ae60; background: #f8fff9; }
        .incorrect { border-left: 5px solid #e74c3c; background: #fff8f8; }
        .feedback-box { background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .strengths { background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .weaknesses { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .mistakes { background: #f8d7da; padding: 15px; border-radius: 6px; margin: 10px 0; }
        ul { padding-left: 20px; }
        .status { font-size: 1.2em; font-weight: bold; }
        .correct-status { color: #27ae60; }
        .incorrect-status { color: #e74c3c; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Test Results Report</h1>
        
        <div class="score-card">
            <h2>Overall Performance</h2>
            <div class="score-number">${totalScore}/${maxScore}</div>
            <div>${percentage}% • Grade: ${grade}</div>
            <div>${testResults.filter(r => r.isCorrect).length}/${testResults.length} correct answers</div>
        </div>

        <h2>📋 Test Information</h2>
        <p><strong>Test Title:</strong> ${currentTest.title}</p>
        <p><strong>Date Taken:</strong> ${testSession.startTime.toLocaleDateString()} at ${testSession.startTime.toLocaleTimeString()}</p>
        <p><strong>Duration:</strong> ${duration} minutes</p>

        <h2>📝 Question Analysis</h2>
        ${testResults.map((result, index) => {
          const question = currentTest.questions.find(q => q.id === result.questionId);
          const statusClass = result.isCorrect ? 'correct' : 'incorrect';
          const statusText = result.isCorrect ? '✅ Correct' : '❌ Incorrect';
          const statusColor = result.isCorrect ? 'correct-status' : 'incorrect-status';
          
          return `
          <div class="question-card ${statusClass}">
              <h3><span class="status ${statusColor}">${statusText}</span> - Question ${index + 1} (${result.score}/${result.maxScore} points)</h3>
              <p><strong>Question:</strong> ${question?.question || 'Unknown'}</p>
              
              <p><strong>Your Answer:</strong></p>
              <div class="feedback-box">${result.userAnswer || 'No answer provided'}</div>
              
              ${result.correctAnswer ? `
              <p><strong>Correct Answer:</strong></p>
              <div class="feedback-box">${result.correctAnswer}</div>
              ` : ''}
              
              <p><strong>Detailed Feedback:</strong></p>
              <div class="feedback-box">${result.feedback}</div>
              
              ${result.strengths && result.strengths.length > 0 ? `
              <p><strong>Strengths:</strong></p>
              <div class="strengths">
                  <ul>${result.strengths.map(s => `<li>✅ ${s}</li>`).join('')}</ul>
              </div>
              ` : ''}
              
              ${result.weaknesses && result.weaknesses.length > 0 ? `
              <p><strong>Areas for Improvement:</strong></p>
              <div class="weaknesses">
                  <ul>${result.weaknesses.map(w => `<li>⚠️ ${w}</li>`).join('')}</ul>
              </div>
              ` : ''}
              
              ${result.mistakes && result.mistakes.length > 0 ? `
              <p><strong>Specific Mistakes:</strong></p>
              <div class="mistakes">
                  <ul>${result.mistakes.map(m => `<li>❌ ${m}</li>`).join('')}</ul>
              </div>
              ` : ''}
          </div>
          `;
        }).join('')}
        
        <p><em>Generated by AI Test Correction System on ${new Date().toLocaleString()}</em></p>
    </div>
</body>
</html>`;

      const blob = new Blob([htmlReport], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-results-${currentTest.title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const shareTestResults = async () => {
    if (!currentTest || !testSession || testResults.length === 0) return;

    const totalScore = testResults.reduce((sum, result) => sum + result.score, 0);
    const maxScore = testResults.reduce((sum, result) => sum + result.maxScore, 0);
    const percentage = Math.round((totalScore / maxScore) * 100);
    const grade = percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F';

    const shareText = `📊 Test Results: ${currentTest.title}
🎯 Score: ${totalScore}/${maxScore} (${percentage}%)
📈 Grade: ${grade}
✅ Correct: ${testResults.filter(r => r.isCorrect).length}/${testResults.length}

Generated by AI Test Correction System`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Test Results - ${currentTest.title}`,
          text: shareText,
          url: window.location.href
        });
      } catch (error) {
        console.log('Share cancelled or failed:', error);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        alert('Test results copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        alert('Unable to share results. Please try downloading instead.');
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const totalScore = testResults.reduce((sum, result) => sum + result.score, 0);
  const maxScore = testResults.reduce((sum, result) => sum + result.maxScore, 0);
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const generatedQuestionCount = generatedTests.reduce((sum, test) => sum + test.questions.length, 0);
  const latestScoreDisplay = showResults && testResults.length > 0 ? `${percentage}%` : '—';


  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[#020816]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(59,130,246,0.28),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.2),transparent_60%),radial-gradient(circle_at_50%_85%,rgba(45,212,191,0.18),transparent_60%)]" />
      <div className="relative flex h-full w-full flex-col overflow-hidden px-4 py-6 sm:px-8 lg:px-12">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-white/97 backdrop-blur-xl shadow-[0_55px_140px_-60px_rgba(15,23,42,0.75)]">
        {/* Header */}
        <header className="border-b border-white/10 px-6 pb-6 pt-8 lg:px-12">
          <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),transparent_65%),linear-gradient(135deg,rgba(255,255,255,0.12),rgba(15,23,42,0.18))] p-6 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.7)] backdrop-blur-xl lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-[0_20px_40px_-25px_rgba(14,165,233,0.8)]">
                  <BookOpen className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-white drop-shadow-sm">AI Test Center</h1>
                  <p className="text-sm text-blue-100/80">
                    {uploadedDocuments.length > 0
                      ? `${uploadedDocuments.length} document${uploadedDocuments.length === 1 ? '' : 's'} ready for testing`
                      : 'Upload documents to create tests'}
                  </p>
                </div>
              </div>
                <div className="flex items-center gap-3">
                  {timeRemaining > 0 && (
                    <div className="flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.25)]">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-semibold">{formatTime(timeRemaining)}</span>
                    </div>
                  )}
                  <button
                    onClick={onClose}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/20 text-white shadow-sm transition hover:bg-white hover:text-slate-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 text-white sm:grid-cols-3">
              {[
                {
                  label: 'Documents',
                  value: uploadedDocuments.length,
                  sub: 'Ready for analysis',
                  gradient: 'from-sky-500/90 to-blue-500/65'
                },
                {
                  label: 'Questions Generated',
                  value: generatedQuestionCount,
                  sub: 'Across all drafts',
                  gradient: 'from-violet-500/90 to-indigo-500/60'
                },
                {
                  label: 'Latest Score',
                  value: latestScoreDisplay,
                  sub: showResults ? 'Most recent attempt' : 'Complete a test to view',
                  gradient: 'from-emerald-500/90 to-teal-500/60'
                }
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border border-white/15 bg-gradient-to-br ${item.gradient} px-5 py-4 shadow-[0_24px_40px_-32px_rgba(2,8,23,0.6)] backdrop-blur-md`}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-white/70">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold drop-shadow-sm">{item.value}</p>
                  <p className="text-xs text-white/70">{item.sub}</p>
                </div>
              ))}
            </div>
            <nav className="mt-7 flex flex-wrap gap-3">
              {[
                { id: 'upload', label: 'Upload Documents', icon: Upload },
                { id: 'tests', label: 'Generated Tests', icon: FileText },
                { id: 'take-test', label: 'Take Test', icon: PenTool },
                { id: 'results', label: 'Results', icon: Award }
              ].map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'border-white/30 bg-white/20 text-white shadow-[0_12px_30px_-18px_rgba(59,130,246,0.75)] backdrop-blur-md'
                        : 'border-white/10 bg-white/10 text-blue-100 hover:border-blue-200/60 hover:bg-blue-200/20 hover:text-white'
                    }`}
                  >
                    <TabIcon
                      className={`h-4 w-4 ${isActive ? 'text-white' : 'text-blue-200 group-hover:text-white'}`}
                    />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* Tab Content */}
        <main className="flex-1 overflow-hidden px-6 pb-8 pt-4 lg:px-12">
          <div className="h-full overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1221]/95 shadow-[0_55px_140px_-80px_rgba(2,12,33,0.9)]">
            <div className="flex h-full flex-col">
              {activeTab === 'upload' && (
                <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
                  <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
                    <div className="text-center text-white">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20 text-blue-300 shadow-[0_15px_40px_-25px_rgba(37,99,235,0.7)]">
                        <Upload className="h-7 w-7" />
                      </div>
                      <h3 className="mt-6 text-3xl font-semibold">Upload Study Materials</h3>
                      <p className="mt-3 text-base text-blue-100/80">
                        Upload your documents to generate AI-powered tests and assessments
                      </p>
                      {!isApiKeyConfigured && (
                        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-700 shadow-sm">
                          <strong>API Key Required:</strong> Configure your Gemini API key to generate and correct tests.
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
                      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_50px_-35px_rgba(15,23,42,0.6)]">
                        <h4 className="text-lg font-semibold text-white">Upload Documents</h4>
                        <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3 text-sm font-medium text-white shadow-[0_18px_30px_-20px_rgba(59,130,246,0.75)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                          <Upload className="h-4 w-4" />
                          {isUploading ? 'Uploading...' : 'Choose Documents'}
                          <input
                            type="file"
                            accept=".pdf,.txt,.md,.doc,.docx"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={isUploading}
                            multiple
                          />
                        </label>
                        <div className="space-y-3">
                          {uploadedDocuments.length === 0 && (
                            <p className="rounded-lg border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-blue-100/80">
                              No documents uploaded yet. Supported formats: PDF, DOCX, Markdown, TXT.
                            </p>
                          )}
                          {uploadedDocuments.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-blue-200" />
                                <div>
                                  <p className="font-medium text-white/90">{doc.name}</p>
                                  <p className="text-xs text-blue-100/70">
                                    {(doc.size / 1024).toFixed(1)} KB • {doc.uploadedAt.toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => removeDocument(doc.id)}
                                className="rounded-full border border-red-400/60 bg-red-500/10 p-2 text-red-200 transition hover:bg-red-500/20"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.07] p-6 text-white shadow-[0_25px_50px_-35px_rgba(15,23,42,0.5)]">
                        <h4 className="text-lg font-semibold">Generate Test</h4>
                        {uploadedDocuments.length === 0 ? (
                          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center text-sm text-blue-100/70">
                            Upload documents first to generate tests
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-blue-100/80">Difficulty Level</label>
                              <select className="mt-2 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400/50">
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-blue-100/80">Number of Questions</label>
                              <select className="mt-2 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400/50">
                                <option value="5">5 Questions</option>
                                <option value="10">10 Questions</option>
                                <option value="15">15 Questions</option>
                                <option value="20">20 Questions</option>
                              </select>
                            </div>
                            <button
                              onClick={() => generateTestFromDocuments('medium', 10)}
                              disabled={isGeneratingTest}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_-20px_rgba(16,185,129,0.7)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isGeneratingTest ? (
                                <>
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                  Generating Test...
                                </>
                              ) : (
                                <>
                                  <Target className="h-4 w-4" />
                                  Generate Test
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </section>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'tests' && (
                <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
                  <div className="mx-auto w-full max-w-6xl text-white">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-xl font-semibold">Generated Tests</h3>
                      <span className="text-sm text-blue-100/80">{generatedTests.length} test(s) available</span>
                    </div>

                    {generatedTests.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center">
                        <FileText className="mx-auto mb-4 h-16 w-16 text-blue-200" />
                        <h4 className="text-lg font-semibold text-white">No tests generated yet</h4>
                        <p className="mt-2 text-sm text-blue-100/70">
                          Upload documents and generate tests to get started
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {generatedTests.map((test) => (
                          <div
                            key={test.id}
                            className="rounded-2xl border border-white/10 bg-white/10 p-6 text-white shadow-[0_30px_60px_-40px_rgba(15,23,42,0.6)] transition backdrop-blur hover:bg-white/12"
                          >
                            <div className="flex items-start justify-between gap-6">
                              <div className="flex-1">
                                <h4 className="mb-2 text-lg font-semibold">{test.title}</h4>
                                <p className="mb-4 text-sm text-blue-100/80">{test.description}</p>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-blue-100/70">
                                  <span className="flex items-center gap-1">
                                    <Target className="h-4 w-4 text-sky-300" />
                                    {test.questions.length} questions
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Award className="h-4 w-4 text-emerald-300" />
                                    {test.totalPoints} points
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4 text-blue-200/70" />
                                    {test.createdAt.toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => startTest(test)}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-[0_20px_35px_-25px_rgba(37,99,235,0.7)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                                >
                                  <Play className="h-4 w-4" />
                                  Start Test
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Are you sure you want to delete this test?')) {
                                      setGeneratedTests(prev => prev.filter(t => t.id !== test.id));
                                    }
                                  }}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/60 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40"
                                >
                                  <X className="h-3 w-3" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'take-test' && currentTest && (
                <div className="flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
                    <div className="mx-auto max-w-4xl space-y-6 text-white">
                      <div className="rounded-2xl border border-white/12 bg-white/10 px-6 py-5 shadow-[0_25px_50px_-35px_rgba(15,23,42,0.6)]">
                        <h3 className="text-xl font-semibold">{currentTest.title}</h3>
                        <p className="mt-2 text-sm text-blue-100/80">{currentTest.description}</p>

                        <div className="mt-4">
                          <div className="h-2 rounded-full bg-white/10">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                              style={{
                                width: `${(testSession?.answers ? Object.keys(testSession.answers).length : 0) / currentTest.questions.length * 100}%`
                              }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-blue-100/70">
                            Progress: {testSession?.answers ? Object.keys(testSession.answers).length : 0} / {currentTest.questions.length} questions answered
                          </p>
                        </div>
                      </div>

                      <div className="space-y-6 pb-10">
                        {currentTest.questions.map((question, index) => (
                          <div key={question.id} className="rounded-2xl border border-white/12 bg-white/8 p-6 shadow-[0_25px_45px_-35px_rgba(15,23,42,0.6)] backdrop-blur">
                            <div className="mb-4 flex items-start justify-between gap-4">
                              <h4 className="text-lg font-medium">
                                Question {index + 1} ({question.points} points)
                              </h4>
                              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100/80">
                                {question.difficulty.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-blue-100/90">{question.question}</p>

                            <div className="mt-4 space-y-3">
                              {question.type === 'multiple-choice' && question.options && (
                                <div className="space-y-2">
                                  {question.options.map((option) => (
                                    <label
                                      key={option}
                                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-blue-100/90 transition hover:bg-blue-500/15"
                                    >
                                      <input
                                        type="radio"
                                        name={question.id}
                                        value={option}
                                        checked={testSession?.answers?.[question.id] === option}
                                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                        className="h-4 w-4 border border-white/30 text-blue-400 focus:ring-blue-300"
                                      />
                                      <span>{option}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {(question.type === 'short-answer' || question.type === 'essay') && (
                                <textarea
                                  value={testSession?.answers?.[question.id] || ''}
                                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                                  rows={question.type === 'essay' ? 6 : 3}
                                  placeholder="Type your response here..."
                                />
                              )}

                              {question.type === 'true-false' && (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  {['True', 'False'].map((option) => (
                                    <label
                                      key={option}
                                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-blue-100/90 transition hover:bg-blue-500/15"
                                    >
                                      <input
                                        type="radio"
                                        name={question.id}
                                        value={option}
                                        checked={testSession?.answers?.[question.id] === option}
                                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                        className="h-4 w-4 border border-white/30 text-blue-400 focus:ring-blue-300"
                                      />
                                      <span>{option}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          onClick={() => setActiveTab('tests')}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-blue-100 transition hover:bg-white/15"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Back to Tests
                        </button>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={handleSubmitTest}
                            disabled={isCorrecting}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_35px_-25px_rgba(37,99,235,0.7)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isCorrecting ? (
                              <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4" />
                                Submit Test
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'results' && (
                <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
                  <div className="mx-auto max-w-5xl space-y-6">
                    {showResults && currentTest && (
                      <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-6 shadow-[0_18px_32px_-24px_rgba(30,41,59,0.35)]">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <h3 className="text-2xl font-semibold text-slate-900">Test Summary</h3>
                            <p className="text-sm text-slate-600">{currentTest.title}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            <div className="rounded-xl bg-white px-4 py-3 text-center shadow-sm">
                              <p className="text-xs uppercase text-slate-500">Score</p>
                              <p className="mt-1 text-xl font-semibold text-slate-900">
                                {totalScore} / {maxScore}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white px-4 py-3 text-center shadow-sm">
                              <p className="text-xs uppercase text-slate-500">Accuracy</p>
                              <p className="mt-1 text-xl font-semibold text-slate-900">{percentage}%</p>
                            </div>
                            <div className="rounded-xl bg-white px-4 py-3 text-center shadow-sm">
                              <p className="text-xs uppercase text-slate-500">Correct</p>
                              <p className="mt-1 text-xl font-semibold text-slate-900">
                                {testResults.filter(r => r.isCorrect).length}/{testResults.length}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {testResults.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-inner">
                          No results yet. Complete a test to see detailed feedback.
                        </div>
                      ) : (
                        testResults.map((result, index) => {
                          const question = currentTest?.questions.find(q => q.id === result.questionId);
                          return (
                            <div
                              key={result.questionId}
                              className={`rounded-2xl border px-6 py-5 shadow-sm ${
                                result.isCorrect
                                  ? 'border-emerald-200 bg-emerald-50/70'
                                  : 'border-rose-200 bg-rose-50/70'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <h4 className="text-lg font-semibold text-slate-900">
                                  Question {index + 1}{' '}
                                  <span className="text-sm font-normal text-slate-600">
                                    ({result.score}/{result.maxScore} points)
                                  </span>
                                </h4>
                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-inner">
                                  {result.isCorrect ? '✅ Correct' : '❌ Incorrect'}
                                </span>
                              </div>
                              <p className="mt-3 text-sm text-slate-700">{question?.question}</p>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm">
                                  <p className="text-xs font-semibold uppercase text-slate-500">Your Answer</p>
                                  <p className="mt-1">{result.userAnswer || 'No answer provided'}</p>
                                </div>
                                {result.correctAnswer && (
                                  <div className="rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm">
                                    <p className="text-xs font-semibold uppercase text-slate-500">Correct Answer</p>
                                    <p className="mt-1">{result.correctAnswer}</p>
                                  </div>
                                )}
                              </div>
                              <div className="mt-4 rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm">
                                <p className="text-xs font-semibold uppercase text-slate-500">Detailed Feedback</p>
                                <p className="mt-1">{result.feedback}</p>
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {result.strengths && result.strengths.length > 0 && (
                                  <div className="rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm">
                                    <p className="text-xs font-semibold uppercase text-emerald-600">Strengths</p>
                                    <ul className="mt-2 space-y-1">
                                      {result.strengths.map((item) => (
                                        <li key={item}>✅ {item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {result.weaknesses && result.weaknesses.length > 0 && (
                                  <div className="rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm">
                                    <p className="text-xs font-semibold uppercase text-rose-600">Areas for Improvement</p>
                                    <ul className="mt-2 space-y-1">
                                      {result.weaknesses.map((item) => (
                                        <li key={item}>⚠️ {item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {testResults.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          onClick={() => {
                            setActiveTab('tests');
                            setCurrentTest(null);
                            setTestSession(null);
                            setTestResults([]);
                            setShowResults(false);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Back to Tests
                        </button>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={shareTestResults}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                            </svg>
                            Share Results
                          </button>
                          <button
                            onClick={() => downloadTestResults('markdown')}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                          >
                            <Download className="h-4 w-4" />
                            Download MD
                          </button>
                          <button
                            onClick={() => downloadTestResults('html')}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                          >
                            <Download className="h-4 w-4" />
                            Download HTML
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
  );
};

export default TestSection;
