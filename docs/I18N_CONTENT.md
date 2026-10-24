# Bilingual content

Chinese remains the canonical source in `src/data`. English translations are stored in `src/i18n` and selected at display time.

| Export | Purpose |
| --- | --- |
| `localizeStructure(structure, language)` | Name, anatomy, function, cognition, clinical relevance, aliases, atlas notes, status, and nested evidence |
| `localizeReference(reference, language)` | Reference summary and Chinese method, evidence-role, and verification notes |
| `localizeEvidence(entry, structureId, language)` | Claim text, scope limits, evidence gaps, and verification scope |
| `localizeEvidenceItem(item, language)` | A single claim, including atlas-methodology claims |
| `untranslatedEvidenceStrings(entries, atlasEntries)` | Reports source strings missing from the English evidence dictionaries |

Use `language="en"` for English; other values preserve the original Chinese objects. IDs, reference links, coordinates, evidence levels, dates, and study assignments remain unchanged. Search can retain the original catalog as well as localized display content.

`DataProvenance`, `GeometryProvenance`, `ClaimEvidence`, `EvidenceOverview`, `AtlasLegend`, and `SliceViews` accept `language="zh"` by default. `alignmentLabel(value, language)` follows the same convention.

Translations cover the current 188 structures and 105 references, including evidence claims, scope limits, gaps, and atlas-methodology entries. The English version retains species, hemisphere, task, atlas-boundary, registration, and clinical limitations. Translation does not add scientific validation or human full-text certification.

When source text changes, update its translation and check both languages. In particular, do not replace a region-specific limitation with a generic statement or infer missing evidence from a translated structure description.
