import { z } from "zod";
const CoordinatesSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
});
/** Validates a single UnindexedFeature record. Requires an id, title, and either a geocodable address or coordinates. */
export const UnindexedFeatureSchema = z
    .object({
    id: z.string().min(1),
    title: z.string().min(1),
    topic: z.string().min(1),
    address: z.string().min(1).optional(),
    coordinates: CoordinatesSchema.optional(),
    synopsisCardHtml: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
})
    .refine((feature) => Boolean(feature.address) || Boolean(feature.coordinates), {
    message: "feature must have an address or coordinates",
});
/**
 * Normalizes a raw payload (a single record or an array of records) into valid UnindexedFeatures,
 * silently dropping any record that is malformed, corrupted, or missing a required field.
 */
export function normalizePayload(payload) {
    const records = Array.isArray(payload) ? payload : [payload];
    const features = [];
    for (const record of records) {
        const result = UnindexedFeatureSchema.safeParse(record);
        if (result.success) {
            features.push(result.data);
        }
    }
    return features;
}
