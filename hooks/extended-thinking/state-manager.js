const fs = require('fs');
const path = require('path');

class ThinkingStateManager {
    constructor(projectDir = null) {
        // Use project-specific state file if in a project, otherwise global
        this.stateDir = projectDir ? path.join(projectDir, '.claude') : path.join(require('os').homedir(), '.claude');
        this.stateFile = path.join(this.stateDir, 'extended-thinking-state.json');
        this.defaultState = {
            thinkingToggle: false,
            deepThinkingToggle: false,
            lastModified: new Date().toISOString()
        };
    }

    /**
     * Ensure the state directory exists
     */
    ensureStateDir() {
        if (!fs.existsSync(this.stateDir)) {
            fs.mkdirSync(this.stateDir, { recursive: true });
        }
    }

    /**
     * Read the current toggle states
     * @returns {Object} Current state object
     */
    readState() {
        try {
            if (!fs.existsSync(this.stateFile)) {
                return { ...this.defaultState };
            }
            const data = fs.readFileSync(this.stateFile, 'utf8');
            const state = JSON.parse(data);
            return { ...this.defaultState, ...state };
        } catch (error) {
            console.error('Error reading thinking state:', error.message);
            return { ...this.defaultState };
        }
    }

    /**
     * Write toggle states to file
     * @param {Object} state - State object to write
     */
    writeState(state) {
        try {
            this.ensureStateDir();
            const updatedState = {
                ...state,
                lastModified: new Date().toISOString()
            };
            fs.writeFileSync(this.stateFile, JSON.stringify(updatedState, null, 2));
        } catch (error) {
            console.error('Error writing thinking state:', error.message);
            throw error;
        }
    }

    /**
     * Toggle thinking mode on/off
     * @returns {boolean} New thinking toggle state
     */
    toggleThinking() {
        const state = this.readState();
        state.thinkingToggle = !state.thinkingToggle;
        this.writeState(state);
        return state.thinkingToggle;
    }

    /**
     * Toggle deep thinking mode on/off
     * @returns {boolean} New deep thinking toggle state
     */
    toggleDeepThinking() {
        const state = this.readState();
        state.deepThinkingToggle = !state.deepThinkingToggle;
        this.writeState(state);
        return state.deepThinkingToggle;
    }

    /**
     * Get current toggle states
     * @returns {Object} Current toggle states
     */
    getToggles() {
        const state = this.readState();
        return {
            thinking: state.thinkingToggle,
            deepThinking: state.deepThinkingToggle
        };
    }

    /**
     * Set specific toggle state
     * @param {string} toggleType - 'thinking' or 'deepThinking'
     * @param {boolean} value - New toggle value
     */
    setToggle(toggleType, value) {
        const state = this.readState();
        if (toggleType === 'thinking') {
            state.thinkingToggle = value;
        } else if (toggleType === 'deepThinking') {
            state.deepThinkingToggle = value;
        } else {
            throw new Error(`Invalid toggle type: ${toggleType}`);
        }
        this.writeState(state);
    }

    /**
     * Get the appropriate thinking prompt based on current toggles
     * @returns {string|null} Thinking prompt or null if no thinking enabled
     */
    getThinkingPrompt() {
        const toggles = this.getToggles();
        
        if (toggles.deepThinking) {
            return this.getDeepThinkingPrompt();
        } else if (toggles.thinking) {
            return this.getExtendedThinkingPrompt();
        }
        
        return null;
    }

    /**
     * Get extended thinking prompt
     * @returns {string} Extended thinking instructions
     */
    getExtendedThinkingPrompt() {
        return `Before responding, engage in extended thinking. Think through this step-by-step:

1. **Analyze the Request**: What exactly is being asked? What are the key components?
2. **Consider Context**: What relevant information should I consider?
3. **Plan Approach**: What's the best way to address this request?
4. **Think Through Implications**: What are the potential outcomes or considerations?

Then provide your thoughtful response.`;
    }

    /**
     * Get deep thinking prompt
     * @returns {string} Deep thinking instructions
     */
    getDeepThinkingPrompt() {
        return `Before responding, engage in DEEP analytical thinking. Work through this systematically:

## 🧠 DEEP ANALYSIS MODE

### 1. **Request Deconstruction**
   - Break down the request into its fundamental components
   - Identify explicit and implicit requirements
   - Note any ambiguities or assumptions

### 2. **Context & Constraints Analysis**
   - What's the broader context here?
   - What constraints or limitations should I consider?
   - What domain knowledge is relevant?

### 3. **Multiple Perspective Consideration**
   - How might different stakeholders view this?
   - What are alternative approaches or interpretations?
   - What edge cases or exceptions exist?

### 4. **Solution Architecture**
   - What's the optimal approach and why?
   - What are the trade-offs involved?
   - How does this fit into larger patterns or principles?

### 5. **Verification & Quality Check**
   - Does my reasoning hold up under scrutiny?
   - Have I missed any critical aspects?
   - Is this the best possible response?

Now provide your comprehensive, well-reasoned response.`;
    }

    /**
     * Get status information for display
     * @returns {Object} Status information
     */
    getStatus() {
        const state = this.readState();
        return {
            thinking: state.thinkingToggle,
            deepThinking: state.deepThinkingToggle,
            lastModified: state.lastModified,
            stateFile: this.stateFile,
            activeMode: state.deepThinkingToggle ? 'Deep Thinking' : 
                       state.thinkingToggle ? 'Extended Thinking' : 'Normal'
        };
    }
}

module.exports = ThinkingStateManager;