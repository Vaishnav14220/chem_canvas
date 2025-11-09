# 💡 Dynamic Document-to-Simulation Generator

## Overview

The **Dynamic Document-to-Simulation Generator** is an intelligent AI-powered system that transforms educational documents into interactive, model-based simulations. This feature leverages the Gemini API's structured output capabilities to create domain-agnostic educational tools across physics, chemistry, biology, finance, and more.

## 🎯 Key Features

### 1. **AI-Powered Document Analysis** (Stage 1)
- Automatically extracts key concepts from uploaded documents
- Identifies:
  - **Key Topics**: Main subjects and concepts discussed
  - **Core Formulas**: Mathematical equations with LaTeX formatting and variable descriptions
  - **Key Definitions**: Important terms and their explanations

### 2. **Context-Aware Simulation Suggestion** (Stage 2)
- Analyzes extracted concepts to suggest relevant interactive simulations
- Generates 3-7 simulation ideas tailored to the document content
- Each suggestion includes:
  - Clear title and description
  - Domain classification (physics, chemistry, biology, finance, etc.)
  - Complexity level (basic, intermediate, advanced)
  - Related formulas and topics
  - Estimated build time

### 3. **Dynamic Simulation Configuration** (Stage 3)
- Uses Gemini API with structured output to generate complete simulation schemas
- Automatically creates:
  - **Input Parameters** with smart control types:
    - Sliders for continuous values
    - Knobs for dynamic adjustment
    - Switches/Toggles for boolean states
    - Number fields for precise input
    - Dropdowns for categorical choices
  - **Output Parameters** with formatting options
  - **Calculation Logic** as executable JavaScript
  - **Metadata** including domain, difficulty, and tags

### 4. **Interactive UI Rendering** (Stage 4)
- Renders beautiful, interactive simulation interfaces
- Real-time calculation updates
- Visual controls:
  - **Sliders**: Smooth range inputs with min/max indicators
  - **Knobs**: Circular progress indicators with range control
  - **Switches**: Toggle states for boolean inputs
  - **Number Fields**: Precise numeric entry with units
- Formatted outputs:
  - Decimal, scientific notation, percentage, currency formats
  - Unit display and precision control
- Export and sharing capabilities

## 🚀 How to Use

### Step 1: Upload a Document
1. Navigate to the **Document Understanding Workspace**
2. Upload a PDF or text document containing educational content
3. The system will automatically process and analyze the document

### Step 2: Generate Simulations
1. Click the **"Generate Simulations"** button in the document workspace
2. The AI will analyze your document and extract key concepts
3. Wait for the analysis to complete (usually 5-15 seconds)

### Step 3: Choose a Simulation
1. Browse through the suggested simulations
2. Review the description, complexity level, and related topics
3. Click on a simulation card to create it

### Step 4: Interact with the Simulation
1. Use the input controls (sliders, knobs, switches) to adjust parameters
2. Watch outputs update in real-time
3. Experiment with different values to understand the relationships
4. Export data or share the simulation with others

## 📋 Example Use Cases

### Physics: Ohm's Law Document
**Document Content:**
- Topics: Electricity, Circuit Analysis, Ohm's Law
- Formulas: $V = IR$, $P = VI$
- Definitions: Voltage, Current, Resistance

**Generated Simulations:**
1. **Ohm's Law Calculator**
   - Inputs: Voltage (V), Current (I), Resistance (R)
   - Outputs: Calculate any missing value
   - Controls: Sliders for each parameter

2. **Power Calculator**
   - Inputs: Voltage, Current
   - Outputs: Power dissipation
   - Visualization: Power vs. current graph

### Finance: Compound Interest Document
**Document Content:**
- Topics: Compound Interest, Investment Growth
- Formulas: $A = P(1 + r/n)^{nt}$
- Definitions: Principal, Interest Rate, Compounding Frequency

**Generated Simulations:**
1. **Compound Interest Calculator**
   - Inputs: Principal (P), Rate (r), Time (t), Compounding frequency (n)
   - Outputs: Final amount, Total interest earned
   - Controls: Sliders for amounts, dropdown for frequency

2. **Investment Growth Visualizer**
   - Inputs: Initial investment, Monthly contribution, Expected return
   - Outputs: Future value, Growth chart
   - Visualization: Time-series graph

### Biology: Population Dynamics Document
**Document Content:**
- Topics: Population Growth, Logistic Model
- Formulas: $\frac{dN}{dt} = rN(1 - N/K)$
- Definitions: Carrying capacity, Growth rate, Population size

**Generated Simulations:**
1. **Logistic Growth Model**
   - Inputs: Initial population, Growth rate, Carrying capacity
   - Outputs: Population over time, Equilibrium point
   - Visualization: Population curve

## 🛠️ Technical Architecture

### Components

