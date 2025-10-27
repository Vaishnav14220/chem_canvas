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
  console.log('TestSection component called with isOpen:', isOpen);
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


  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-white border border-gray-300 rounded-lg shadow-lg w-[1200px] max-w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Test Center</h2>
              <p className="text-sm text-gray-600">
                {uploadedDocuments.length > 0 
                  ? `${uploadedDocuments.length} document(s) ready for testing` 
                  : 'Upload documents to create tests'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {timeRemaining > 0 && (
              <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-600">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-gray-200 border border-gray-300 bg-white h-9 w-9"
            >
              <X className="h-4 w-4 text-gray-800" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-300">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'upload', label: 'Upload Documents', icon: Upload },
              { id: 'tests', label: 'Generated Tests', icon: FileText },
              { id: 'take-test', label: 'Take Test', icon: PenTool },
              { id: 'results', label: 'Results', icon: Award }
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap py-4 text-sm font-medium border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-900 hover:text-gray-700'
                  }`}
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          
          {/* Upload Documents Tab */}
          {activeTab === 'upload' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                  <Upload className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">Upload Study Materials</h3>
                  <p className="text-gray-600 mb-6">
                    Upload your documents to generate AI-powered tests and assessments
                  </p>
                  
                  {!isApiKeyConfigured && (
                    <div className="bg-orange-100 border border-orange-300 rounded-lg p-4 mb-6">
                      <p className="text-orange-800 text-sm">
                        <strong>API Key Required:</strong> Configure your Gemini API key to generate and correct tests.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Upload Section */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Upload Documents</h4>
                    <label className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 gap-2 cursor-pointer w-full">
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
                    
                    <div className="space-y-2">
                      {uploadedDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/50 border border-border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {(doc.size / 1024).toFixed(1)} KB • {doc.uploadedAt.toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeDocument(doc.id)}
                            className="p-2 hover:bg-red-100 rounded border border-red-200 bg-white"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Test Generation */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Generate Test</h4>
                    {uploadedDocuments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Upload documents first to generate tests
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Difficulty Level</label>
                          <select className="w-full p-2 border border-border rounded-md bg-background">
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-2">Number of Questions</label>
                          <select className="w-full p-2 border border-border rounded-md bg-background">
                            <option value="5">5 Questions</option>
                            <option value="10">10 Questions</option>
                            <option value="15">15 Questions</option>
                            <option value="20">20 Questions</option>
                          </select>
                        </div>
                        
                        <button
                          onClick={() => generateTestFromDocuments('medium', 10)}
                          disabled={isGeneratingTest}
                          className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-10 gap-2"
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
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generated Tests Tab */}
          {activeTab === 'tests' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">Generated Tests</h3>
                  <span className="text-sm text-muted-foreground">
                    {generatedTests.length} test(s) available
                  </span>
                </div>

                {generatedTests.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-medium mb-2">No tests generated yet</h4>
                    <p className="text-muted-foreground">Upload documents and generate tests to get started</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {generatedTests.map((test) => (
                      <div key={test.id} className="border-2 border-gray-400 rounded-lg p-6 hover:bg-gray-50 transition-colors bg-white shadow-md">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold mb-2 text-gray-800">{test.title}</h4>
                            <p className="text-gray-600 mb-4">{test.description}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Target className="h-4 w-4" />
                                {test.questions.length} questions
                              </span>
                              <span className="flex items-center gap-1">
                                <Award className="h-4 w-4" />
                                {test.totalPoints} points
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {test.createdAt.toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => startTest(test)}
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 gap-2"
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
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-2 border-red-400 bg-white text-red-700 hover:bg-red-50 shadow-sm h-8 px-3 gap-2"
                            >
                              <X className="h-3 w-3 text-red-700" />
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

          {/* Take Test Tab */}
          {activeTab === 'take-test' && currentTest && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold mb-2 text-black">{currentTest.title}</h3>
                  <p className="text-gray-700 mb-4">{currentTest.description}</p>
                  
                  {/* Progress Bar */}
                  <div className="bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(testSession?.answers ? Object.keys(testSession.answers).length : 0) / currentTest.questions.length * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Progress: {testSession?.answers ? Object.keys(testSession.answers).length : 0} / {currentTest.questions.length} questions answered
                  </p>
                </div>

                <div className="space-y-6 pb-8">
                  {currentTest.questions.map((question, index) => (
                    <div key={question.id} className="border-2 border-gray-400 rounded-lg p-6 bg-white shadow-md">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="text-lg font-medium text-black">
                          Question {index + 1} ({question.points} points)
                        </h4>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {question.difficulty}
                        </span>
                      </div>
                      
                      <p className="text-gray-800 mb-4 font-medium">{question.question}</p>
                      
                      {question.type === 'multiple-choice' && question.options && (
                        <div className="space-y-2">
                          {question.options.map((option, optionIndex) => (
                            <label key={optionIndex} className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                              <input
                                type="radio"
                                name={`question-${question.id}`}
                                value={option}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                className="text-blue-600"
                              />
                              <span className="text-gray-800">{option}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      
                      {question.type === 'true-false' && (
                        <div className="space-y-2">
                          {['True', 'False'].map((option) => (
                            <label key={option} className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                              <input
                                type="radio"
                                name={`question-${question.id}`}
                                value={option.toLowerCase()}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                className="text-blue-600"
                              />
                              <span className="text-gray-800">{option}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      
                      {(question.type === 'short-answer' || question.type === 'essay') && (
                        <textarea
                          placeholder={question.type === 'essay' ? 'Write your detailed answer here...' : 'Enter your answer...'}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg bg-white resize-none text-gray-800"
                          rows={question.type === 'essay' ? 6 : 3}
                        />
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Navigation Help */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <div className="flex items-center gap-2 text-blue-800">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-medium">
                      Scroll down to see all questions. The submit button is always visible at the bottom.
                    </p>
                  </div>
                </div>

                </div>
              </div>
              
              {/* Submit Button - Fixed at bottom */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-white p-6">
                <div className="max-w-4xl mx-auto flex justify-between">
                  {/* Back to Tests Button */}
                  <button
                    onClick={() => {
                      setActiveTab('tests');
                      setCurrentTest(null);
                      setTestSession(null);
                    }}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 h-12 px-6 gap-2"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Back to Tests
                  </button>
                  
                  {/* Submit Test Button */}
                  <button
                    onClick={handleSubmitTest}
                    disabled={isCorrecting}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-12 px-6 gap-2 shadow-lg"
                  >
                    {isCorrecting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Correcting Test...
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
          )}

          {/* Results Tab */}
          {activeTab === 'results' && showResults && currentTest && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">Test Results</h3>
                  <p className="text-muted-foreground">{currentTest.title}</p>
                </div>

                {/* Overall Score */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 text-center">
                    <Award className="h-8 w-8 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold text-primary">{totalScore}/{maxScore}</div>
                    <div className="text-sm text-muted-foreground">Total Score</div>
                  </div>
                  
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
                    <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600">{percentage}%</div>
                    <div className="text-sm text-muted-foreground">Percentage</div>
                  </div>
                  
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 text-center">
                    <Target className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600">
                      {testResults.filter(r => r.isCorrect).length}/{testResults.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Correct Answers</div>
                  </div>
                </div>

                {/* Question Results */}
                <div className="space-y-4">
                  {testResults.map((result, index) => {
                    const question = currentTest.questions.find(q => q.id === result.questionId);
                    return (
                      <div key={result.questionId} className={`border rounded-lg p-6 ${
                        result.isCorrect ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'
                      }`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {result.isCorrect ? (
                              <CheckCircle className="h-6 w-6 text-green-600" />
                            ) : (
                              <XCircle className="h-6 w-6 text-red-600" />
                            )}
                            <h4 className="text-lg font-medium">
                              Question {index + 1} - {result.score}/{result.maxScore} points
                            </h4>
                          </div>
                        </div>
                        
                        <p className="text-gray-800 mb-4 font-medium leading-relaxed">{question?.question}</p>
                        
                        <div className="space-y-3">
                          <div>
                            <span className="font-medium text-gray-800">Your Answer:</span>
                            <p className="mt-1 p-4 bg-gray-100 border border-gray-300 rounded-lg text-gray-800 leading-relaxed">
                              {result.userAnswer || 'No answer provided'}
                            </p>
                          </div>
                          
                          {result.correctAnswer && (
                            <div>
                              <span className="font-medium text-gray-800">Correct Answer:</span>
                              <p className="mt-1 p-4 bg-green-100 border border-green-300 rounded-lg text-green-800 leading-relaxed">
                                {result.correctAnswer}
                              </p>
                            </div>
                          )}
                          
                          <div>
                            <span className="font-medium text-gray-800">Detailed Feedback:</span>
                            <p className="mt-1 p-4 bg-blue-50 border border-blue-200 rounded-lg text-gray-800 leading-relaxed">
                              {result.feedback}
                            </p>
                          </div>
                          
                          {result.mistakes && result.mistakes.length > 0 && (
                            <div>
                              <span className="font-medium text-red-700">Areas for Improvement:</span>
                              <ul className="mt-2 space-y-2">
                                {result.mistakes.map((mistake, mistakeIndex) => (
                                  <li key={mistakeIndex} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <span className="text-red-800">{mistake}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {result.strengths && result.strengths.length > 0 && (
                            <div>
                              <span className="font-medium text-green-700">Strengths:</span>
                              <ul className="mt-2 space-y-2">
                                {result.strengths.map((strength, strengthIndex) => (
                                  <li key={strengthIndex} className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <svg className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-green-800">{strength}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {result.weaknesses && result.weaknesses.length > 0 && (
                            <div>
                              <span className="font-medium text-orange-700">Weaknesses:</span>
                              <ul className="mt-2 space-y-2">
                                {result.weaknesses.map((weakness, weaknessIndex) => (
                                  <li key={weaknessIndex} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <svg className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-orange-800">{weakness}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {result.expectedAnswer && (
                            <div>
                              <span className="font-medium text-purple-700">Expected Answer:</span>
                              <p className="mt-2 p-4 bg-purple-50 border border-purple-200 rounded-lg text-purple-800 leading-relaxed">
                                {result.expectedAnswer}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex flex-wrap gap-3 justify-between">
                  {/* Back to Main Page */}
                  <button
                    onClick={() => {
                      setActiveTab('tests');
                      setCurrentTest(null);
                      setTestSession(null);
                      setTestResults([]);
                      setShowResults(false);
                    }}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 h-10 px-4 gap-2"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Back to Tests
                  </button>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    {/* Share Button */}
                    <button
                      onClick={shareTestResults}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 gap-2"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                      </svg>
                      Share Results
                    </button>
                    
                    {/* Download Markdown */}
                    <button
                      onClick={() => downloadTestResults('markdown')}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 h-10 px-4 gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download MD
                    </button>
                    
                    {/* Download HTML */}
                    <button
                      onClick={() => downloadTestResults('html')}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 h-10 px-4 gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download HTML
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestSection;
