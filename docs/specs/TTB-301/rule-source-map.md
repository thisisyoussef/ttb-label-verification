# Rule Source Map

`TTB-301` does not add new compliance rules. Batch mode reuses the deterministic rule families already mapped by the single-label stories:

- Field comparison and aggregation from `TTB-205`
- Government warning validation from `TTB-204`
- Beverage inference and extraction quality from `TTB-203`

Batch-specific work in this story is orchestration and presentation only: matching, streaming, dashboard summarization, retry, and export.