1. **`DynamicSimulationGenerator.tsx`**
   - Main workflow manager
   - Handles all 4 stages of simulation generation
   - Progress tracking and error handling

2. **`InteractiveSimulationRenderer.tsx`**
   - Dynamic UI rendering engine
   - Implements various control types
   - Real-time calculation updates

3. **`simulationService.ts`**
   - Gemini API integration
   - Concept extraction
   - Simulation schema generation
   - Execution engine

4. **`simulation.ts` (Types)**
   - TypeScript interfaces for all simulation components
   - Type safety throughout the system

### Data Flow

```
Document Upload
    ↓
Stage 1: Extract Concepts
    ↓ (Topics, Formulas, Definitions)
Stage 2: Suggest Simulations
    ↓ (Simulation Ideas)
Stage 3: Configure Schema
    ↓ (Input/Output Parameters, Logic)
Stage 4: Render Interactive UI
    ↓
User Interaction & Real-time Calculation
```

### Gemini API Integration

The system uses **Gemini 2.0 Flash** (with fallback to Gemini 1.5 Flash) with structured output:
- **Response Schema**: Enforces consistent JSON structure
- **Type Safety**: Guarantees correct data types
- **Validation**: Ensures required fields are present
- **Model Fallback**: Automatically tries multiple models for reliability

Example Schema for Simulation Suggestions:
```typescript
{
  type: SchemaType.OBJECT,
  properties: {
    simulations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          domain: { type: SchemaType.STRING },
          complexity: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['basic', 'intermediate', 'advanced']
          }
        }
      }
    }
  }
}
```

## 🎨 UI/UX Features

### Visual Design
- **Gradient Backgrounds**: Purple-to-blue gradients for modern aesthetic
- **Glass Morphism**: Frosted glass effects with backdrop blur
- **Smooth Animations**: Hover effects, transitions, and loading states
- **Responsive Layout**: Works on desktop and tablet devices

### Interactive Controls
- **Slider**: Horizontal range with visual track and current value display
- **Knob**: Circular progress indicator with numeric display
- **Switch**: Toggle for boolean states with smooth animation
- **Number Field**: Precise input with unit labels
- **Dropdown**: Select from predefined options

### Output Display
- **Large, Bold Numbers**: Easy-to-read results
- **Unit Labels**: Clear indication of measurement units
- **Format Options**: Scientific notation, percentages, currency
- **Color-coded Cards**: Visual distinction between outputs

## 🔧 Configuration Options

### Input Parameter Options
```typescript
{
  id: 'voltage',
  name: 'voltage',
  type: 'number',
  label: 'Input Voltage',
  defaultValue: 12,
  unit: 'V',
  min: 0,
  max: 24,
  step: 0.1,
  controlType: 'slider'
}
```

### Output Parameter Options
```typescript
{
  id: 'current',
  name: 'current',
  type: 'number',
  label: 'Current',
  unit: 'A',
  format: 'decimal',
  precision: 3,
  description: 'Calculated current through the circuit'
}
```

## 🚨 Error Handling

The system includes comprehensive error handling:
- **API Errors**: Clear messages when Gemini API fails
- **Calculation Errors**: Safe execution with error boundaries
- **Validation**: Input constraints and warnings
- **Fallback States**: Graceful degradation when features unavailable

## 🔐 Security Considerations

- **API Key Management**: Secure storage and transmission
- **Code Execution**: Safe evaluation in isolated context
- **Input Sanitization**: Prevents injection attacks
- **Rate Limiting**: Respects API quotas

## 📈 Performance

- **Lazy Loading**: Components loaded on demand
- **Debounced Calculations**: Prevents excessive recalculation
- **Memoization**: Caches expensive operations
- **Optimized Rendering**: Minimal re-renders with React best practices

## 🎓 Educational Benefits

1. **Active Learning**: Students interact directly with concepts
2. **Visual Feedback**: Immediate results reinforce understanding
3. **Experimentation**: Safe environment to test hypotheses
4. **Multi-domain**: Works across all STEM subjects and finance
5. **Personalized**: Generated specifically for each document

## 🔮 Future Enhancements

- [ ] **Visualization Charts**: Add graphs and plots for outputs
- [ ] **Multi-step Simulations**: Complex workflows with multiple stages
- [ ] **Collaborative Features**: Share and remix simulations
- [ ] **Template Library**: Pre-built simulation templates
- [ ] **Advanced Controls**: Date pickers, color selectors, file uploads
- [ ] **Animation Support**: Time-based simulations with play/pause
- [ ] **3D Visualizations**: WebGL-based molecular/structural models
- [ ] **Mobile Optimization**: Touch-friendly controls for tablets

## 📝 License

Part of the Chem Canvas educational platform.

---

**Built with ❤️ using React, TypeScript, and Google Gemini AI**
