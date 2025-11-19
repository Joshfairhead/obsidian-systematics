/**
 * Projection Engine - Projects high-dimensional embeddings to 2D using UMAP
 */

import { UMAP } from 'umap-js';
import { Point2D } from './semanticTypes';

export class ProjectionEngine {
    private umap: UMAP;
    private fitted: boolean = false;

    constructor() {
        // Configure UMAP for visualization
        this.umap = new UMAP({
            nComponents: 2,        // Output 2D
            nNeighbors: 15,        // Local structure preservation
            minDist: 0.1,          // Minimum distance between points
            spread: 1.0,           // Spread of points in embedded space
            random: () => Math.random()  // Deterministic if needed
        });
    }

    /**
     * Project embeddings to 2D space
     * @param embeddings Array of high-dimensional vectors
     * @param labels Optional labels for the points
     * @returns Array of 2D points
     */
    async project2D(
        embeddings: number[][],
        labels?: string[]
    ): Promise<Point2D[]> {
        if (embeddings.length === 0) {
            return [];
        }

        // Single point - place at origin
        if (embeddings.length === 1) {
            return [{
                x: 0,
                y: 0,
                label: labels?.[0] || 'point-0'
            }];
        }

        try {
            // Fit UMAP and transform embeddings
            const projected = this.umap.fit(embeddings);

            // Normalize to reasonable range (-1 to 1)
            const normalized = this.normalize2D(projected);

            // Convert to Point2D objects
            return normalized.map((coords, i) => ({
                x: coords[0],
                y: coords[1],
                label: labels?.[i] || `point-${i}`
            }));
        } catch (error) {
            console.error('UMAP projection failed:', error);
            // Fallback to simple circular layout
            return this.fallbackCircularLayout(embeddings.length, labels);
        }
    }

    /**
     * Normalize 2D coordinates to [-1, 1] range
     */
    private normalize2D(points: number[][]): number[][] {
        if (points.length === 0) return [];

        // Find min/max for each dimension
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const [x, y] of points) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;

        // Normalize to [-1, 1]
        return points.map(([x, y]) => [
            2 * (x - minX) / rangeX - 1,
            2 * (y - minY) / rangeY - 1
        ]);
    }

    /**
     * Fallback circular layout if UMAP fails
     */
    private fallbackCircularLayout(count: number, labels?: string[]): Point2D[] {
        const points: Point2D[] = [];
        const angleStep = (2 * Math.PI) / count;

        for (let i = 0; i < count; i++) {
            const angle = i * angleStep;
            points.push({
                x: Math.cos(angle) * 0.8,
                y: Math.sin(angle) * 0.8,
                label: labels?.[i] || `point-${i}`
            });
        }

        return points;
    }

    /**
     * Project embeddings with center point at origin
     * Useful for monad visualization where query is center
     */
    async projectWithCenter(
        centerEmbedding: number[],
        otherEmbeddings: number[][],
        labels?: string[]
    ): Promise<{ center: Point2D; others: Point2D[] }> {
        // Combine all embeddings for projection
        const allEmbeddings = [centerEmbedding, ...otherEmbeddings];
        const allLabels = ['center', ...(labels || [])];

        const projected = await this.project2D(allEmbeddings, allLabels);

        // Translate so center is at origin
        const center = projected[0];
        const dx = center.x;
        const dy = center.y;

        const translatedOthers = projected.slice(1).map(p => ({
            x: p.x - dx,
            y: p.y - dy,
            label: p.label
        }));

        return {
            center: { x: 0, y: 0, label: 'center' },
            others: translatedOthers
        };
    }

    /**
     * Calculate 2D distance between two points
     */
    static distance2D(p1: Point2D, p2: Point2D): number {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Scale points to fit within a circle of given radius
     */
    static scaleToRadius(points: Point2D[], radius: number): Point2D[] {
        if (points.length === 0) return [];

        // Find maximum distance from origin
        let maxDist = 0;
        for (const p of points) {
            const dist = Math.sqrt(p.x * p.x + p.y * p.y);
            if (dist > maxDist) maxDist = dist;
        }

        if (maxDist === 0) return points;

        // Scale to fit within radius
        const scale = radius / maxDist;

        return points.map(p => ({
            ...p,
            x: p.x * scale,
            y: p.y * scale
        }));
    }

    /**
     * Convert normalized coordinates to canvas coordinates
     */
    static toCanvasCoords(
        point: Point2D,
        centerX: number,
        centerY: number,
        radius: number
    ): { x: number; y: number } {
        return {
            x: centerX + point.x * radius,
            y: centerY + point.y * radius
        };
    }
}
