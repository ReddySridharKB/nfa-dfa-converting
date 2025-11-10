// Global variables for graphs and data
let nfaNetwork, completeDfaNetwork, dfaNetwork;
let nfaData = { nodes: [], edges: [] };
let completeDfaData = { nodes: [], edges: [] };
let dfaData = { nodes: [], edges: [] };
let nfaTransitions = {};
let dfaTransitions = {};
let epsilonClosures = {};
let alphabet = [];
let startState = '';
let finalStates = [];
let dfaSteps = []; // Array to hold each step of DFA construction
let currentStep = 0;

// Initialize graphs on page load
document.addEventListener('DOMContentLoaded', function() {
    const nfaContainer = document.getElementById('nfa-graph');
    const completeDfaContainer = document.getElementById('complete-dfa-graph');
    const dfaContainer = document.getElementById('dfa-graph');
    const options = {
        physics: false,
        edges: {
            smooth: true,
            arrows: {
                to: {
                    enabled: true,
                    type: 'arrow'
                }
            },
            font: {
                size: 16,
                align: 'middle',
                vadjust: 0,
                background: 'white',
                color: 'black',
                strokeWidth: 1,
                strokeColor: 'black'
            }
        }
    };
    nfaNetwork = new vis.Network(nfaContainer, nfaData, options);
    completeDfaNetwork = new vis.Network(completeDfaContainer, completeDfaData, options);
    dfaNetwork = new vis.Network(dfaContainer, dfaData, options);

    // Event listeners
    document.getElementById('convert-btn').addEventListener('click', convertToDFA);
    document.getElementById('next-step-btn').addEventListener('click', nextStep);
    document.getElementById('prev-step-btn').addEventListener('click', prevStep);
    document.getElementById('reset-btn').addEventListener('click', resetPlayback);
    document.getElementById('examples').addEventListener('change', loadExample);
});

// Load example NFAs
function loadExample() {
    const example = document.getElementById('examples').value;
    if (example === 'no-epsilon') {
        // NFA without epsilon transitions - strings containing 'ab'
        document.getElementById('states').value = 'q0,q1,q2,q3';
        document.getElementById('alphabet').value = 'a,b';
        document.getElementById('transitions').value = 'q0,a=q0,q1\nq0,b=q0\nq1,a=q2\nq1,b=q0\nq2,a=q2\nq2,b=q3\nq3,a=q2\nq3,b=q3';
        document.getElementById('start-state').value = 'q0';
        document.getElementById('final-states').value = 'q3';
    } else if (example === 'with-epsilon') {
        // NFA with epsilon transitions - (a|b)*
        document.getElementById('states').value = 'q0,q1,q2,q3';
        document.getElementById('alphabet').value = 'a,b';
        document.getElementById('transitions').value = 'q0,e=q1\nq1,a=q1,q2\nq1,b=q1,q3\nq2,a=q2\nq2,b=q2\nq3,a=q3\nq3,b=q3\nq2,e=q0\nq3,e=q0';
        document.getElementById('start-state').value = 'q0';
        document.getElementById('final-states').value = 'q0,q1';
    }
}

// Parse NFA transitions from input
// This function parses the transition input string into a transitions object and extracts the alphabet.
// It handles transitions with 'e' for epsilon.
function parseTransitions(input) {
    const lines = input.trim().split('\n');
    const transitions = {};
    const alph = new Set();
    for (const line of lines) {
        const parts = line.split('=');
        if (parts.length !== 2) continue;
        const left = parts[0].split(',');
        if (left.length !== 2) continue;
        const state = left[0].trim();
        const symbol = left[1].trim();
        const nextStates = parts[1].split(',').map(s => s.trim());
        if (!transitions[state]) transitions[state] = {};
        if (!transitions[state][symbol]) transitions[state][symbol] = [];
        transitions[state][symbol].push(...nextStates);
        if (symbol !== 'e') alph.add(symbol);
    }
    return { transitions, alphabet: Array.from(alph) };
}

// Compute epsilon-closure for a set of states
// Epsilon-closure is the set of states reachable from the given states via epsilon transitions.
function computeEpsilonClosure(states, transitions) {
    const closure = new Set(states);
    const stack = [...states];
    while (stack.length > 0) {
        const state = stack.pop();
        if (transitions[state] && transitions[state]['e']) {
            for (const next of transitions[state]['e']) {
                if (!closure.has(next)) {
                    closure.add(next);
                    stack.push(next);
                }
            }
        }
    }
    return Array.from(closure).sort();
}

