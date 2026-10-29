/**
 * Shared research contracts. Import these JSDoc types instead of defining
 * competing shapes in spatial, evidence, project or presentation modules.
 * Runtime validation belongs to each owning module; this file adds no coercion.
 *
 * @typedef {'L'|'R'|'M'|'B'|'U'} Hemisphere
 * L/R = left/right, M = midline, B = explicitly bilateral, U = unknown.
 * Hemisphere comes from source label metadata, never a click or catalog order.
 *
 * @typedef {Object} AtlasRegionRef
 * @property {string} atlasId
 * @property {string} atlasVersion Verified version, or sha256:<artifact digest>.
 * @property {number} labelId Original discrete label ID, not an array index.
 * @property {Hemisphere} hemisphere
 * @property {string} spaceId Explicit source space; no implicit MNI default.
 *
 * @typedef {Object} AssetIdentity
 * @property {string} id
 * @property {string} version
 * @property {string} sha256 SHA-256 of the actual asset bytes, not its URL.
 * @property {string|null} spaceId Null preserves unknown space without granting
 * eligibility for common-space comparison or overlay.
 *
 * @typedef {Object} QueryContext
 * @property {string} atlasId
 * @property {string} atlasVersion
 * @property {[number,number,number]} coordinate
 * @property {string} method
 * @property {number} requestId Request generation; results require the same context.
 *
 * @typedef {Object} GridSpec
 * @property {[number,number,number]} shape
 * @property {number[]} affine Row-major 4 by 4 voxel-to-world affine (16 values).
 * @property {string} space Explicitly corresponds to AssetIdentity.spaceId.
 * @property {'x-fastest'|'z-fastest'} order
 *
 * @typedef {Object} TransformIdentity
 * @property {string} id
 * @property {string} sha256
 *
 * @typedef {Object} ComputationThreshold
 * @property {string} kind
 * @property {number} threshold
 * @property {string} tail
 *
 * @typedef {Object} ComputationManifest
 * @property {string} appVersion
 * @property {string} algorithmVersion
 * @property {AssetIdentity[]} inputs Ordered A/B inputs; preserve input order.
 * @property {TransformIdentity[]} transforms Ordered transform chain.
 * @property {GridSpec[]} sourceGrids
 * @property {GridSpec} targetGrid
 * @property {string[]} interpolation
 * @property {ComputationThreshold[]} thresholds
 * @property {number[][]} labelSets Ordered by A/B input; labels within each set
 * may be sorted and deduplicated without changing the operand order.
 *
 * @typedef {Object} ResultLayerStyle
 * @property {string} color Strict #RRGGBB; no free text or executable styles.
 * @property {number} opacity Inclusive range 0..1.
 * @property {number} size Inclusive range 1..20.
 *
 * @typedef {Object} ResultLayer
 * @property {string} layerId
 * @property {string} resultId
 * @property {string[]} coordinateIds Stable evidence location IDs, not copied coordinates.
 * @property {string} sourceReferenceId
 * @property {string} spaceId
 * @property {boolean} visible
 * @property {ResultLayerStyle} style
 *
 * @typedef {Object} DraftRecord
 * @property {string} id
 * @property {string} projectId
 * @property {string} kind
 * @property {string|null} recordId Existing record ID, or null for a new record.
 * @property {Object<string,unknown>} payload Incomplete editing fields. Maximum
 * serialized payload size is 50,000 UTF-8 bytes, without truncation.
 * @property {string} updatedAt ISO 8601 timestamp.
 *
 * Draft collections contain at most 30 records and their complete JSON encoding
 * is at most 1 MiB (1,048,576 UTF-8 bytes). Oversized edits remain in memory and
 * must show unsaved state. W2 alone persists drafts in the project envelope;
 * project v1 migration starts with []; public links exclude all drafts. A draft
 * does not grant result completeness, source verification or review status.
 */

export {};
