# Regulatory Mapping

This document maps the regulations and authoritative reference tables used by the repository to the code that implements them. It is deliberately literal: when the code only approximates a regulation or leaves part of it unimplemented, that is stated directly.

Related documents:

- [docs/ARCHITECTURE_AND_DECISIONS.md](./ARCHITECTURE_AND_DECISIONS.md)
- [docs/GOVERNMENT_WARNING.md](./GOVERNMENT_WARNING.md)
- [docs/EVAL_RESULTS.md](./EVAL_RESULTS.md)

## How To Read This Map

Each entry answers four questions:

1. Which regulation or authority is being referenced?
2. Where is the implementation seam?
3. What does the code actually check?
4. What is a representative example?

The repository uses two different implementation patterns:

- **direct rule functions** for deterministic checks
- **taxonomy/reference tables** for equivalence and normalization

The repo does **not** currently ship numeric TTB product-code or origin-code lookup tables. It ships text-based equivalence tables and canonicalization helpers instead.

## 27 CFR Part 16: Government Warning

| Regulation | Code location | What it checks | Worked example | Status |
| --- | --- | --- | --- | --- |
| 27 CFR 16.21 canonical warning text | `src/shared/contracts/review-base.ts:380` (`CANONICAL_GOVERNMENT_WARNING`) | Hard-codes the required warning text used by the validator and diff view | label text must match the statutory sentence sequence, not a paraphrase | implemented |
| 27 CFR 16.21 exact-text validation | `src/server/government-warning-validator.ts:44` (`buildGovernmentWarningCheck`) | Compares extracted warning text to the canonical text and builds the final warning check | title-case `Government Warning` with punctuation drift can still be surfaced as a warning defect | implemented |
| 27 CFR 16.21 critical-word safety gate | `src/server/government-warning-validator.ts:139` and `src/server/government-warning-verification.ts:59` (`CRITICAL_WARNING_WORDS`) | If critical terms are absent, the validator refuses to treat the warning as clean | missing `pregnancy` or `birth defects` prevents a clean pass | implemented, conservative |
| 27 CFR 16.22 formatting and legibility | `src/server/government-warning-subchecks.ts:12` onward | Renders the five shipped warning sub-checks: presence, exact text, uppercase/bold heading, continuous paragraph, legibility/separation | heading present but body formatting unclear -> `review` | partially implemented through five UI sub-checks |
| 27 CFR 16.22 confidence thresholds | `src/server/government-warning-subchecks.ts:7` and `src/server/government-warning-vote.ts:19` | Distinguishes pass/review/fail with similarity and confidence bands | OCR or OCV similarity of `0.92` stays in `review`; `0.93` becomes `pass` | implemented |
| 27 CFR Part 16 multi-signal stability | `src/server/government-warning-vote.ts:23` (`buildWarningResult`) | Computes a 2-of-3 vote across VLM, cropped OCV, and full-image OCR | one noisy VLM read cannot single-handedly flip a label | implemented |
| 27 CFR 16.21 visual verification helper | `src/server/government-warning-verification.ts:44` | Treats warning OCV as verification of known text, not extraction of unknown text | bottom-band crop verifies a correct warning without trusting a full-page OCR transcription | implemented |
| 27 CFR 16.22 layout-specific wording in UI contract | `src/shared/contracts/review-base.ts:52` (`WARNING_SUB_CHECK_IDS`) | Locks the rendered warning evidence contract to five sub-check IDs | the UI always renders the same five rows regardless of internal signal complexity | implemented |
| 27 CFR 16.22 physical text-size requirement | no runtime implementation | The code does not currently measure font size against container size | 50mL vs 3L warning minimum text size is not computed | not implemented |
| 27 CFR 16.32 appended state warnings | no explicit runtime rule | The warning text checker tolerates extra trailing text in some paths but does not separately certify state-warning compliance | canonical warning plus extra state-specific language may still pass | partially implemented, not isolated as a dedicated rule |

See [docs/GOVERNMENT_WARNING.md](./GOVERNMENT_WARNING.md) for the full deep dive.

## 27 CFR Part 5: Distilled Spirits Labeling