// Perform subset construction to convert NFA to DFA
// This implements the subset construction algorithm, handling epsilon transitions.
function convertToDFA() {
    const statesInput = document.getElementById('states').value;
    const alphabetInput = document.getElementById('alphabet').value;
    const transitionsInput = document.getElementById('transitions').value;
    startState = document.getElementById('start-state').value.trim();
    finalStates = document.getElementById('final-states').value.split(',').map(s => s.trim());

    if (!statesInput || !alphabetInput || !transitionsInput || !startState) {
        alert('Please provide all required inputs.');
        return;
    }

    const states = statesInput.split(',').map(s => s.trim());
    alphabet = alphabetInput.split(',').map(s => s.trim());
    const { transitions } = parseTransitions(transitionsInput);
    nfaTransitions = transitions;

    // Compute epsilon-closures for all states
    const allStates = Object.keys(transitions);
    epsilonClosures = {};
    for (const state of allStates) {
        epsilonClosures[state] = computeEpsilonClosure([state], transitions);
    }

    // Subset construction
    const dfaStates = [];
    const dfaTrans = {};
    const stateMap = {}; // Map subset to DFA state name
    const queue = [];
    const initialClosure = computeEpsilonClosure([startState], transitions);
    const initialSubset = initialClosure.sort().join(',');
    dfaStates.push(initialSubset);
    stateMap[initialSubset] = initialSubset; // Use subset as DFA state name
    queue.push(initialSubset);
    dfaSteps = [{ subset: initialSubset, dfaState: initialSubset, transitions: {} }]; // Save first step

    while (queue.length > 0) {
        const currentSubset = queue.shift();
        const currentDfaState = stateMap[currentSubset];
        dfaTrans[currentDfaState] = {};

        for (const symbol of alphabet) {
            const nextStates = new Set();
            for (const state of currentSubset.split(',')) {
                if (transitions[state] && transitions[state][symbol]) {
                    for (const next of transitions[state][symbol]) {
                        const closure = computeEpsilonClosure([next], transitions);
                        closure.forEach(s => nextStates.add(s));
                    }
                }
            }
            const nextSubset = Array.from(nextStates).sort().join(',');
            if (nextSubset && !stateMap[nextSubset]) {
                stateMap[nextSubset] = nextSubset;
                dfaStates.push(nextSubset);
                queue.push(nextSubset);
                dfaSteps.push({ subset: nextSubset, dfaState: nextSubset, transitions: {} });
            }
            if (nextSubset) {
                dfaTrans[currentDfaState][symbol] = stateMap[nextSubset];
            }
        }
        // Update the step with transitions
        const stepIndex = dfaSteps.findIndex(s => s.dfaState === currentDfaState);
        dfaSteps[stepIndex].transitions = { ...dfaTrans[currentDfaState] };
    }

    dfaTransitions = dfaTrans;

    // Visualize NFA
    visualizeNFA(transitions, states);

    // Visualize complete DFA
    visualizeCompleteDFA(dfaTrans, dfaStates, stateMap);

    // Prepare step-by-step DFA visualization
    dfaData.nodes = [];
    dfaData.edges = [];
    dfaNetwork.setData(dfaData);

    // Display tables
    displayNFATable(transitions);
    displayDFATable(dfaTrans, dfaStates);

    // Enable playback
    document.getElementById('next-step-btn').disabled = false;
    document.getElementById('reset-btn').disabled = false;
    currentStep = 0;
    updateStepCounter();
}

// Visualize NFA
function visualizeNFA(transitions, states) {
    nfaData.nodes = states.map(state => ({
        id: state,
        label: state,
        color: state === startState ? '#0a66c2' : '#97c2fc',
        shape: finalStates.includes(state) ? 'circle' : 'circle',
        borderWidth: finalStates.includes(state) ? 3 : 1
    }));
    nfaData.edges = [];
    const edgeMap = {};
    for (const state in transitions) {
        for (const symbol in transitions[state]) {
            for (const next of transitions[state][symbol]) {
                const key = `${state}-${next}`;
                if (!edgeMap[key]) edgeMap[key] = [];
                edgeMap[key].push(symbol === 'e' ? 'ε' : symbol);
            }
        }
    }
    for (const key in edgeMap) {
        const [from, to] = key.split('-');
        const labels = edgeMap[key].sort().join(',');
        nfaData.edges.push({
            from: from,
            to: to,
            label: labels,
            arrows: 'to',
            smooth: from < to ? false : { type: 'curvedCCW', roundness: 0.8 }
        });
    }
    nfaNetwork.setData(nfaData);
}

