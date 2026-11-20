# X7 actual desktop acceptance

Checkout: `F:/project/brain-model/.worktrees/research-20261029`.
Builds: initial `05c7306`, toolbar/context correction `027d38e`, compact reading correction `1657b5f`. Each immutable preview has an output/x7-cua/*-build-receipt.json. Only task synthetic projects were imported under the user's explicit localhost authorization. No real research files were used.

## Verified observations

- At 390 px the original display-settings section was hidden. The new settings drawer exposes the shared opacity and switches, restore-hidden action, close action and keyboard focus. See display-settings-390-baseline.json and drawer-390-initial.json. Shared changes and restoration were exercised via real controls.
- Initial 1366×768 control-center hit tests identified clipped model actions. The corrected controls were retested at 1366×768 and 683×384: seven action centers hit their own controls, with 40 px targets; reflow screenshots are preserved. This is sampled target geometry, not a claim of human touch testing.
- Atlas and method context is available by keyboard in the model disclosure. Actual DK and registered AAL ribbon observations retain reference, spatial relationship, version and ribbon-sampling distinction in provenance-observations.json. An unverified native AAL project correctly falls back to usable DK under the existing spatial guard; the prior authored native-context expectations must be corrected rather than weakening the guard.
- At 1366×768 the two expanded result layers consumed 236 px and left 273 px of reading panel; the compact default gives approximately 468 px. Explicitly expanded state survived narrowing/widening, and explicitly closed state survived a subsequent resize. reading-chrome-before.json and reading-compact-final.png retain the observations.
- Long synthetic limitation text was actually scrolled to its tail at 1366, 650 and 390 px; corresponding long-tail screenshots are preserved. At 390 the document/client width is 375 px, with no horizontal overflow in the exercised normal layout. At 683×384 reflow there was no global horizontal overflow.
- Sampled computed text styles and their ancestor backgrounds are in style-samples-fixed.json; derived WCAG contrast calculations are in style-contrast-fixed.json. These samples are not an exhaustive accessibility audit.

## Corrected short-viewport comparison gate

At 683×384, the initial long-title sticky comparison header was 404.38 px tall inside a matrix with 224 px client height. After inner scrolling, the first body-cell center was still covered by THEAD. comparison-short-blocked.json/png proves the defect. On reviewed e531eb1, the same admitted compare-long.neuroatlas fixture has a 62.59 px header. The first body-cell center hits TBODY, and after 111.52 px inner scrolling the ROI-definition cell also hits TBODY rather than THEAD. comparison-short-fixed.json/png retain the GREEN. Both full titles were opened with Enter on the new header buttons and the explicit Back to comparison path; full-title-keyboard.json records exact titles.

Four actual atlas open/resize/close cycles on e531eb1 at 650/390/1366/683 widths returned focus to Atlas labels and produced zero current-build error logs. explorer-resize-close.json preserves the five old 4211 ResizeObserver failures separately; these were not deleted or presented as current errors.

## Explicit limits

Native zoom shortcuts did not change browser metrics. The 683×384 run proves reflow at that CSS viewport, not actual 200% zoom. Native file-picker cancellation, screen-reader output, actual touch/color-vision users and independent scientific review are not claimed. Authored isolated E2E cases remain unrun until the CI environment is available. Historical ResizeObserver close errors now have both the pure lifecycle guard regression and the bounded actual lifecycle retest above; no exhaustive browser-error claim is made.
