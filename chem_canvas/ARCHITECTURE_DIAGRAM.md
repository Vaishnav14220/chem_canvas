# System Architecture Diagram

## Component Hierarchy

```
DocumentUnderstandingWorkspace
│
├─ [Upload Document Section]
│  └─ File Upload Handler
│
├─ [Document Display Section]
│  ├─ PDF Viewer
│  ├─ Chat with Document
│  └─ **Generate Simulations Button** ← NEW
│
└─ [Simulation Generator Modal] ← NEW
   │
   └─ DynamicSimulationGenerator
      │
      ├─ Stage 1: Analysis View
      │  └─ Shows document preview
      │
      ├─ Stage 2: Suggestions View
      │  ├─ Extracted Concepts Summary
      │  │  ├─ Key Topics (badges)
      │  │  ├─ Core Formulas (count)
      │  │  └─ Definitions (count)
      │  │
      │  └─ Simulation Suggestion Grid
      │     └─ Suggestion Cards (clickable)
      │        ├─ Title
      │        ├─ Description
      │        ├─ Domain badge
      │        ├─ Complexity badge
      │        └─ Estimated time
      │
      ├─ Stage 3: Configuration View
      │  └─ Loading indicator
      │
      └─ Stage 4: Simulation View
         │
         └─ InteractiveSimulationRenderer
            │
            ├─ [Header Section]
            │  ├─ Title & Description
            │  ├─ Domain/Difficulty badges
            │  ├─ Formula display (LaTeX)
            │  └─ Close button
            │
            ├─ [Input Controls Panel]
            │  ├─ Reset button
            │  └─ Input Controls (mapped dynamically)
            │     ├─ Slider Control
            │     ├─ Knob Control
            │     ├─ Switch Control
            │     ├─ Number Field Control
            │     └─ Dropdown Control
            │
            └─ [Output Display Panel]
               ├─ Output Cards (auto-generated)
               │  ├─ Label & description
               │  ├─ Formatted value
               │  └─ Unit display
               │
               └─ [Action Buttons]
                  ├─ Export Data
                  └─ Share
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: Document Analysis                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Input: documentContent, documentName                       │  │
│  │   ↓                                                        │  │
│  │ simulationService.analyzeDocumentForConcepts()            │  │
│  │   ↓                                                        │  │
│  │ Gemini API Request (with structured output schema)        │  │
│  │   ↓                                                        │  │
│  │ Output: ExtractedConcept                                   │  │
│  │   • keyTopics: string[]                                   │  │
│  │   • coreFormulas: Formula[]                               │  │
│  │   • keyDefinitions: Definition[]                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2: Simulation Suggestion                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Input: ExtractedConcept                                    │  │
│  │   ↓                                                        │  │
│  │ simulationService.suggestSimulations()                    │  │
│  │   ↓                                                        │  │
│  │ Gemini API Request (structured output)                    │  │
│  │   ↓                                                        │  │
│  │ Output: SimulationSuggestion[]                            │  │
│  │   • id, title, description                                │  │
│  │   • domain (physics, chemistry, etc.)                     │  │
│  │   • complexity (basic, intermediate, advanced)            │  │
│  │   • relatedFormulas, relatedTopics                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [USER SELECTS SIMULATION]
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 3: Dynamic Configuration                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Input: SimulationSuggestion, ExtractedConcept             │  │
│  │   ↓                                                        │  │
│  │ simulationService.generateSimulationSchema()              │  │
│  │   ↓                                                        │  │
│  │ Gemini API Request (complex structured output)            │  │
│  │   • Defines input parameters with control types           │  │
│  │   • Defines output parameters with formats                │  │
│  │   • Generates JavaScript calculation logic                │  │
│  │   ↓                                                        │  │
│  │ Output: SimulationSchema                                   │  │
│  │   • inputs: InputParameter[]                              │  │
│  │   • outputs: OutputParameter[]                            │  │
│  │   • logic: SimulationLogic                                │  │
│  │   • metadata: SimulationMetadata                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 4: Interactive Rendering                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ InteractiveSimulationRenderer receives:                   │  │
│  │   • SimulationSchema                                       │  │
│  │   ↓                                                        │  │
│  │ Initialize input values from defaults                     │  │
│  │   ↓                                                        │  │
│  │ ┌─────────────────────────────────────────────────────┐  │  │
│  │ │  RENDER LOOP (Real-time Updates)                    │  │  │
│  │ │                                                      │  │  │
│  │ │  User adjusts input control                         │  │  │
│  │ │    ↓                                                 │  │  │
│  │ │  Update inputValues state                           │  │  │
│  │ │    ↓                                                 │  │  │
│  │ │  Trigger useEffect (debounced 100ms)                │  │  │
│  │ │    ↓                                                 │  │  │
│  │ │  simulationService.executeSimulation()              │  │  │
│  │ │    ↓                                                 │  │  │
│  │ │  Execute logic.implementation(inputValues)          │  │  │
│  │ │    ↓                                                 │  │  │
│  │ │  Update outputValues state                          │  │  │
│  │ │    ↓                                                 │  │  │
│  │ │  Re-render with new outputs                         │  │  │
│  │ │    ↓                                                 │  │  │
│  │ │  Display formatted results                          │  │  │
│  │ └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Service Layer Architecture

```
simulationService.ts
│
├─ initializeSimulationService(apiKey)
│  └─ Creates GoogleGenerativeAI instance
│
├─ getAvailableModel(genAI)
│  ├─ Tests models in order: gemini-2.0-flash-exp, gemini-1.5-flash-latest, gemini-1.5-flash
│  ├─ Caches working model for performance
│  └─ Returns: modelName
│
├─ analyzeDocumentForConcepts(content, name)
│  ├─ Model: Best available (auto-detected)
│  ├─ Output: application/json
│  └─ Schema: ExtractedConcept structure
│
├─ suggestSimulations(concepts)
│  ├─ Model: Best available (auto-detected)
│  ├─ Output: application/json
│  └─ Schema: SimulationSuggestion[] structure
│
├─ generateSimulationSchema(suggestion, concepts)
│  ├─ Model: Best available (auto-detected)
│  ├─ Output: application/json
│  └─ Schema: SimulationSchema structure
│     ├─ InputParameter[] with controlType
│     ├─ OutputParameter[] with format
│     └─ JavaScript logic as string
│
└─ executeSimulation(schema, inputValues)
   ├─ Creates safe Function context
   ├─ Executes: new Function('inputs', logic)(inputValues)
   └─ Returns: { [outputId]: value }