// Next step in DFA visualization
function nextStep() {
    if (currentStep < dfaSteps.length) {
        const step = dfaSteps[currentStep];
        // Add node
        dfaData.nodes.push({
            id: step.dfaState,
            label: `{${step.dfaState}}`,
            color: '#97c2fc',
            shape: 'circle',
            borderWidth: step.subset.split(',').some(s => finalStates.includes(s)) ? 3 : 1
        });
        // Add edges for this step, combining labels on same edges
        const edgeMap = {};
        for (const symbol in step.transitions) {
            const next = step.transitions[symbol];
            const key = `${step.dfaState}-${next}`;
            if (!edgeMap[key]) edgeMap[key] = [];
            edgeMap[key].push(symbol);
        }
        for (const key in edgeMap) {
            const [from, to] = key.split('-');
            const labels = edgeMap[key].sort().join(',');
            dfaData.edges.push({
                from: from,
                to: to,
                label: labels,
                arrows: 'to',
                smooth: from < to ? false : { type: 'curvedCCW', roundness: 0.8 }
            });
        }
        dfaNetwork.setData(dfaData);
        currentStep++;
        updateStepCounter();
        if (currentStep >= dfaSteps.length) {
            document.getElementById('next-step-btn').disabled = true;
        }
        document.getElementById('prev-step-btn').disabled = currentStep === 0;
    }
}

// Previous step in DFA visualization
function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        // Remove the last added node and its edges
        dfaData.nodes.pop();
        // Rebuild edges up to current step
        dfaData.edges = [];
        for (let i = 0; i < currentStep; i++) {
            const step = dfaSteps[i];
            const edgeMap = {};
            for (const symbol in step.transitions) {
                const next = step.transitions[symbol];
                const key = `${step.dfaState}-${next}`;
                if (!edgeMap[key]) edgeMap[key] = [];
                edgeMap[key].push(symbol);
            }
        for (const key in edgeMap) {
            const [from, to] = key.split('-');
            const labels = edgeMap[key].sort().join(',');
            dfaData.edges.push({
                from: from,
                to: to,
                label: labels,
                arrows: 'to',
                smooth: from < to ? false : { type: 'curvedCCW', roundness: 0.8 }
            });
        }
        }
        dfaNetwork.setData(dfaData);
        updateStepCounter();
        if (currentStep < dfaSteps.length) {
            document.getElementById('next-step-btn').disabled = false;
        }
        document.getElementById('prev-step-btn').disabled = currentStep === 0;
    }
}

// Reset playback
function resetPlayback() {
    dfaData.nodes = [];
    dfaData.edges = [];
    dfaNetwork.setData(dfaData);
    currentStep = 0;
    document.getElementById('next-step-btn').disabled = false;
    document.getElementById('prev-step-btn').disabled = true;
    updateStepCounter();
}

// Update step counter
function updateStepCounter() {
    document.getElementById('step-counter').textContent = `Step ${currentStep} of ${dfaSteps.length}`;
}

// Display NFA transition table
function displayNFATable(transitions) {
    const tbody = document.querySelector('#nfa-table tbody');
    tbody.innerHTML = '';
    for (const state in transitions) {
        for (const symbol in transitions[state]) {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${state}</td><td>${symbol === 'e' ? 'ε' : symbol}</td><td>${transitions[state][symbol].join(', ')}</td>`;
            tbody.appendChild(row);
        }
    }
}

// Visualize complete DFA
function visualizeCompleteDFA(transitions, dfaStates, stateMap) {
    completeDfaData.nodes = [];
    completeDfaData.edges = [];
    for (const subset of dfaStates) {
        const dfaState = stateMap[subset];
        completeDfaData.nodes.push({
            id: dfaState,
            label: `{${dfaState}}`,
            color: '#97c2fc',
            shape: 'circle',
            borderWidth: subset.split(',').some(s => finalStates.includes(s)) ? 3 : 1
        });
    }
    const edgeMap = {};
    for (const state in transitions) {
        for (const symbol in transitions[state]) {
            const next = transitions[state][symbol];
            const key = `${state}-${next}`;
            if (!edgeMap[key]) edgeMap[key] = [];
            edgeMap[key].push(symbol);
        }
    }
        for (const key in edgeMap) {
            const [from, to] = key.split('-');
            const labels = edgeMap[key].sort().join(',');
            completeDfaData.edges.push({
                from: from,
                to: to,
                label: labels,
                arrows: 'to',
                smooth: from < to ? false : { type: 'curvedCCW', roundness: 0.8 }
            });
        }
    completeDfaNetwork.setData(completeDfaData);
}

// Display DFA transition table
function displayDFATable(transitions, dfaStates) {
    const tbody = document.querySelector('#dfa-table tbody');
    tbody.innerHTML = '';
    for (const state of dfaStates) {
        for (const symbol of alphabet) {
            const nextState = transitions[state] ? transitions[state][symbol] || '-' : '-';
            const row = document.createElement('tr');
            row.innerHTML = `<td>{${state}}</td><td>${symbol}</td><td>${nextState === '-' ? '-' : `{${nextState}}`}</td>`;
            tbody.appendChild(row);
        }
    }
}
