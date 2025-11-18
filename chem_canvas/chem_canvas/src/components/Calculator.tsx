import React, { useState } from 'react';
import { Calculator as CalculatorIcon, X } from 'lucide-react';

interface CalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Calculator({ isOpen, onClose }: CalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [isScientificMode, setIsScientificMode] = useState(false);
  const [memory, setMemory] = useState(0);

  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const clearEntry = () => {
    setDisplay('0');
  };

  const performOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '×':
        return firstValue * secondValue;
      case '÷':
        return secondValue !== 0 ? firstValue / secondValue : 0;
      case '^':
        return Math.pow(firstValue, secondValue);
      case '=':
        return secondValue;
      default:
        return secondValue;
    }
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  // Scientific functions
  const scientificFunction = (func: string) => {
    const value = parseFloat(display);
    let result: number;

    switch (func) {
      case 'sin':
        result = Math.sin(value * Math.PI / 180);
        break;
      case 'cos':
        result = Math.cos(value * Math.PI / 180);
        break;
      case 'tan':
        result = Math.tan(value * Math.PI / 180);
        break;
      case 'log':
        result = Math.log10(value);
        break;
      case 'ln':
        result = Math.log(value);
        break;
      case 'sqrt':
        result = Math.sqrt(value);
        break;
      case 'square':
        result = value * value;
        break;
      case 'cube':
        result = value * value * value;
        break;
      case 'pi':
        result = Math.PI;
        break;
      case 'e':
        result = Math.E;
        break;
      case 'factorial':
        result = factorial(value);
        break;
      case 'inverse':
        result = 1 / value;
        break;
      case 'negate':
        result = -value;
        break;
      default:
        result = value;
    }

    setDisplay(String(result));
    setWaitingForOperand(true);
  };

  const factorial = (n: number): number => {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  };

  // Memory functions
  const memoryClear = () => setMemory(0);
  const memoryRecall = () => setDisplay(String(memory));
  const memoryAdd = () => setMemory(memory + parseFloat(display));
  const memorySubtract = () => setMemory(memory - parseFloat(display));
  const memoryStore = () => setMemory(parseFloat(display));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700 w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <CalculatorIcon className="h-6 w-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Scientific Calculator</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsScientificMode(!isScientificMode)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                isScientificMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {isScientificMode ? 'Scientific' : 'Basic'}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>

        {/* Display */}
        <div className="p-4">
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="text-right">
              <div className="text-2xl font-mono text-white min-h-[2rem] flex items-center justify-end break-all">
                {display}
              </div>
              {memory !== 0 && (
                <div className="text-sm text-blue-400 mt-1">M: {memory}</div>
              )}
            </div>
          </div>

          {/* Scientific Functions Row */}
          {isScientificMode && (
            <div className="grid grid-cols-8 gap-2 mb-3">
              <button
                onClick={() => scientificFunction('sin')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                sin
              </button>
              <button
                onClick={() => scientificFunction('cos')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                cos
              </button>
              <button
                onClick={() => scientificFunction('tan')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                tan
              </button>
              <button
                onClick={() => scientificFunction('log')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                log
              </button>
              <button
                onClick={() => scientificFunction('ln')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                ln
              </button>
              <button
                onClick={() => scientificFunction('sqrt')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                √
              </button>
              <button
                onClick={() => scientificFunction('square')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                x²
              </button>
              <button
                onClick={() => scientificFunction('cube')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                x³
              </button>
            </div>
          )}

          {/* Memory Functions Row */}
          {isScientificMode && (
            <div className="grid grid-cols-5 gap-2 mb-3">
              <button
                onClick={memoryClear}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                MC
              </button>
              <button
                onClick={memoryRecall}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                MR
              </button>
              <button
                onClick={memoryAdd}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                M+
              </button>
              <button
                onClick={memorySubtract}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                M-
              </button>
              <button
                onClick={memoryStore}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-2 rounded-lg transition-colors text-xs"
              >
                MS
              </button>
            </div>
          )}

          {/* Main Calculator Buttons */}
          <div className="grid grid-cols-4 gap-3">
            {/* Row 1 */}
            <button
              onClick={clear}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              C
            </button>
            <button
              onClick={clearEntry}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              CE
            </button>
            <button
              onClick={handleBackspace}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              ⌫
            </button>
            <button
              onClick={() => performOperation('÷')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              ÷
            </button>

            {/* Row 2 */}
            <button
              onClick={() => inputNumber('7')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              7
            </button>
            <button
              onClick={() => inputNumber('8')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              8
            </button>
            <button
              onClick={() => inputNumber('9')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              9
            </button>
            <button
              onClick={() => performOperation('×')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              ×
            </button>

            {/* Row 3 */}
            <button
              onClick={() => inputNumber('4')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              4
            </button>
            <button
              onClick={() => inputNumber('5')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              5
            </button>
            <button
              onClick={() => inputNumber('6')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              6
            </button>
            <button
              onClick={() => performOperation('-')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              −
            </button>

            {/* Row 4 */}
            <button
              onClick={() => inputNumber('1')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              1
            </button>
            <button
              onClick={() => inputNumber('2')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              2
            </button>
            <button
              onClick={() => inputNumber('3')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              3
            </button>
            <button
              onClick={() => performOperation('+')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              +
            </button>

            {/* Row 5 */}
            <button
              onClick={() => scientificFunction('negate')}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              ±
            </button>
            <button
              onClick={() => inputNumber('0')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              0
            </button>
            <button
              onClick={inputDecimal}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              .
            </button>
            <button
              onClick={handleEquals}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              =
            </button>
          </div>

          {/* Additional Scientific Functions */}
          {isScientificMode && (
            <div className="grid grid-cols-4 gap-3 mt-3">
              <button
                onClick={() => scientificFunction('pi')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                π
              </button>
              <button
                onClick={() => scientificFunction('e')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                e
              </button>
              <button
                onClick={() => performOperation('^')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                x^y
              </button>
              <button
                onClick={() => scientificFunction('factorial')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                n!
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            Scientific calculator for chemistry calculations - Toggle between Basic and Scientific modes
          </p>
        </div>
      </div>
    </div>
  );
}
