# Judgment rule coverage — synthetic variations

Generated 859 synthetic variations from 28 real COLA Cloud labels.
Each variation applies a known perturbation; the expected disposition is what the rule should return.

## Summary by field

| Field | Total | Match | Match % | legit ✓ / total | ambiguous ✓ / total | illegit ✓ / total |
|---|---|---|---|---|---|---|
| brand-name | 234 | 234 | 100% | 178/178 | 28/28 | 28/28 |
| class-type | 142 | 140 | 99% | 112/112 | 0/2 | 28/28 |
| alcohol-content | 115 | 110 | 96% | 80/85 | 0/0 | 30/30 |
| net-contents | 108 | 81 | 75% | 54/81 | 0/0 | 27/27 |
| country-of-origin | 37 | 37 | 100% | 26/26 | 11/11 | 0/0 |
| government-warning | 168 | 140 | 83% | 112/112 | 0/0 | 28/56 |
| applicant-address | 5 | 4 | 80% | 3/3 | 0/1 | 1/1 |
| varietal | 30 | 30 | 100% | 20/20 | 0/0 | 10/10 |
| vintage | 20 | 20 | 100% | 10/10 | 0/0 | 10/10 |

## Mismatches (rule returned something other than expected disposition)

| Row | Field | Kind | Description | Expected | Actual | Rule | Conf |
|---|---|---|---|---|---|---|---|
| persian-empire-black-widow-distilled-s | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| persian-empire-black-widow-distilled-s | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| persian-empire-arak-distilled-spirits | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| persian-empire-arak-distilled-spirits | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| simply-elegant-simply-elegant-spirits- | class-type | ambiguous | whisky ↔ whiskey spelling | review | approve | class-type-taxonomy-match | 0.92 |
| simply-elegant-simply-elegant-spirits- | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| simply-elegant-simply-elegant-spirits- | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| crafy-elk-cranberry-blueberry-acai-dis | applicant-address | ambiguous | partial overlap (DBA style) | review | approve | address-substring-match | 0.88 |
| crafy-elk-cranberry-blueberry-acai-dis | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| leitz-rottland-wine | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| leitz-rottland-wine | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| leitz-magdalenenkreuz-wine | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| leitz-magdalenenkreuz-wine | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| leitz-klosterlay-wine | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| leitz-klosterlay-wine | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| uncorked-in-mayberry-otis-own-wine | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| uncorked-in-mayberry-otis-own-wine | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| lake-placid-shredder-malt-beverage | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| lake-placid-shredder-malt-beverage | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| lake-placid-ridge-runner-malt-beverage | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| lake-placid-ridge-runner-malt-beverage | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| recluse-brew-works-shy-guy-malt-bevera | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| recluse-brew-works-shy-guy-malt-bevera | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| pleasant-prairie-brewing-peach-sour-al | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| pleasant-prairie-brewing-peach-sour-al | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| crafty-elk-mango-honey-distilled-spiri | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| crafty-elk-mango-honey-distilled-spiri | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| the-wine-trust-rum-distilled-spirits | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| the-wine-trust-rum-distilled-spirits | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| flaviar-columbia-creek-tennessee-whisk | class-type | ambiguous | whisky ↔ whiskey spelling | review | approve | class-type-taxonomy-match | 0.92 |
| flaviar-columbia-creek-tennessee-whisk | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| flaviar-columbia-creek-tennessee-whisk | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| old-station-31-orange-distilled-spirit | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| old-station-31-orange-distilled-spirit | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| west-peak-tequila-paloma-distilled-spi | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| west-peak-tequila-paloma-distilled-spi | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| stormwood-wines-semillon-wine | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| stormwood-wines-semillon-wine | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| forlorn-hope-san-hercurmer-delle-frecc | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| forlorn-hope-san-hercurmer-delle-frecc | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| manzone-giovanni-barolo-perno-wine | alcohol-content | legit | wine tolerance (+0.8%) | approve | reject | abv-crosses-wine-tax-boundary | 0.95 |
| manzone-giovanni-barolo-perno-wine | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| manzone-giovanni-barolo-perno-wine | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| ana-luisa-gran-reserva-parcelas-blend- | alcohol-content | legit | +0.3% rounding | approve | reject | abv-crosses-wine-tax-boundary | 0.95 |
| ana-luisa-gran-reserva-parcelas-blend- | alcohol-content | legit | wine tolerance (+0.8%) | approve | reject | abv-crosses-wine-tax-boundary | 0.95 |
| ana-luisa-gran-reserva-parcelas-blend- | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| ana-luisa-gran-reserva-parcelas-blend- | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| carousel-winery-fairy-floss-cotton-can | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| carousel-winery-fairy-floss-cotton-can | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| venture-studios-null-wine | alcohol-content | legit | +0.3% rounding | approve | reject | abv-crosses-wine-tax-boundary | 0.95 |
| venture-studios-null-wine | alcohol-content | legit | wine tolerance (+0.8%) | approve | reject | abv-crosses-wine-tax-boundary | 0.95 |
| venture-studios-null-wine | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| venture-studios-null-wine | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| sapwood-cellars-albura-lager-malt-beve | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| sapwood-cellars-albura-lager-malt-beve | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| drekker-brewing-company-piano-necktie- | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| drekker-brewing-company-piano-necktie- | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| pilok-broumy-malt-beverage | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| pilok-broumy-malt-beverage | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| 1840-original-lager-1840-original-lage | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| 1840-original-lager-1840-original-lage | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |
| harpoon-ale-malt-beverage | net-contents | legit | 750 mL → 25.4 fl oz (fl oz not yet parsed) | review | reject | net-contents-mismatch | 0.92 |
| harpoon-ale-malt-beverage | government-warning | illegit | missing "drive a car or operate machinery" phrase | reject | review | warning-fuzzy-match-moderate | 0.55 |