| Regulation | Code location | What it checks | Worked example | Status |
| --- | --- | --- | --- | --- |
| 27 CFR 5.61 mandatory label information | `src/server/review-report-helpers.ts:20`; `src/server/review-report-cross-field.ts:56` (`buildSpiritsSameFieldOfVisionCheck`) | Supplies distilled-spirits citations for major fields and powers the optional same-field-of-vision review | brand, class/type, and ABV must share the primary panel on a spirits label | implemented as citation + optional colocated-panel check |
| 27 CFR 5.61 same field of vision | `src/server/spirits-colocation-check.ts:7` and `src/server/review-report-cross-field.ts:56` | Uses a focused Gemini call to ask whether brand, class/type, and alcohol content are on the same panel | a front label with brand only and ABV on the back should surface for review | implemented as optional review-only check |
| 27 CFR 5.63 name/address of bottler or importer | `src/server/review-prompt-policy.ts:52`; `src/server/review-extractor-guardrails.ts:171`; `src/server/judgment-field-rules-secondary.ts:62` (`judgeApplicantAddress`) | Narrows applicant-address extraction to postal address semantics and compares with token overlap, never hard reject | website URL extracted into address slot is scrubbed before judgment | implemented conservatively |
| 27 CFR 5.63 country / origin context for imports | `src/server/judgment-field-rules-secondary.ts:155` (`judgeCountryOfOrigin`) and `src/server/taxonomy/geography.ts:27` / `:237` | Matches sovereign names, aliases, and subdivisions | `USA` on the form vs `California` on the label -> approve | implemented |
| 27 CFR 5.37 alcohol statement tolerances | `src/server/judgment-field-rules.ts:40` (`judgeAlcoholContent`) | Parses proof and percent formats and rejects clear mismatches; includes explicit 14/21/24 wine-tax boundary logic | `40% Alc./Vol.` vs `46%` -> reject | partially implemented, tolerance math simplified relative to the regulation |
| 27 CFR 5.22 standards of identity | `src/server/taxonomy/distilled-spirits.ts:1`, `:24`, `:142`, `:167` | Maps spirits classes and spelling variants such as whisky/whiskey | `bourbon` on the label counts as a whisky-family class | implemented |

### Notes on Part 5 fidelity

- The repo cites Part 5 and encodes many spirits classes well.
- The alcohol-tolerance logic is a simplified operational rule, not a verbatim implementation of every threshold in `27 CFR 5.37`.
- The same-field-of-vision check is review-oriented and model-assisted, not a fully deterministic geometric layout engine.

## 27 CFR Part 4: Wine Labeling

| Regulation | Code location | What it checks | Worked example | Status |
| --- | --- | --- | --- | --- |
| 27 CFR 4.32 mandatory wine label information | `src/server/review-report-helpers.ts:25` | Supplies wine-specific citations on the report | wine rows carry wine citations instead of spirits citations | implemented as citation surface |
| 27 CFR 4.34 appellation and vintage citation path | `src/server/review-report-helpers.ts:26`; `src/server/review-report-cross-field.ts:147` | Powers the vintage-requires-appellation cross-field rule | vintage year shown without appellation -> fail | implemented, though the code cites 4.34 where many reviewers would expect 4.27 |
| 27 CFR 4.35 bottler/importer address | `src/server/review-prompt-policy.ts:52`; `src/server/review-extractor-guardrails.ts:171`; `src/server/judgment-field-rules-secondary.ts:62` | Same address normalization path used across wine, spirits, and malt beverage | `St.` vs `Street` should not trigger a hard mismatch | implemented |
| 27 CFR 4.27 vintage date dependency | `src/server/judgment-field-rules-secondary.ts:227` (`judgeVintage`); `src/server/review-report-cross-field.ts` | Validates vintage exactness and separately requires appellation when vintage is present | `2019` on the label with no appellation -> fail | partially implemented; cross-field rule cites 4.34 instead of 4.27 |
| 27 CFR 4.23 varietal designation | `src/server/judgment-field-rules-secondary.ts:178` (`judgeVarietal`); `src/server/taxonomy/grape-varietals.ts:24`, `:193`, `:214` | Matches approved varietal names and synonyms | `Shiraz` on the label vs `Syrah` on the form -> approve | implemented for synonym/equivalence, cross-field appellation dependency not yet implemented |
| 27 CFR 4.24 semi-generic wine designations | `src/server/taxonomy/wine-classes.ts:32`, `:44`, `:54`, `:160`, `:209` | Recognizes semi-generic type designations as equivalent class/type expressions | `Burgundy` or `Chablis` can map to a wine class/type family | implemented |
| 27 CFR 4.39 Pradikat terms on American wines | `src/server/taxonomy/wine-classes.ts:233`, `:242` (`isInvalidPradikatOnAmericanWine`) | Flags German Pradikat terms as invalid on US wines | US origin plus `Spatlese` should be treated as problematic | implemented in taxonomy helper; not yet surfaced as a dedicated report rule |
| 27 CFR 4.91 approved grape varieties | `src/server/taxonomy/grape-varietals.ts:1`, `:24`, `:112`, `:193`, `:214` | Encodes canonical varietals and synonym pairs | `Pinot Grigio` vs `Pinot Gris` -> approve | implemented |
| 27 CFR 4.92 alternative names | `src/server/taxonomy/grape-varietals.ts:86`, `:182` | Keeps legacy-approved alternative names in the accepted set | `Johannisberg Riesling` still maps to Riesling | implemented |
| 27 CFR 4.72 standard wine bottle sizes | `src/server/taxonomy/net-contents-units.ts:9`, `:21`, `:102` | Normalizes volumes and standard bottle sizes for net-contents comparison | `25 FL OZ` vs `750 mL` can snap to the same standard size | implemented |

