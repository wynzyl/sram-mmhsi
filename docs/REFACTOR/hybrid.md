2.  Target architecture

Refactor into a hybrid production-ready structure:

```txt
src/
  app/
    (protected)/
      registration/
      enrollment/
      assessment/
      payments/
      reports/

  modules/
    registration/
      actions/
      components/
      constants/
      queries/
      schemas/
      services/
      types/
      utils/

    enrollment/
      actions/
      components/
      constants/
      queries/
      schemas/
      services/
      types/
      utils/

    assessment/
      actions/
      components/
      constants/
      queries/
      schemas/
      services/
      types/
      utils/

    payments/
      actions/
      components/
      constants/
      queries/
      schemas/
      services/
      types/
      utils/

    discounts/
      actions/
      components/
      constants/
      queries/
      schemas/
      services/
      types/
      utils/

    reversals/
      actions/
      components/
      constants/
      queries/
      schemas/
      services/
      types/
      utils/

    official-receipts/
      actions/
      components/
      constants/
      queries/
      schemas/
      services/
      types/
      utils/

  shared/
    components/
      forms/
      tables/
      dialogs/
      cards/
      filters/
      status-badges/

    constants/
    schemas/
    types/
    utils/
    validations/
    money/
    audit/
    errors/

  db/
    schema/
    queries/
    transactions/

  lib/
    auth/
    permissions/
    logger/
    date/
    id-generator/
```
