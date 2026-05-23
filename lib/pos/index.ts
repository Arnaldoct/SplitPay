/**
 * POS Adapters - Public API
 * 
 * This module provides POS integration through a pluggable adapter pattern.
 * Each POS system implements the POSAdapter interface.
 */

export * from "./adapter";
export * from "./manual-adapter";
export * from "./square-adapter";
export * from "./factory";