### Notes on Part 4 fidelity

- Wine class/type equivalence is one of the stronger parts of the repository because it relies on explicit taxonomies rather than prompt-only reasoning.
- The varietal-to-appellation dependency described in product documents is not yet enforced in runtime code.
- Physical label-layout requirements beyond same-field-of-vision are still mostly handled through review rather than geometric validation.

## 27 CFR Part 7: Malt Beverage Labeling

| Regulation | Code location | What it checks | Worked example | Status |
| --- | --- | --- | --- | --- |
| 27 CFR 7.22 mandatory label information | `src/server/review-report-helpers.ts:31` | Supplies malt-beverage citations on the report | beer labels carry Part 7 citations | implemented as citation surface |
| 27 CFR 7.24 name/address | `src/server/review-prompt-policy.ts:52`; `src/server/review-extractor-guardrails.ts:171`; `src/server/judgment-field-rules-secondary.ts:62` | Uses the shared postal-address extraction guardrail and overlap scoring | website URL in place of bottler address is scrubbed | implemented |
| 27 CFR 7.65 alcohol content statement | `src/server/review-report-helpers.ts:36`; `src/server/review-report-cross-field.ts:171` (`buildAbvFormatCheck`) | Rejects beer labels that use `ABV` wording instead of `Alc./Vol.` | `5% ABV` on a malt beverage -> fail | implemented |
| Part 7 malt taxonomy | `src/server/taxonomy/malt-beverages.ts:1`, `:10`, `:79` | Treats ale, lager, stout, porter, IPA, and umbrella malt-beverage classes as related families | `IPA` on the label still counts as an ale-family designation | implemented |

## 27 CFR Part 12: Foreign Nongeneric Names

The foreign-nongeneric table is encoded in [`src/server/taxonomy/wine-classes.ts`](../src/server/taxonomy/wine-classes.ts) at `:95` through `:140`.

Representative implemented entries:

| Country grouping | Code location | Example entries in the table | Worked example |
| --- | --- | --- | --- |
| Germany | `src/server/taxonomy/wine-classes.ts:95` | `Liebfraumilch`, `Mosel`, `Bernkasteler Doctor`, `Schloss Johannisberger` | form says `table white wine`, label says `Liebfraumilch` -> class/type equivalent |
| France | `src/server/taxonomy/wine-classes.ts:106` | `Bordeaux`, `Bourgogne`, `Chablis`, `Sancerre`, `Pomerol`, `Vouvray` | `Bordeaux` label text resolves as a valid wine designation |
| Italy | `src/server/taxonomy/wine-classes.ts:129` | `Barolo`, `Barbaresco`, `Soave`, `Orvieto`, `Brunello di Montalcino` | `Barolo` label text can satisfy a wine type comparison |
| Portugal | `src/server/taxonomy/wine-classes.ts:135` | `Dao`, `Porto`, `Vinho do Porto` | `Porto` can map into the fortified-wine family |
| Spain | `src/server/taxonomy/wine-classes.ts:138` | `Rioja`, `Lagrima` | `Rioja` label text should not look like an unrelated mismatch |