```

## UI Component Tree

```
InteractiveSimulationRenderer
│
├─ Header Section
│  ├─ Title (h1)
│  ├─ Description (p)
│  ├─ Metadata badges
│  │  ├─ Domain badge (purple)
│  │  ├─ Difficulty badge (blue)
│  │  └─ Tags (gray)
│  └─ Formula display (BlockMath)
│
├─ Two-Column Grid Layout
│  │
│  ├─ Left Column: Input Controls Panel
│  │  ├─ Panel header + Reset button
│  │  └─ Input controls (mapped from schema.inputs)
│  │     └─ InputControl component
│  │        ├─ renderControl() switch statement
│  │        │  ├─ case 'slider': → Slider UI
│  │        │  ├─ case 'knob': → Knob UI
│  │        │  ├─ case 'switch': → Toggle UI
│  │        │  ├─ case 'numberField': → Input UI
│  │        │  └─ case 'dropdown': → Select UI
│  │        └─ onChange → handleInputChange()
│  │
│  └─ Right Column: Output Display Panel
│     ├─ Panel header
│     ├─ Error display (if any)
│     ├─ Output cards (mapped from schema.outputs)
│     │  └─ For each output:
│     │     ├─ Label & description
│     │     ├─ formatOutputValue(value, output)
│     │     └─ Unit display
│     └─ Action buttons
│        ├─ Export Data button
│        └─ Share button
│
└─ Real-time Calculation Effect
   useEffect([inputValues])
   └─ Debounced calculation (100ms)
      └─ Updates outputValues
```

## State Management

```
DynamicSimulationGenerator State:
├─ currentStage: 'analysis' | 'suggestions' | 'configuration' | 'simulation'
├─ isProcessing: boolean
├─ error: string | null
├─ extractedConcepts: ExtractedConcept | null
├─ suggestions: SimulationSuggestion[]
├─ selectedSuggestion: SimulationSuggestion | null
├─ simulationSchema: SimulationSchema | null
└─ isGeneratingSchema: boolean

InteractiveSimulationRenderer State:
├─ inputValues: { [inputId]: value }
├─ outputValues: { [outputId]: value }
├─ error: string | null
└─ isCalculating: boolean

DocumentUnderstandingWorkspace State (additions):
├─ showSimulationGenerator: boolean
└─ selectedDocumentForSimulation: ProcessedDocument | null
```

## Type System Overview

```
simulation.ts Type Hierarchy:

ExtractedConcept
├─ keyTopics: string[]
├─ coreFormulas: Formula[]
│  └─ Formula
│     ├─ id, latex, description
│     └─ variables: Variable[]
│        └─ Variable { symbol, name, unit?, description? }
└─ keyDefinitions: Definition[]
   └─ Definition { term, definition, relatedFormulas? }

SimulationSuggestion
├─ id, title, description
├─ domain: string
├─ relatedFormulas: string[]
├─ relatedTopics: string[]
└─ complexity: 'basic' | 'intermediate' | 'advanced'

SimulationSchema
├─ id, title, description
├─ inputs: InputParameter[]
│  └─ InputParameter
│     ├─ id, name, type, label, defaultValue
│     ├─ unit?, min?, max?, step?
│     └─ controlType: 'slider' | 'knob' | 'switch' | ...
├─ outputs: OutputParameter[]
│  └─ OutputParameter
│     ├─ id, name, type, label
│     └─ format?: 'decimal' | 'scientific' | 'percentage' | 'currency'
├─ logic: SimulationLogic
│  └─ { implementation: string, equation?: string, explanation?: string }
└─ metadata: SimulationMetadata
   └─ { domain, difficulty, tags }
```

## API Integration Flow

```
Gemini API Structured Output Pattern:

1. Create model with responseSchema
   ↓
   model = genAI.getGenerativeModel({
     model: 'gemini-1.5-pro-002',
     generationConfig: {
       responseMimeType: 'application/json',
       responseSchema: {
         type: SchemaType.OBJECT,
         properties: { ... },
         required: [ ... ]
       }
     }
   })

2. Send prompt with context
   ↓
   result = await model.generateContent(prompt)

3. Parse JSON response
   ↓
   response = JSON.parse(result.response.text())

4. TypeScript type assertion
   ↓
   return response as TargetType
```

---

**This architecture provides:**
- Clear separation of concerns
- Type safety throughout
- Scalable component structure
- Easy to extend with new features
- Maintainable codebase
