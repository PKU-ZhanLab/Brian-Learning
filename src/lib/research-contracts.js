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
 *
 * @template T
 * @typedef {{state:'reported',value:T,sourceRefs:string[]}|{state:'not-reported'|'not-extracted'|'uncertain'|'not-applicable',reason:string,sourceRefs:string[]}} Reported
 *
 * @typedef {{zh:string,en:string}} BiText
 * @typedef {{enrolled:Reported<number>,included:Reported<number>,perAnalysis:Reported<number>}} EvidenceSample
 * @typedef {{id:string,referenceId:string,task:BiText|string,species:string,sample:EvidenceSample,modalities:string[],sourceRefs:string[]}} Experiment
 * @typedef {{type:string,value:number,df:number|number[]|null,unit:string,p:{operator:'='|'<'|'>',value:number}|null,sourceRefs:string[]}} ReportedStatistic
 * @typedef {{type:string,value:number,unit:string,variance:Reported<number>,interval:Reported<{level:number,lower:number,upper:number,unit:string}>}} EffectEstimate
 * @typedef {{method:string,comparisonFamily:string,passed:boolean|null,threshold:{operator:string,value:number}}} Correction
 * @typedef {{id:string,referenceId?:string,experimentId:string|null,contrast:BiText|string,finding:BiText|string,modalities:string[],sample?:EvidenceSample,statistics:Reported<ReportedStatistic[]>,effectEstimate:Reported<EffectEstimate>,correction:Reported<Correction>,timeWindow:Reported<{start:number,end:number,unit:'ms'}>,frequencyBand:Reported<{min:number,max:number,unit:'Hz'}>,locationIds:string[],claimIds:string[],limitations:BiText[],recordVersion?:string,legacyV1?:Object}} EvidenceResult
 * @typedef {{kind:'sd'|'se'|'ci'|'localization-error'|'not-reported'|'unknown',unit:'mm',value?:number|number[],reason?:string,sourceRefs:string[]}} LocationUncertainty
 * @typedef {{id:string,resultId:string,kind:string,sourceLabel:string|BiText,sourceSpaceId:string,xyz:[number,number,number],unit:'mm',uncertainty:LocationUncertainty,sourceRefs:string[],derivedAsset:AssetIdentity|null,transformRef:string|null,dispersion?:Reported<{kind:string,value:number[],unit:'mm',scope:string}>,recordVersion?:string,legacyV1?:Object}} EvidenceLocation
 * @typedef {{id:string,referenceId:string,experimentId:string|null,resultId:string|null,text:BiText|string,sourceRefs:string[],limitations:BiText[]}} Claim
 * @typedef {{id:string,referenceId:string,resultSummaries:BiText,methodProvenance:Object,limitations:BiText,claimIds:string[],legacyV1?:Object}} Reading
 * @typedef {{id:string,subjectId:string,stage:'extracted'|'source-checked'|'space-checked'|'human-reviewed',actorType:'ai'|'human'|'unknown',actorName:string,date:string|null,scope:string,sourceRefs:string[],limitations:BiText[],recordVersion:string}} ReviewEvent
 * @typedef {{extracted:boolean,sourceChecked:boolean,spaceChecked:boolean,humanReviewed:boolean,events:ReviewEvent[],limitations:BiText[]}} ReviewState
 * @typedef {{schema:'brain-evidence-v2',dataVersion:string,references:Object[],readings:Reading[],experiments:Experiment[],results:EvidenceResult[],locations:EvidenceLocation[],claims:Claim[],mappings:Object[],sourceArtifacts:Object[],reviewEvents:ReviewEvent[],relations:Object[],legacyV1?:Object}} EvidenceBundleV2
 * @typedef {{valid:boolean,errors:string[],warnings:string[],value:EvidenceBundleV2|null}} ValidationReport
 * @typedef {{valid:boolean,errors:string[]}} IntegrityReport
 * @typedef {{id:string,referenceId:string|null,finding:BiText|string,condition:BiText|string,sample:BiText|string,roiDefinition:BiText|string,direction:BiText|string,modalities:string[],topics:string[],coordinates:Object[],regionIds:string[],figures:Object[],sourceUrl:string,limitations:BiText|string,reviewState:ReviewState}} ResultViewModel
 *
 * Evidence runtime validation and all v1 migration belong to evidence-schema.js.
 * legacyV1 stores the source without normalization; it does not grant spatial
 * identity or review. Sample SD and coordinate dispersion are not localization
 * error. Review stages are independent and apply only to the named subject and
 * record version. Metadata-only bibliography verification is not a review stage.
 */

export {};