## Wine BAM Chapter 5

Wine BAM Chapter 5 is the conceptual source for the wine class/type taxonomy, even when the rule is encoded as an equivalence table instead of a prose quote.

| BAM-driven concept | Code location | What it enables | Worked example |
| --- | --- | --- | --- |
| wine class family rollups | `src/server/taxonomy/wine-classes.ts:160` | map table wine, dessert wine, sparkling wine, fruit wine, and related type families | `sparkling wine` vs `Champagne` |
| semi-generic designations | `src/server/taxonomy/wine-classes.ts:32`, `:44`, `:54` | recognize terms consumers see even when the form uses broader class language | `Port` vs `dessert wine` |
| foreign distinctive designations | `src/server/taxonomy/wine-classes.ts:95` | treat legally recognized foreign wine names as valid type expressions | `Mosel` vs generic German white wine |

## 27 CFR 4.91 / 4.92 Varietal Tables

| Authority | Code location | What it checks | Worked example |
| --- | --- | --- | --- |
| 27 CFR 4.91 approved varieties | `src/server/taxonomy/grape-varietals.ts:112` (`APPROVED_GRAPE_VARIETIES`) | full approved varietal set membership | `Riesling` is a valid varietal-type designation |
| 27 CFR 4.91 synonym pairs | `src/server/taxonomy/grape-varietals.ts:24` (`GRAPE_VARIETY_SYNONYMS`) | canonicalizes synonym pairs | `Garnacha` and `Grenache` compare as equivalent |
| 27 CFR 4.92 alternative names | `src/server/taxonomy/grape-varietals.ts:86`, `:182` | permits older alternative names | `Johannisberg Riesling` maps to `Riesling` |
| varietal equivalence runtime | `src/server/taxonomy/grape-varietals.ts:214` (`areVarietalsEquivalent`) and `src/server/judgment-field-rules-secondary.ts:178` (`judgeVarietal`) | turns the table into an approval/review decision | `Pinot Gris` vs `Pinot Grigio` -> approve |

## ISO 3166, Geographic Containment, And Origin Equivalence

| Authority | Code location | What it checks | Worked example |
| --- | --- | --- | --- |
| ISO-style sovereign aliases | `src/server/taxonomy/geography.ts:27` (`COUNTRY_ALIASES`) | maps `USA`, `U.S.A.`, `Italia`, `Espana`, `Deutschland`, etc. to a sovereign country | `USA` vs `United States` -> approve |
| containment by subdivision | `src/server/taxonomy/geography.ts:99` (`COUNTRY_SUBDIVISIONS`) | allows label regions to satisfy country-of-origin checks | `California` vs `USA`, `Bordeaux` vs `France` |
| runtime origin equivalence | `src/server/taxonomy/geography.ts:237` (`isCountryOrSubdivisionEquivalent`) and `src/server/judgment-field-rules-secondary.ts:155` (`judgeCountryOfOrigin`) | combines aliasing and containment | form says `France`, label says `Bourgogne` -> approve |

## USPS Publication 28 And Address Normalization

| Authority | Code location | What it checks | Worked example |
| --- | --- | --- | --- |
| common street suffix abbreviations | `src/server/taxonomy/address-abbreviations.ts:25` | expands forms like `Ave`, `Rd`, `St`, `Ste` | `100 Main St.` vs `100 Main Street` |
| directional and unit normalization | `src/server/taxonomy/address-abbreviations.ts:67`, `:79` | normalizes `N`, `SW`, `Apt`, `Ste`, `Bldg` | `Suite B` vs `Ste B` |
| address normalization and overlap | `src/server/taxonomy/address-abbreviations.ts:125`, `:145` | strips punctuation, expands abbreviations, computes token overlap | `306 Northern Ave` vs `306 Northern Avenue` |
| applicant-address judgment | `src/server/judgment-field-rules-secondary.ts:62` | applies overlap bands and never auto-rejects | same company with abbreviated street suffix -> approve |

