/**
 * Type declarations for umap-js
 */
declare module 'umap-js' {
    export type DistanceFn = (x: number[], y: number[]) => number;
    export type RandomFn = () => number;
    export type Vector = number[];
    export type Vectors = Vector[];

    export interface UMAPParameters {
        distanceFn?: DistanceFn;
        learningRate?: number;
        localConnectivity?: number;
        minDist?: number;
        nComponents?: number;
        nEpochs?: number;
        nNeighbors?: number;
        negativeSampleRate?: number;
        random?: RandomFn;
        repulsionStrength?: number;
        setOpMixRatio?: number;
        spread?: number;
        transformQueueSize?: number;
    }

    export class UMAP {
        constructor(params?: UMAPParameters);
        fit(X: number[][]): number[][];
        fitAsync(X: number[][], callback?: (epochNumber: number) => boolean | void): Promise<number[][]>;
        transform(X: number[][]): number[][];
        initializeFit(X: number[][]): void;
        step(): number;
        getEmbedding(): number[][];
        setEpochCallbacks(epochCallbacks: ((epochNumber: number) => boolean | void)[]): void;
    }

    export interface UMAPSupervisedParams extends UMAPParameters {
        targetMetric?: 'categorical' | 'l1' | 'l2';
        targetWeight?: number;
        targetNNeighbors?: number;
    }
}
