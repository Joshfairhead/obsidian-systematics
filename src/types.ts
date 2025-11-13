/**
 * Represents a vertex in a graph
 */
export interface Vertex {
    index: number;
    label: string;
    x: number;
    y: number;
    z?: number;
    noteFile?: string; // Path to the linked note
}

/**
 * Represents an edge connecting two vertices
 */
export interface Edge {
    from: number;
    to: number;
}

/**
 * Represents a complete graph (Kn)
 */
export interface GraphGeometry {
    name: string;
    order: number; // The 'n' in Kn
    vertices: Vertex[];
    edges: Edge[];
}

/**
 * Settings for node labeling in the graph view
 */
export interface NodeLabelSettings {
    [nodeIndex: number]: {
        label: string;
        noteFile: string;
        labelOffsetX?: number; // Custom X offset for label position
        labelOffsetY?: number; // Custom Y offset for label position
    };
}

/**
 * Plugin settings structure
 */
export interface SystematicsSettings {
    currentGraph: number; // Which Kn graph is currently selected (3-12)
    nodeLabelSettings: { [graphKey: string]: NodeLabelSettings };
}
