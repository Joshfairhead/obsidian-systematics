import { GraphGeometry, Vertex, Edge } from './types';

/**
 * Generates all edges for a complete graph Kn
 */
function generateCompleteGraphEdges(n: number): Edge[] {
    const edges: Edge[] = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            edges.push({ from: i, to: j });
        }
    }
    return edges;
}

/**
 * K3 - Triangle
 */
export const K3: GraphGeometry = {
    name: "K3",
    order: 3,
    vertices: [
        { index: 0, label: "Will", x: 0.0, y: 1.0 },
        { index: 1, label: "Function", x: 0.0, y: -1.0 },
        { index: 2, label: "Being", x: 1.0, y: 0.0 }
    ],
    edges: generateCompleteGraphEdges(3)
};

/**
 * K4 - Tetrahedron (2D projection)
 */
export const K4: GraphGeometry = {
    name: "K4",
    order: 4,
    vertices: [
        { index: 0, label: "Ideal", x: 0.0, y: 1.0 },
        { index: 1, label: "Directive", x: 1.0, y: 0.0 },
        { index: 2, label: "Instrumental", x: -1.0, y: 0.0 },
        { index: 3, label: "Ground", x: 0.0, y: -1.0 }
    ],
    edges: generateCompleteGraphEdges(4)
};

/**
 * K5 - Pentagon
 */
export const K5: GraphGeometry = {
    name: "K5",
    order: 5,
    vertices: [
        { index: 0, label: "Purpose", x: 1.0, y: 1.0 },
        { index: 1, label: "Higher Potential", x: 0.5, y: 0.5 },
        { index: 2, label: "Quintessence", x: -1.0, y: 0.0 },
        { index: 3, label: "Lower Potential", x: 0.5, y: -0.5 },
        { index: 4, label: "Source", x: 1.0, y: -1.0 }
    ],
    edges: generateCompleteGraphEdges(5)
};

/**
 * K6 - Hexagon
 */
export const K6: GraphGeometry = {
    name: "K6",
    order: 6,
    vertices: [
        { index: 0, label: "Top left", x: -0.5, y: 0.86602540378 },
        { index: 1, label: "Top tip", x: 0.0, y: 1.0 },
        { index: 2, label: "Top right", x: 0.5, y: 0.86602540378 },
        { index: 3, label: "Bottom right", x: 1.0, y: 0.0 },
        { index: 4, label: "Bottom", x: 0.0, y: -1.0 },
        { index: 5, label: "Bottom left", x: -1.0, y: 0.0 }
    ],
    edges: generateCompleteGraphEdges(6)
};

/**
 * K7 - Heptagon
 */
export const K7: GraphGeometry = {
    name: "K7",
    order: 7,
    vertices: [
        { index: 0, label: "Insight", x: 0.0, y: 1.0 },
        { index: 1, label: "Research", x: 0.781831, y: 0.623489 },
        { index: 2, label: "Design", x: 0.974370, y: -0.222521 },
        { index: 3, label: "Synthesis", x: 0.433884, y: -0.900969 },
        { index: 4, label: "Application", x: -0.433884, y: -0.900969 },
        { index: 5, label: "Delivery", x: -0.974370, y: -0.222521 },
        { index: 6, label: "Value", x: -0.781831, y: 0.623489 }
    ],
    edges: generateCompleteGraphEdges(7)
};

/**
 * K8 - Octagon
 */
export const K8: GraphGeometry = {
    name: "K8",
    order: 8,
    vertices: [
        { index: 0, label: "Smallest Significant Holon", x: 1.0, y: 0.0 },
        { index: 1, label: "Critical Functions", x: 0.707, y: -0.707 },
        { index: 2, label: "Supportive Platform", x: 0.0, y: -1.0 },
        { index: 3, label: "Necessary Resourcing", x: -0.707, y: -0.707 },
        { index: 4, label: "Integrative Totality", x: -1.0, y: 0.0 },
        { index: 5, label: "Inherent Values", x: -0.707, y: 0.707 },
        { index: 6, label: "Intrinsic Nature", x: 0.0, y: 1.0 },
        { index: 7, label: "Organisational Modes", x: 0.707, y: 0.707 }
    ],
    edges: generateCompleteGraphEdges(8)
};

/**
 * K9 - Nonagon
 */
