# Custom Patterns & Favorites Feature

## Overview
Added functionality to allow users to provide custom patterns/templates for preparation materials and save their favorites for quick access.

## Features Added

### 1. Custom Pattern Upload
Users can now provide their own templates for each preparation type:
- Click the **Upload** button (📤) next to any preparation type
- Enter a custom pattern/template in the dialog
- AI will use the pattern structure and fill it with content from the document
- Useful for following specific study guide formats or institutional requirements

**Example Use Cases:**
- Follow your school's specific test preparation format
- Create materials matching your personal study style
- Use templates from previous courses
- Match specific exam formats

### 2. Save to Favorites
Users can save generated materials for later use:
- Click the **Star** button (⭐) on any preparation type that has content
- Materials are saved to localStorage (persists across sessions)
- Each preparation type can have multiple saved favorites

### 3. Load from Favorites
Quick access to previously saved materials:
- Saved favorites appear in a dropdown below each preparation type
- Shows count of saved items (e.g., "3 saved")
- Click on any favorite to load it instantly
- Remove favorites with the X button

## UI Elements

### For Each Preparation Type:
1. **Main Button** - Generate with default AI pattern
2. **Upload Button** (📤) - Open custom pattern dialog
3. **Star Button** (⭐) - Save current content to favorites (appears when content exists)
4. **Favorites Dropdown** - Expandable list of saved materials (appears when favorites exist)

## Technical Implementation

### State Management
```typescript
- favorites: {[key: string]: string[]} - Stores favorites per type
- showCustomPatternDialog: boolean - Controls dialog visibility
- customPattern: string - User's custom template
- patternType: string - Current type being customized
```

### LocalStorage
- Favorites are automatically saved to `localStorage`
- Key: `preparationFavorites`
- Loads on component mount
- Persists across browser sessions

### Functions
- `handleSaveToFavorites(type)` - Save current material
- `handleRemoveFromFavorites(type, index)` - Delete a favorite
- `handleLoadFavorite(type, material)` - Load saved material
- `handleOpenCustomPattern(type)` - Open custom pattern dialog
- `handleGenerateFromCustomPattern()` - Generate using custom template

## User Workflow

### Creating with Custom Pattern:
1. Upload a PDF document
2. Click Upload button (📤) next to desired preparation type
3. Enter your custom pattern/template
4. Click "Generate"
5. AI creates materials following your pattern

### Saving Favorites:
1. Generate any preparation material
2. Click Star button (⭐) to save
3. Access saved materials anytime from the dropdown

### Using Favorites:
1. Click on the favorites count dropdown
2. Select the favorite you want to load
3. Material appears instantly (no AI generation needed)

## Benefits

✅ **Customization** - Create materials matching your specific needs
✅ **Efficiency** - Reuse successful patterns and save favorites
✅ **Flexibility** - Support different study styles and formats
✅ **Persistence** - Favorites saved across sessions
✅ **Quick Access** - Load saved materials instantly

## Example Custom Patterns

### For Test Preparation:
```
1. **Learning Objectives**: What I need to know
2. **Key Formulas**: Equations I must memorize
3. **Practice Problems**: 
   - Problem 1 with step-by-step solution
   - Problem 2 with hints
4. **Quick Review**: One-page summary
5. **Common Mistakes**: What to avoid
```

### For Lab Practical:
```
1. **Pre-Lab Checklist**: Safety and equipment
2. **Procedure Steps**: Numbered instructions
3. **Expected Results**: What should happen
4. **Data Tables**: Templates for recording
5. **Calculations**: Formulas and examples
6. **Post-Lab Questions**: Analysis questions
```

## Future Enhancements
- Share favorites with other users
- Import/export favorite templates
- Pattern library with community templates
- Tags and search for favorites
- Pattern preview before generation
