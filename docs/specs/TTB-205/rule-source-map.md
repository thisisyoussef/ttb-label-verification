# Rule Source Map

## Story

- Story ID: `TTB-205`

## Rules touched

| Rule ID | Applies To | Expected Outcome |
| --- | --- | --- |
| `BRAND-FUZZY-COSMETIC` | all beverages | cosmetic differences stay `review` |
| `FIELD-COMPARISON` | compared fields | exact match `pass`; cosmetic mismatch `review`; clear mismatch remains evidence-backed |
| `SPIRITS-SAME-FOV` | distilled spirits | advisory/review unless strong evidence exists |
| `WINE-VINTAGE-APPELLATION` | wine | fail on clear dependency violation |
| `BEER-ABV-FORMAT` | malt beverage | fail on forbidden `ABV` formatting |
| `RECOMMENDATION-AGGREGATION` | integrated report | `reject` on fail, `review` on uncertainty/review, otherwise `approve` |