export const K9: GraphGeometry = {
    name: "K9",
    order: 9,
    vertices: [
        { index: 0, label: "top-right", x: 0.64278760968, y: 0.76604444311 },
        { index: 1, label: "right", x: 0.98480775301, y: 0.17364817767 },
        { index: 2, label: "bottom-right", x: 0.86602540378, y: -0.5 },
        { index: 3, label: "bottom", x: 0.34202014333, y: -0.93969262079 },
        { index: 4, label: "bottom-left", x: -0.34202014333, y: -0.93969262079 },
        { index: 5, label: "left", x: -0.86602540378, y: -0.5 },
        { index: 6, label: "top-left", x: -0.98480775301, y: 0.17364817767 },
        { index: 7, label: "top-left-2", x: -0.64278760968, y: 0.76604444311 },
        { index: 8, label: "top", x: 0.0, y: 1.0 }
    ],
    edges: generateCompleteGraphEdges(9)
};

/**
 * K10 - Decagon
 */
export const K10: GraphGeometry = {
    name: "K10",
    order: 10,
    vertices: [
        { index: 0, label: "Node 0", x: 0.0, y: 1.0 },
        { index: 1, label: "Node 1", x: 0.58778525229, y: 0.80901699437 },
        { index: 2, label: "Node 2", x: 0.95105651630, y: 0.30901699437 },
        { index: 3, label: "Node 3", x: 0.95105651630, y: -0.30901699437 },
        { index: 4, label: "Node 4", x: 0.58778525229, y: -0.80901699437 },
        { index: 5, label: "Node 5", x: 0.0, y: -1.0 },
        { index: 6, label: "Node 6", x: -0.58778525229, y: -0.80901699437 },
        { index: 7, label: "Node 7", x: -0.95105651630, y: -0.30901699437 },
        { index: 8, label: "Node 8", x: -0.95105651630, y: 0.30901699437 },
        { index: 9, label: "Node 9", x: -0.58778525229, y: 0.80901699437 }
    ],
    edges: generateCompleteGraphEdges(10)
};

/**
 * K11 - Hendecagon
 */
export const K11: GraphGeometry = {
    name: "K11",
    order: 11,
    vertices: [
        { index: 0, label: "Node 0", x: 0.0, y: 1.0 },
        { index: 1, label: "Node 1", x: 0.54064081745, y: 0.84125353283 },
        { index: 2, label: "Node 2", x: 0.909632, y: 0.415415 },
        { index: 3, label: "Node 3", x: 0.989821, y: -0.142315 },
        { index: 4, label: "Node 4", x: 0.755750, y: -0.654861 },
        { index: 5, label: "Node 5", x: 0.281733, y: -0.959493 },
        { index: 6, label: "Node 6", x: -0.281733, y: -0.959493 },
        { index: 7, label: "Node 7", x: -0.755750, y: -0.654861 },
        { index: 8, label: "Node 8", x: -0.989821, y: -0.142315 },
        { index: 9, label: "Node 9", x: -0.909632, y: 0.415415 },
        { index: 10, label: "Node 10", x: -0.54064081745, y: 0.84125353283 }
    ],
    edges: generateCompleteGraphEdges(11)
};

/**
 * K12 - Dodecagon
 */
export const K12: GraphGeometry = {
    name: "K12",
    order: 12,
    vertices: [
        { index: 0, label: "Node 0", x: 0.0, y: 1.0 },
        { index: 1, label: "Node 1", x: 0.5, y: 0.86602540378 },
        { index: 2, label: "Node 2", x: 0.86602540378, y: 0.5 },
        { index: 3, label: "Node 3", x: 1.0, y: 0.0 },
        { index: 4, label: "Node 4", x: 0.86602540378, y: -0.5 },
        { index: 5, label: "Node 5", x: 0.5, y: -0.86602540378 },
        { index: 6, label: "Node 6", x: 0.0, y: -1.0 },
        { index: 7, label: "Node 7", x: -0.5, y: -0.86602540378 },
        { index: 8, label: "Node 8", x: -0.86602540378, y: -0.5 },
        { index: 9, label: "Node 9", x: -1.0, y: 0.0 },
        { index: 10, label: "Node 10", x: -0.86602540378, y: 0.5 },
        { index: 11, label: "Node 11", x: -0.5, y: 0.86602540378 }
    ],
    edges: generateCompleteGraphEdges(12)
};

/**
 * Map of all available graphs
 */
export const GRAPHS: { [key: number]: GraphGeometry } = {
    3: K3,
    4: K4,
    5: K5,
    6: K6,
    7: K7,
    8: K8,
    9: K9,
    10: K10,
    11: K11,
    12: K12
};
