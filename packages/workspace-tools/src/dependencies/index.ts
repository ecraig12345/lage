import { getTransitiveConsumers, getTransitiveProviders } from "./transitiveDeps.js";
import { getPackageDependencies } from "../graph/getPackageDependencies.js";

// Some deprecated functions below for backwards compatibility

export const getTransitiveDependencies = getTransitiveProviders;

export { getTransitiveProviders };

export const getTransitiveDependents = getTransitiveConsumers;

export { getTransitiveConsumers };

/** @deprecated Do not use */
export const getInternalDeps = getPackageDependencies;