## Net Contents And Standard Bottle Sizes

| Authority | Code location | What it checks | Worked example |
| --- | --- | --- | --- |
| 27 CFR 4.72 / 5.203 standard sizes | `src/server/taxonomy/net-contents-units.ts:9`, `:21` | defines standard bottle sizes in mL | 750mL is a standard size |
| unit parsing and conversion | `src/server/taxonomy/net-contents-units.ts:28`, `:49` | parses `mL`, `L`, `cl`, `fl oz`, `pint`, `gal` | `25.4 FL OZ` -> `751.17mL` |
| standard-bottle snapping | `src/server/taxonomy/net-contents-units.ts:82`, `:102` | snaps near-standard values back to a canonical bottle size | `25 FL OZ` and `750mL` can resolve to the same standard bottle |
| judgment path | `src/server/judgment-field-rules-secondary.ts:15` (`judgeNetContents`) | decides approve/review/reject using parsed volumes | `700mL` vs `750mL` -> reject |

## Beverage-Type Taxonomies

| Authority | Code location | What it checks | Worked example |
| --- | --- | --- | --- |
| 27 CFR Part 5 / Spirits BAM | `src/server/taxonomy/distilled-spirits.ts:24`, `:142`, `:167` | spirits class aliases and whisky/whiskey equivalence | `bourbon` -> whisky-family class |
| 27 CFR Part 7 / Malt BAM | `src/server/taxonomy/malt-beverages.ts:10`, `:79` | malt class aliases and ale/lager/beer family rollups | `IPA` -> ale-family type |
| Wine BAM Ch. 5 / Part 4 | `src/server/taxonomy/wine-classes.ts:160`, `:209` | wine class/type families and foreign names | `Chianti` -> valid wine designation |

## Rules Referenced In Product Docs But Not Fully Implemented

Some regulations appear in the product and presearch documents but are not yet enforced directly in the runtime.

| Regulation / requirement | Current state |
| --- | --- |
| 27 CFR 4.23(a) varietal requires appellation | not implemented as a runtime cross-field check |
| 27 CFR 16.22(b) warning text-size minimum by container size | not implemented |
| full 27 CFR 5.37 spirits tolerance math | simplified in the current ABV rule |
| numeric TTB product-code lookup table | not implemented |
| numeric TTB origin-code lookup table | not implemented |
| hard geographic consistency check between appellation and country | partially implied by country containment, not a dedicated rule |

## Worked Examples Across The Stack

| Scenario | Regulation / authority | Code path |
| --- | --- | --- |
| `STONE'S THROW` vs `Stone's Throw` should not reject | mandatory label identity, but cosmetic brand variance | `src/server/judgment-field-rules.ts:274` (`judgeBrandName`) |
| `5% ABV` on a malt beverage should fail wording even if the number is correct | 27 CFR 7.65 | `src/server/review-report-cross-field.ts` beer ABV format check |
| `USA` on the form and `California` on the label should pass | ISO-style sovereign alias + geographic containment | `src/server/taxonomy/geography.ts:99`, `:237`; `judgeCountryOfOrigin` |
| `Pinot Grigio` vs `Pinot Gris` should pass | 27 CFR 4.91 varietal synonyms | `src/server/taxonomy/grape-varietals.ts:24`, `:214`; `judgeVarietal` |
| `Government Warning` in title case with missing confidence should review instead of approve | 27 CFR Part 16 exact-text and formatting gate | `src/server/government-warning-validator.ts`, `src/server/government-warning-subchecks.ts`, `src/server/government-warning-vote.ts` |

## Bottom Line

The repository's regulatory depth is strongest where the rules can be encoded as explicit text, arithmetic, or equivalence tables:

- warning text
- brand-name normalization
- taxonomy-driven class/type and varietal matching
- geography containment
- unit conversion

It is intentionally more conservative where the evidence is visual or contextual:

- same field of vision
- warning layout quality
- imported-label long-tail equivalences
- address identity vs mere postal similarity

That split is the architecture in miniature: deterministic where possible, review-oriented where the evidence is ambiguous.
